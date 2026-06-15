import { randomBytes } from 'node:crypto';
import { db } from './database';
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

export function getTips(userId: string): StoredTip[] {
  return db.prepare(`
    SELECT match_id, home_score, away_score FROM tippspiel_tips
    WHERE user_id = ? ORDER BY match_id
  `).all(userId) as StoredTip[];
}

export function saveTips(userId: string, tips: StoredTip[]): StoredTip[] {
  const valid = tips.filter((tip) =>
    TIPPSPIEL_MATCH_BY_ID.has(tip.match_id)
    && new Date(TIPPSPIEL_MATCH_BY_ID.get(tip.match_id)!.kickoffAt).getTime() > Date.now()
    && Number.isInteger(tip.home_score) && tip.home_score >= 0 && tip.home_score <= 20
    && Number.isInteger(tip.away_score) && tip.away_score >= 0 && tip.away_score <= 20
  );
  const write = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO tippspiel_tips (user_id, match_id, home_score, away_score, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, match_id) DO UPDATE SET
        home_score = excluded.home_score,
        away_score = excluded.away_score,
        updated_at = datetime('now')
    `);
    for (const tip of valid) stmt.run(userId, tip.match_id, tip.home_score, tip.away_score);
  });
  write();
  return getTips(userId);
}

function groupWithMembers(groupId: string): TippspielGroup | null {
  const group = db.prepare(`SELECT * FROM tippspiel_groups WHERE id = ?`).get(groupId) as Omit<TippspielGroup, 'members'> | undefined;
  if (!group) return null;
  const members = db.prepare(`
    SELECT u.id,
      CASE WHEN u.display_name = '' THEN substr(u.email, 1, instr(u.email, '@') - 1) ELSE u.display_name END AS display_name
    FROM tippspiel_group_members gm JOIN tippspiel_users u ON u.id = gm.user_id
    WHERE gm.group_id = ? ORDER BY gm.joined_at
  `).all(groupId) as TippspielGroup['members'];
  return { ...group, members };
}

export function getGroups(userId: string): TippspielGroup[] {
  const ids = db.prepare(`SELECT group_id FROM tippspiel_group_members WHERE user_id = ? ORDER BY joined_at`).all(userId) as Array<{ group_id: string }>;
  return ids.map(({ group_id }) => groupWithMembers(group_id)).filter((group): group is TippspielGroup => !!group);
}

export function createGroup(userId: string, name: string, description: string): TippspielGroup {
  const id = crypto.randomUUID();
  const inviteCode = randomBytes(9).toString('base64url');
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO tippspiel_groups (id, name, description, invite_code, owner_id) VALUES (?, ?, ?, ?, ?)`)
      .run(id, name.trim().slice(0, 80), description.trim().slice(0, 240), inviteCode, userId);
    db.prepare(`INSERT INTO tippspiel_group_members (group_id, user_id) VALUES (?, ?)`).run(id, userId);
  });
  tx();
  return groupWithMembers(id)!;
}

export function joinGroup(userId: string, inviteCode: string): TippspielGroup | null {
  const group = db.prepare(`SELECT id FROM tippspiel_groups WHERE invite_code = ?`).get(inviteCode) as { id: string } | undefined;
  if (!group) return null;
  db.prepare(`INSERT OR IGNORE INTO tippspiel_group_members (group_id, user_id) VALUES (?, ?)`).run(group.id, userId);
  return groupWithMembers(group.id);
}

export function getResults(): StoredTip[] {
  return db.prepare(`SELECT match_id, home_score, away_score FROM tippspiel_results ORDER BY match_id`).all() as StoredTip[];
}

export function setResult(result: StoredTip): StoredTip[] {
  if (!TIPPSPIEL_MATCH_BY_ID.has(result.match_id)
    || !Number.isInteger(result.home_score) || result.home_score < 0 || result.home_score > 20
    || !Number.isInteger(result.away_score) || result.away_score < 0 || result.away_score > 20) {
    throw new Error('Ungültiges Resultat');
  }
  db.prepare(`
    INSERT INTO tippspiel_results (match_id, home_score, away_score, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(match_id) DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score, updated_at = datetime('now')
  `).run(result.match_id, result.home_score, result.away_score);
  return getResults();
}

function tendency(home: number, away: number): number {
  return Math.sign(home - away);
}

export function getRanking(): RankingEntry[] {
  const users = db.prepare(`
    SELECT id, CASE WHEN display_name = '' THEN substr(email, 1, instr(email, '@') - 1) ELSE display_name END AS display_name
    FROM tippspiel_users
  `).all() as Array<{ id: string; display_name: string }>;
  const tips = db.prepare(`
    SELECT t.user_id, t.match_id, t.home_score, t.away_score, r.home_score AS result_home, r.away_score AS result_away
    FROM tippspiel_tips t JOIN tippspiel_results r ON r.match_id = t.match_id
  `).all() as Array<{ user_id: string; match_id: number; home_score: number; away_score: number; result_home: number; result_away: number }>;
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
