'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Bell, Check, ChevronRight, Clock3, Copy, Goal, LockKeyhole,
  LogOut, Mail, Plus, ShieldCheck, Sparkles, Trophy, Users, X,
} from 'lucide-react';
import { TIPPSPIEL_MATCHES } from '@/lib/tippspielMatches';
import './registration.css';
import styles from './tippspiel.module.css';

type User = { id: string; email: string; displayName: string };
type RankingEntry = { id: string; display_name: string; points: number; exact: number };
type Group = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  owner_id: string;
  members: Array<{ id: string; display_name: string }>;
};

const initials = (value: string) => value
  .split(/[\s@._-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('');

export default function TippspielPage() {
  const [activeTab, setActiveTab] = useState('Tippen');
  const [tips, setTips] = useState<Record<number, [string, string]>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modal, setModal] = useState<'register' | 'group' | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupError, setGroupError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  const completed = useMemo(() => Object.values(tips).filter(([home, away]) => home !== '' && away !== '').length, [tips]);
  const participants = useMemo(() => {
    const values = new Map<string, Group['members'][number]>();
    for (const group of groups) for (const member of group.members) values.set(member.id, member);
    if (user) values.set(user.id, { id: user.id, display_name: user.displayName || user.email.split('@')[0] });
    return Array.from(values.values());
  }, [groups, user]);
  const rankingById = useMemo(() => new Map(ranking.map((entry) => [entry.id, entry])), [ranking]);
  const userRank = user ? ranking.findIndex((entry) => entry.id === user.id) + 1 : 0;
  const nextMatch = TIPPSPIEL_MATCHES.find((match) => new Date(match.kickoffAt).getTime() > now);

  const loadUserData = useCallback(async () => {
    const sessionResponse = await fetch('/api/tippspiel/session');
    const session = await sessionResponse.json();
    setUser(session.user || null);
    if (!session.authenticated) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'invalid') setNotice('Dieser Anmeldelink ist ungültig oder wurde bereits verwendet.');
      if (params.get('join')) setNotice('Melde dich an, um der eingeladenen Gruppe beizutreten.');
      setLoading(false);
      return;
    }

    const [tipsResponse, groupsResponse, rankingResponse] = await Promise.all([fetch('/api/tippspiel/tips'), fetch('/api/tippspiel/groups'), fetch('/api/tippspiel/ranking')]);
    const tipsResult = await tipsResponse.json();
    const groupsResult = await groupsResponse.json();
    const rankingResult = await rankingResponse.json();
    if (tipsResult.success) {
      setTips(Object.fromEntries(tipsResult.tips.map((tip: { match_id: number; home_score: number; away_score: number }) => [
        tip.match_id, [String(tip.home_score), String(tip.away_score)],
      ])));
    }
    if (groupsResult.success) setGroups(groupsResult.groups);
    if (rankingResult.success) setRanking(rankingResult.ranking);

    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('join');
    if (inviteCode) {
      const response = await fetch('/api/tippspiel/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      });
      const result = await response.json();
      setNotice(result.success ? `Du bist der Gruppe „${result.group.name}“ beigetreten.` : result.error);
      if (result.success) setGroups((current) => [...current.filter((group) => group.id !== result.group.id), result.group]);
    } else if (params.get('login') === 'success') {
      setNotice('Anmeldung erfolgreich. Deine Tipps werden jetzt gespeichert.');
    }
    if (window.location.search) window.history.replaceState({}, '', '/tippspiel');
    setLoading(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      loadUserData().catch(() => {
        setLoading(false);
        setNotice('Deine Daten konnten nicht geladen werden.');
      });
    }, 0);
    return () => window.clearTimeout(initial);
  }, [loadUserData]);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const updateTip = (matchId: number, side: 0 | 1, value: string) => {
    if (!/^\d{0,2}$/.test(value)) return;
    setSaved(false);
    setTips((current) => {
      const next: [string, string] = [...(current[matchId] || ['', ''])];
      next[side] = value;
      return { ...current, [matchId]: next };
    });
  };

  const saveTips = async () => {
    if (!user) return setModal('register');
    setSaveError('');
    const completeTips = Object.entries(tips)
      .filter(([, [home, away]]) => home !== '' && away !== '')
      .map(([matchId, [home, away]]) => ({ match_id: Number(matchId), home_score: Number(home), away_score: Number(away) }));
    try {
      const response = await fetch('/api/tippspiel/tips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tips: completeTips }),
      });
      const result = await response.json();
      if (!response.ok) return setSaveError(result.error || 'Die Tipps konnten nicht gespeichert werden.');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2800);
    } catch {
      setSaveError('Die Tipps konnten nicht gespeichert werden. Bitte prüfe deine Verbindung.');
    }
  };

  const sendMagicLink = async () => {
    if (!email.includes('@')) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch('/api/tippspiel/auth/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, joinCode: new URLSearchParams(window.location.search).get('join') }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setAuthError(result.error || 'Der Anmeldelink konnte nicht gesendet werden.');
      setSent(true);
    } catch {
      setAuthError('Der Anmeldelink konnte nicht gesendet werden. Bitte prüfe deine Verbindung.');
    } finally {
      setAuthLoading(false);
    }
  };

  const createNewGroup = async () => {
    if (!user) return setModal('register');
    setGroupError('');
    try {
      const response = await fetch('/api/tippspiel/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, description: groupDescription }),
      });
      const result = await response.json();
      if (!response.ok) return setGroupError(result.error || 'Die Gruppe konnte nicht erstellt werden.');
      setGroups((current) => [...current, result.group]);
      setGroupName('');
      setGroupDescription('');
      setModal(null);
      setNotice(`Gruppe „${result.group.name}“ wurde erstellt.`);
    } catch {
      setGroupError('Die Gruppe konnte nicht erstellt werden. Bitte prüfe deine Verbindung.');
    }
  };

  const copyInviteLink = async (group: Group) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tippspiel?join=${encodeURIComponent(group.invite_code)}`);
      setNotice(`Einladungslink für „${group.name}“ kopiert.`);
    } catch {
      setNotice('Der Einladungslink konnte nicht kopiert werden.');
    }
  };

  const logout = async () => {
    await fetch('/api/tippspiel/session', { method: 'DELETE' });
    setUser(null);
    setGroups([]);
    setRanking([]);
    setTips({});
    setNotice('Du wurdest abgemeldet.');
  };

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <button className={styles.brand} onClick={() => setActiveTab('Tippen')} aria-label="Tippspiel Startseite">
          <span className={styles.logoPlate}><Image src="/faltin-logo.svg" alt="Faltin Travel" width={105} height={34} priority /></span>
          <span className={styles.brandDivider} /><span>FALTIN TRAVEL · WM-TIPPSPIEL</span>
        </button>
        <nav className={styles.nav}>
          {['Tippen', 'Rangliste', 'Gruppen', 'Regeln'].map((tab) => <button key={tab} className={activeTab === tab ? styles.navActive : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </nav>
        <div className={styles.headerActions}>
          {user ? <button className="tip-register-button" onClick={logout}><LogOut size={15} /> Abmelden</button> : <button className="tip-register-button" onClick={() => setModal('register')}><Mail size={15} /> Registrieren</button>}
          <button className={styles.iconButton} aria-label="Benachrichtigungen"><Bell size={19} /></button>
          <button className={styles.avatar} title={user?.email}>{user ? initials(user.displayName || user.email) : '?'}</button>
        </div>
      </header>

      <section className={styles.hero}><div className={styles.heroGlow} /><div className={styles.heroInner}>
        <div><div className={styles.eyebrow}><span /> FALTIN TRAVEL · WM-TIPPSPIEL 2026</div><h1>Tippen. Mitfiebern.<br /><em>Live erleben.</em></h1>
          <p>104 Spiele in Kanada, Mexiko und den USA. Tippe mit deiner Gruppe<br className={styles.desktopBreak} /> und entdecke die WM mit Faltin Travel.</p>
          <div className={styles.heroButtons}>
            <button className={styles.primaryButton} onClick={() => user ? document.getElementById('matches')?.scrollIntoView({ behavior: 'smooth' }) : setModal('register')}>{user ? 'Jetzt tippen' : 'Kostenlos registrieren'} <ArrowRight size={17} /></button>
            <Link className={styles.ghostButton} href="/fifa-wm"><Trophy size={17} /> WM-Reisen entdecken</Link>
          </div>
        </div>
        <div className={styles.heroStats}><div><strong>104</strong><span>Spiele</span></div><div><strong>48</strong><span>Teams</span></div><div><strong>16</strong><span>Host Cities</span></div><div><strong>39</strong><span>Turniertage</span></div></div>
      </div></section>

      <section className={styles.content}>
        {notice && <div className="tip-notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
        <div className={styles.dashboardTop}><div><span className={styles.sectionKicker}>DEIN DASHBOARD</span><h2>{loading ? 'Daten werden geladen…' : user ? `Hallo ${user.displayName || user.email.split('@')[0]}, bereit?` : 'Bereit für deinen Tipp?'}</h2></div>
          <div className={styles.deadline}><Clock3 size={18} /><div><span>NÄCHSTER TIPPSCHLUSS</span><strong>{nextMatch ? `${nextMatch.date} · ${nextMatch.time} UHR` : 'GRUPPENPHASE BEENDET'}</strong></div></div>
        </div>

        <div className={styles.quickGrid}>
          <button className={`${styles.quickCard} ${styles.quickDark}`} onClick={() => document.getElementById('matches')?.scrollIntoView({ behavior: 'smooth' })}><span className={styles.quickIcon}><Goal size={22} /></span><span><small>DEINE TIPPS</small><strong>{completed} von {TIPPSPIEL_MATCHES.length} gesetzt</strong><em><i style={{ width: `${(completed / TIPPSPIEL_MATCHES.length) * 100}%` }} /></em></span><ChevronRight size={20} /></button>
          <button className={styles.quickCard} onClick={() => setActiveTab('Rangliste')}><span className={styles.quickIcon}><Trophy size={22} /></span><span><small>DEINE PUNKTE</small><strong>{user ? `${rankingById.get(user.id)?.points || 0} Punkte · Platz ${userRank || '–'}` : 'Nach Anmeldung sichtbar'}</strong><em>Automatische Auswertung nach Spielende</em></span><ChevronRight size={20} /></button>
          <button className={styles.quickCard} onClick={() => setActiveTab('Gruppen')}><span className={styles.quickIcon}><Users size={22} /></span><span><small>DEINE GRUPPEN</small><strong>{groups.length ? `${groups.length} Tipprunde${groups.length === 1 ? '' : 'n'}` : 'Noch keine Gruppe'}</strong><em>{groups.length ? `${participants.length} bekannte Mitspieler` : 'Eigene Tipprunde gründen'}</em></span><ChevronRight size={20} /></button>
        </div>

        {activeTab === 'Tippen' && <div className={styles.mainGrid} id="matches"><section>
          <div className={styles.sectionTitle}><div><span className={styles.sectionKicker}>ALLE ZEITEN: SCHWEIZ</span><h2>Aktuelle WM-Spiele</h2></div></div>
          <div className={styles.matchList}>{TIPPSPIEL_MATCHES.map((match) => {
            const locked = now > 0 && new Date(match.kickoffAt).getTime() <= now;
            return <article className={styles.matchCard} key={match.id}><div className={styles.matchMeta}><span>{match.date}</span><b>{match.group}</b><span>{locked ? 'GESCHLOSSEN' : match.time}</span></div><div className={styles.matchBody}>
              <div className={styles.team}><span className={styles.flag} style={{ background: match.homeColor }}>{match.homeCode}</span><strong>{match.home}</strong></div>
              <div className={styles.score}><input aria-label={`Tore ${match.home}`} disabled={locked} value={tips[match.id]?.[0] || ''} onChange={(event) => updateTip(match.id, 0, event.target.value)} inputMode="numeric" /><span>{locked ? <LockKeyhole size={14} /> : ':'}</span><input aria-label={`Tore ${match.away}`} disabled={locked} value={tips[match.id]?.[1] || ''} onChange={(event) => updateTip(match.id, 1, event.target.value)} inputMode="numeric" /></div>
              <div className={`${styles.team} ${styles.teamAway}`}><strong>{match.away}</strong><span className={styles.flag} style={{ background: match.awayColor, color: match.awayColor === '#f8fafc' ? '#111827' : 'white' }}>{match.awayCode}</span></div>
            </div><div className={styles.venue}>{match.venue}</div></article>;
          })}</div>
          {saveError && <p className="tip-auth-error">{saveError}</p>}
          <button className={`${styles.saveButton} ${saved ? styles.saved : ''}`} onClick={saveTips}>{saved ? <><Check size={18} /> Tipps gespeichert</> : <>{user ? 'Tipps speichern' : 'Anmelden & Tipps speichern'} <ArrowRight size={17} /></>}</button>
        </section><aside><div className={styles.sideCard}><div className={styles.sideHead}><div><span className={styles.sectionKicker}>DEINE TIPPRUNDEN</span><h3>Mitspieler</h3></div><Users size={24} /></div><div className={styles.leaderList}>
          {ranking.length ? ranking.slice(0, 6).map((member, index) => <div className={`${styles.leader} ${member.id === user?.id ? styles.you : ''}`} key={member.id}><b>{index + 1}</b><span className={styles.smallAvatar}>{initials(member.display_name)}</span><span><strong>{member.id === user?.id ? 'Du' : member.display_name}</strong><small>{member.exact} exakte Tipps</small></span><em>{member.points} P</em></div>) : <p className="tip-empty">Melde dich an und gründe eine Gruppe, um die Rangliste zu sehen.</p>}
        </div><button className={styles.fullLink} onClick={() => setActiveTab('Gruppen')}>Gruppen verwalten <ArrowRight size={15} /></button></div><div className={styles.inviteCard}><Sparkles size={22} /><span className={styles.sectionKicker}>FALTIN TRAVEL</span><h3>Die WM live erleben.</h3><p>Tickets, Hotels und individuelle WM-Reisen aus einer Hand.</p><Link href="/fifa-wm">Zu den WM-Reisen <ArrowRight size={16} /></Link></div></aside></div>}

        {activeTab === 'Rangliste' && <section className={styles.panelView}><div className={styles.sectionTitle}><div><span className={styles.sectionKicker}>LIVE-RANKING</span><h2>Gesamtrangliste</h2></div></div><div className={styles.rankingTable}>
          {ranking.length ? ranking.map((member, index) => <div className={member.id === user?.id ? styles.rankYou : ''} key={member.id}><b>#{index + 1}</b><span className={styles.smallAvatar}>{initials(member.display_name)}</span><strong>{member.id === user?.id ? 'Du' : member.display_name}</strong><span>{member.exact} exakte Tipps</span><em>{member.points} Punkte</em></div>) : <p className="tip-empty">Melde dich an, um die Rangliste zu sehen.</p>}
        </div></section>}

        {activeTab === 'Gruppen' && <section className={styles.panelView}><div className={styles.sectionTitle}><div><span className={styles.sectionKicker}>PRIVATE TIPPRUNDEN</span><h2>Deine Gruppen</h2></div><button onClick={() => user ? setModal('group') : setModal('register')}><Plus size={15} /> Neue Gruppe</button></div><div className={styles.groupGrid}>
          {groups.map((group) => <article className={styles.groupCard} key={group.id}><div className={styles.groupCover}><Users size={28} /><span>{group.members.length} MITGLIEDER</span><button aria-label="Einladungslink kopieren" onClick={() => copyInviteLink(group)}><Copy size={17} /></button></div><div className={styles.groupInfo}><span className={styles.sectionKicker}>{group.owner_id === user?.id ? 'DEINE GRUPPE' : 'MITGLIED'}</span><h3>{group.name}</h3><p>{group.description || 'Private Tipprunde für die WM 2026.'}</p>{[...group.members].sort((a, b) => (rankingById.get(b.id)?.points || 0) - (rankingById.get(a.id)?.points || 0)).map((member, index) => <div className={styles.member} key={member.id}><b>{index + 1}</b><span>{initials(member.display_name)}</span><strong>{member.id === user?.id ? 'Du' : member.display_name}</strong><em>{rankingById.get(member.id)?.points || 0} P</em><small>–</small></div>)}<button className={styles.fullLink} onClick={() => copyInviteLink(group)}><Copy size={15} /> Einladungslink kopieren</button></div></article>)}
          <button className={styles.newGroup} onClick={() => user ? setModal('group') : setModal('register')}><span><Plus size={24} /></span><strong>Neue Gruppe gründen</strong><small>Freunde, Familie oder Kollegen einladen</small></button>
        </div></section>}

        {activeTab === 'Regeln' && <section className={styles.panelView}><div className={styles.sectionTitle}><div><span className={styles.sectionKicker}>SO FUNKTIONIERT&apos;S</span><h2>Punkte & Regeln</h2></div></div><div className={styles.rulesGrid}>{[['5', 'Exaktes Ergebnis', 'Du tippst das genaue Endresultat.'], ['3', 'Richtige Tordifferenz', 'Sieger und Differenz stimmen.'], ['2', 'Richtige Tendenz', 'Sieger oder Unentschieden stimmen.']].map(([points, title, text]) => <article key={title}><strong>{points}<small>P</small></strong><h3>{title}</h3><p>{text}</p></article>)}</div></section>}
      </section>

      <footer className={styles.footer}><span><Image src="/faltin-logo.svg" alt="Faltin Travel" width={90} height={30} /> <b>WM-Tippspiel 2026</b></span><p>Tickets & Reisen zu den grössten Sportevents</p><div><Link className="tip-footer-link" href="/datenschutz">Datenschutz</Link><Link className="tip-footer-link" href="/impressum">Impressum</Link></div></footer>

      {modal && <div className={styles.modalBackdrop} onMouseDown={() => setModal(null)}><div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><button className={styles.modalClose} onClick={() => setModal(null)}><X size={18} /></button>
        {modal === 'register' ? <><span className={styles.modalIcon}>{sent ? <Check size={25} /> : <Mail size={25} />}</span>{sent ? <><span className={styles.sectionKicker}>ANMELDELINK IST RAUS</span><h2>Check dein Postfach.</h2><p>Wir haben einen persönlichen Magic Link an <strong>{email}</strong> geschickt. Beim ersten Klick wird dein Konto automatisch erstellt.</p><button className={styles.modalPrimary} onClick={() => { setSent(false); setEmail(''); }}>Andere E-Mail verwenden</button></> : <><span className={styles.sectionKicker}>KOSTENLOS & OHNE PASSWORT</span><h2>Zum Tippspiel anmelden</h2><p>Gib deine E-Mail-Adresse ein. Du erhältst einen sicheren Link zur Registrierung und Anmeldung.</p><label>Deine E-Mail-Adresse<input type="email" placeholder="name@beispiel.ch" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus /></label>{authError && <p className="tip-auth-error">{authError}</p>}<button className={styles.modalPrimary} disabled={!email.includes('@') || authLoading} onClick={sendMagicLink}>{authLoading ? 'Link wird gesendet…' : 'Magic Link senden'} <ArrowRight size={17} /></button><small><ShieldCheck size={14} /> Der Link ist einmalig und 30 Minuten gültig.</small></>}</> :
          <><span className={styles.modalIcon}><Users size={25} /></span><span className={styles.sectionKicker}>EIGENE TIPPRUNDE</span><h2>Neue Gruppe gründen</h2><p>Erstelle eine private Gruppe und teile danach den Einladungslink.</p><label>Gruppenname<input placeholder="z. B. Büro-Elf" value={groupName} onChange={(event) => setGroupName(event.target.value)} autoFocus /></label><label>Beschreibung<input placeholder="Worum spielt ihr?" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} /></label>{groupError && <p className="tip-auth-error">{groupError}</p>}<button className={styles.modalPrimary} disabled={groupName.trim().length < 2} onClick={createNewGroup}>Gruppe erstellen <ArrowRight size={17} /></button></>}
      </div></div>}
    </main>
  );
}
