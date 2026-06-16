import { randomBytes } from 'node:crypto';
import { dbGet, dbAll, dbRun, withTx } from './dbq';
import './database';
import type { TippspielUser } from './tippspielAuth';
import { TIPPSPIEL_MATCH_BY_ID } from './tippspielMatches';

export type StoredTip = { match_id: number; home_score: number; away_score: number };
export type RankingEntry = { id: string; display_name: string; points: number; exact: number };
export type TippspielGroup = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  members: Array<Pick<TippspielUser, 'id' | 'display_name'>>;
};

/** Anzeigename mit Fallback auf den lokalen Teil der E-Mail (backend-neutral, kein instr()). */
function displayNameFallback(raw: string | null | undefined, email: string): string {
  if (raw && raw.trim()) return raw;
  const at = (email || '').indexOf('@');
  return at > 0 ? email.slice(0, at) : (email || '');
}

export async function getTips(userId: string): Promise<StoredTip[]> {
  return dbAll<StoredTip>(`
    SELECT match_id, home_score, away_score FROM tippspiel_tips
    WHERE user_id = ? ORDER BY match_id
  `, [userId]);
}

export async function saveTips(userId: string, tips: StoredTip[]): Promise<StoredTip[]> {
  const valid = tips.filter((tip) =>
    TIPPSPIEL_MATCH_BY_ID.has(tip.match_id)
    && new Date(TIPPSPIEL_MATCH_BY_ID.get(tip.match_id)!.kickoffAt).getTime() > Date.now()
    && Number.isInteger(tip.home_score) && tip.home_score >= 0 && tip.home_score <= 20
    && Number.isInteger(tip.away_score) && tip.away_score >= 0 && tip.away_score <= 20
  );
  await withTx(async (q) => {
    for (const tip of valid) {
      await q.run(`
        INSERT INTO tippspiel_tips (user_id, match_id, home_score, away_score, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, match_id) DO UPDATE SET
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          updated_at = datetime('now')
      `, [userId, tip.match_id, tip.home_score, tip.away_score]);
    }
  });
  return getTips(userId);
}

async function groupWithMembers(groupId: string): Promise<TippspielGroup | null> {
  const group = await dbGet<Omit<TippspielGroup, 'members'>>(`SELECT * FROM tippspiel_groups WHERE id = ?`, [groupId]);
  if (!group) return null;
  const rows = await dbAll<{ id: string; display_name: string; email: string }>(`
    SELECT u.id, u.display_name, u.email
    FROM tippspiel_group_members gm JOIN tippspiel_users u ON u.id = gm.user_id
    WHERE gm.group_id = ? ORDER BY gm.joined_at
  `, [groupId]);
  const members = rows.map((r) => ({ id: r.id, display_name: displayNameFallback(r.display_name, r.email) }));
  return { ...group, members };
}

export async function getGroups(userId: string): Promise<TippspielGroup[]> {
  const ids = await dbAll<{ group_id: string }>(`SELECT group_id FROM tippspiel_group_members WHERE user_id = ? ORDER BY joined_at`, [userId]);
  const groups = await Promise.all(ids.map(({ group_id }) => groupWithMembers(group_id)));
  return groups.filter((group): group is TippspielGroup => !!group);
}

export async function createGroup(userId: string, name: string, description: string): Promise<TippspielGroup> {
  const id = crypto.randomUUID();
  const inviteCode = randomBytes(9).toString('base64url');
  await withTx(async (q) => {
    await q.run(`INSERT INTO tippspiel_groups (id, name, description, invite_code, owner_id) VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim().slice(0, 80), description.trim().slice(0, 240), inviteCode, userId]);
    await q.run(`INSERT INTO tippspiel_group_members (group_id, user_id) VALUES (?, ?)`, [id, userId]);
  });
  return (await groupWithMembers(id))!;
}

export async function joinGroup(userId: string, inviteCode: string): Promise<TippspielGroup | null> {
  const group = await dbGet<{ id: string }>(`SELECT id FROM tippspiel_groups WHERE invite_code = ?`, [inviteCode]);
  if (!group) return null;
  await dbRun(`INSERT OR IGNORE INTO tippspiel_group_members (group_id, user_id) VALUES (?, ?)`, [group.id, userId]);
  return groupWithMembers(group.id);
}

export async function getResults(): Promise<StoredTip[]> {
  return dbAll<StoredTip>(`SELECT match_id, home_score, away_score FROM tippspiel_results ORDER BY match_id`);
}

export async function setResult(result: StoredTip): Promise<StoredTip[]> {
  if (!TIPPSPIEL_MATCH_BY_ID.has(result.match_id)
    || !Number.isInteger(result.home_score) || result.home_score < 0 || result.home_score > 20
    || !Number.isInteger(result.away_score) || result.away_score < 0 || result.away_score > 20) {
    throw new Error('Ungültiges Resultat');
  }
  await dbRun(`
    INSERT INTO tippspiel_results (match_id, home_score, away_score, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(match_id) DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score, updated_at = datetime('now')
  `, [result.match_id, result.home_score, result.away_score]);
  return getResults();
}

function tendency(home: number, away: number): number {
  return Math.sign(home - away);
}

export async function getRanking(): Promise<RankingEntry[]> {
  const usersRaw = await dbAll<{ id: string; display_name: string; email: string }>(`
    SELECT id, display_name, email FROM tippspiel_users
  `);
  const users = usersRaw.map((u) => ({ id: u.id, display_name: displayNameFallback(u.display_name, u.email) }));
  const tips = await dbAll<{ user_id: string; match_id: number; home_score: number; away_score: number; result_home: number; result_away: number }>(`
    SELECT t.user_id, t.match_id, t.home_score, t.away_score, r.home_score AS result_home, r.away_score AS result_away
    FROM tippspiel_tips t JOIN tippspiel_results r ON r.match_id = t.match_id
  `);
  const scores = new Map<string, { points: number; exact: number }>();
  for (const tip of tips) {
    const score = scores.get(tip.user_id) || { points: 0, exact: 0 };
    if (tip.home_score === tip.result_home && tip.away_score === tip.result_away) {
      score.points += 5;
      score.exact += 1;
    } else if (tip.home_score - tip.away_score === tip.result_home - tip.result_away) {
      score.points += 3;
    } else if (tendency(tip.home_score, tip.away_score) === tendency(tip.result_home, tip.result_away)) {
      score.points += 2;
    }
    scores.set(tip.user_id, score);
  }
  return users.map((user) => ({ ...user, ...(scores.get(user.id) || { points: 0, exact: 0 }) }))
    .sort((a, b) => b.points - a.points || b.exact - a.exact || a.display_name.localeCompare(b.display_name));
}
