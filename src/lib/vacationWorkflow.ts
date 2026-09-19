/**
 * vacationWorkflow.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Urlaubsplanung 2.0: handelnde Person aus der Session ableiten und alle
 * Benachrichtigungen (Glocke + Mail) rund um Abwesenheitsanträge.
 * Benachrichtigungen sind non-blocking: Fehler werden geloggt, nie geworfen.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Session } from './auth';
import {
  addNotification, getEmployee,
  type Employee, type VacationActor, type VacationRequest, type VacationConflicts,
} from './staffStore';
import { sendGraphMail, isGraphConfigured, getNotifyTo, getLoginBaseUrl } from './graphMailer';
import {
  VACATION_TYPE_LABEL, VACATION_REQUEST_LABEL, fmtRangeDe, fmtRangeDeYear, fmtDaysDe, firstName,
} from './vacationFormat';

export interface VacationActorInfo extends VacationActor {
  /** Anzeigename (für decided_by / created_by). */
  name: string;
}

/**
 * Handelnde Person aus der Session: der lokale Admin-Login (ohne Mitarbeiterprofil)
 * gilt als Admin, sonst zählt die Rolle 'admin' eines aktiven Mitarbeiters.
 */
export function vacationActorFromSession(ctx: { session: Session; employee: Employee | null }): VacationActorInfo {
  const emp = ctx.employee;
  return {
    employee_id: emp?.id ?? null,
    is_admin: ctx.session.src === 'local' || (!!emp && emp.active && emp.role === 'admin'),
    name: emp?.name || ctx.session.name,
  };
}

// ─── Helfer ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function adminUrl(): string {
  return `${getLoginBaseUrl() || 'https://next.faltintravel.com'}/admin/urlaub`;
}

async function bell(employeeId: string, title: string, body: string, actorName: string): Promise<void> {
  await addNotification({ employee_id: employeeId, type: 'info', title: title.slice(0, 300), body: body.slice(0, 2000), created_by: actorName })
    .catch((e) => console.warn('[Urlaub] Glocken-Benachrichtigung fehlgeschlagen:', (e as Error).message));
}

async function mail(to: string, toName: string | undefined, subject: string, html: string): Promise<void> {
  try {
    if (!isGraphConfigured() || !to) return;
    await sendGraphMail({ to, toName, subject: subject.slice(0, 200), html });
  } catch (e) {
    console.warn('[Urlaub] Mail fehlgeschlagen:', (e as Error).message);
  }
}

function absenceLine(a: VacationConflicts['absences'][number]): string {
  return `${a.employee_name} (${VACATION_TYPE_LABEL[a.type]} ${fmtRangeDe(a.start_date, a.end_date)}, ${a.status})`;
}

async function substituteName(v: VacationRequest): Promise<string | null> {
  if (!v.substitute_id) return null;
  return (await getEmployee(v.substitute_id))?.name || null;
}

// ─── Neuer Antrag / Krankmeldung ─────────────────────────────────────────────

/**
 * Nach dem Anlegen: Glocke + Mail an die Genehmiger:innen (Mail-Fallback: notify_to),
 * Glocke an die Stellvertretung. Die handelnde Person selbst wird ausgelassen.
 */
export async function notifyVacationCreated(v: VacationRequest, opts: {
  requester: Employee;
  actor: VacationActorInfo;
  approvers: Employee[];
  conflicts: VacationConflicts | null;
}): Promise<void> {
  try {
    const { requester, actor, approvers, conflicts } = opts;
    const sick = v.type === 'krankheit';
    const range = fmtRangeDe(v.start_date, v.end_date);
    const first = firstName(requester.name);
    const subName = await substituteName(v);
    const absences = conflicts?.absences || [];
    const warnings = conflicts?.warnings || [];

    // Glocke an Genehmiger:innen
    const title = `${VACATION_REQUEST_LABEL[v.type]} von ${first}: ${range} (${fmtDaysDe(v.days)})`;
    const body = [
      sick ? 'Krankmeldung – wird ohne Genehmigung erfasst.' : 'Bitte unter Admin → Urlaub genehmigen oder ablehnen.',
      actor.employee_id !== requester.id ? `Erfasst von ${actor.name}.` : '',
      v.comment ? `Kommentar: ${v.comment}` : '',
      subName ? `Stellvertretung: ${subName}` : '',
      absences.length ? `Gleichzeitig abwesend: ${absences.map(absenceLine).join('; ')}` : '',
      ...warnings.map((w) => `⚠ ${w}`),
    ].filter(Boolean).join('\n');
    const others = approvers.filter((a) => a.id !== actor.employee_id);
    for (const a of others) await bell(a.id, title, body, actor.name);

    // Glocke an die Stellvertretung
    if (v.substitute_id && v.substitute_id !== actor.employee_id) {
      const subTitle = actor.employee_id === requester.id
        ? `${first} hat dich als Stellvertretung eingetragen: ${range} (${VACATION_TYPE_LABEL[v.type]})`
        : `Du bist als Stellvertretung für ${first} eingetragen: ${range} (${VACATION_TYPE_LABEL[v.type]})`;
      const subBody = sick
        ? `${requester.name} ist krank gemeldet (${fmtDaysDe(v.days)}).`
        : `${fmtDaysDe(v.days)} · Der Antrag ist noch nicht genehmigt.`;
      await bell(v.substitute_id, subTitle, [subBody, v.comment ? `Kommentar: ${v.comment}` : ''].filter(Boolean).join('\n'), actor.name);
    }

    // Mail an Genehmiger:innen mit E-Mail — sonst ans Team-Postfach (notify_to).
    // Ist die handelnde Person die einzige Genehmiger:in, braucht es keine Mail.
    if (approvers.length > 0 && others.length === 0) return;
    const targets: Array<{ email: string; name?: string }> = others.filter((a) => a.email).map((a) => ({ email: a.email, name: a.name }));
    if (!targets.length) targets.push({ email: getNotifyTo() });

    const half = v.days === 0.5 ? ' (Halbtag)' : '';
    const subject = `${sick ? 'Krankmeldung' : 'Abwesenheitsantrag'}: ${requester.name} · ${fmtRangeDeYear(v.start_date, v.end_date)}`;
    const absHtml = absences.length
      ? `<p style="margin:16px 0 4px;"><b>Gleichzeitig abwesend:</b></p>
         <ul style="margin:0;">${absences.map((a) => `<li>${esc(absenceLine(a))}${a.is_substitute ? ' – <b>Stellvertretung</b>' : ''}</li>`).join('')}</ul>`
      : '<p style="margin:16px 0 0;color:#15803d;">Keine Überschneidungen mit anderen Abwesenheiten.</p>';
    const warnHtml = warnings.length
      ? `<div style="margin:16px 0 0;padding:10px 14px;border-radius:8px;background:#fef3c7;color:#92400e;">
           <b>Hinweise:</b><ul style="margin:6px 0 0;padding-left:18px;">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
         </div>`
      : '';
    for (const t of targets) {
      const html = `<p>Hallo${t.name ? ` ${esc(firstName(t.name))}` : ''},</p>
        <p>${sick
          ? `${esc(requester.name)} ist krank gemeldet (keine Genehmigung nötig):`
          : `${esc(requester.name)} hat eine Abwesenheit beantragt – bitte genehmigen oder ablehnen:`}</p>
        <ul>
          <li><b>Zeitraum:</b> ${esc(fmtRangeDeYear(v.start_date, v.end_date))}${half}</li>
          <li><b>Typ:</b> ${esc(VACATION_TYPE_LABEL[v.type])}</li>
          <li><b>Arbeitstage:</b> ${esc(fmtDaysDe(v.days))}</li>
          ${subName ? `<li><b>Stellvertretung:</b> ${esc(subName)}</li>` : ''}
          ${v.comment ? `<li><b>Kommentar:</b> ${esc(v.comment)}</li>` : ''}
          ${actor.employee_id !== requester.id ? `<li><b>Erfasst von:</b> ${esc(actor.name)}</li>` : ''}
        </ul>
        ${absHtml}
        ${warnHtml}
        <p style="margin:20px 0 0;"><a href="${adminUrl()}">Im Admin unter Urlaub öffnen</a></p>`;
      await mail(t.email, t.name, subject, html);
    }
  } catch (e) {
    console.warn('[Urlaub] Benachrichtigung zum neuen Antrag fehlgeschlagen:', (e as Error).message);
  }
}

// ─── Entscheid ───────────────────────────────────────────────────────────────

/** Nach dem Entscheid: Glocke + Mail an die antragstellende Person, Glocke an die Stellvertretung. */
export async function notifyVacationDecided(v: VacationRequest, opts: { actor: VacationActorInfo }): Promise<void> {
  try {
    const { actor } = opts;
    const requester = await getEmployee(v.employee_id);
    if (!requester) return;
    const ok = v.status === 'genehmigt';
    const range = fmtRangeDe(v.start_date, v.end_date);
    const label = VACATION_REQUEST_LABEL[v.type];

    if (requester.id !== actor.employee_id) {
      await bell(
        requester.id,
        `Dein ${label} ${range} wurde ${ok ? 'genehmigt' : 'abgelehnt'}`,
        [`Entschieden von ${actor.name}.`, v.decision_comment ? `Kommentar: ${v.decision_comment}` : ''].filter(Boolean).join('\n'),
        actor.name,
      );
      if (requester.email) {
        await mail(
          requester.email, requester.name,
          `Abwesenheitsantrag ${ok ? 'genehmigt' : 'abgelehnt'}: ${fmtRangeDeYear(v.start_date, v.end_date)}`,
          `<p>Hallo ${esc(firstName(requester.name))},</p>
            <p>dein Antrag für <b>${esc(fmtRangeDeYear(v.start_date, v.end_date))}</b> (${esc(VACATION_TYPE_LABEL[v.type])}, ${esc(fmtDaysDe(v.days))}) wurde
            von ${esc(actor.name)} <b style="color:${ok ? '#15803d' : '#b91c1c'}">${ok ? 'genehmigt' : 'abgelehnt'}</b>.</p>
            ${v.decision_comment ? `<p><b>Kommentar:</b> ${esc(v.decision_comment)}</p>` : ''}
            ${v.comment ? `<p style="color:#6b7280;">Dein Kommentar zum Antrag: ${esc(v.comment)}</p>` : ''}
            <p>Viele Grüsse<br/>Faltin Travel</p>`,
        );
      }
    }

    if (v.substitute_id && v.substitute_id !== actor.employee_id) {
      const first = firstName(requester.name);
      await bell(
        v.substitute_id,
        ok
          ? `Du vertrittst ${first}: ${range} (${VACATION_TYPE_LABEL[v.type]} genehmigt)`
          : `Stellvertretung für ${first} entfällt: ${label} ${range} abgelehnt`,
        `${fmtDaysDe(v.days)} · entschieden von ${actor.name}.`,
        actor.name,
      );
    }
  } catch (e) {
    console.warn('[Urlaub] Benachrichtigung zum Entscheid fehlgeschlagen:', (e as Error).message);
  }
}

// ─── Zurückziehen / Löschen ──────────────────────────────────────────────────

/**
 * Nach dem Zurückziehen/Löschen: Genehmiger:innen (bei offenem Antrag), Stellvertretung
 * und – wenn jemand anders gelöscht hat – die antragstellende Person per Glocke informieren.
 */
export async function notifyVacationWithdrawn(v: VacationRequest, opts: { actor: VacationActorInfo; approvers: Employee[] }): Promise<void> {
  try {
    const { actor, approvers } = opts;
    const requester = await getEmployee(v.employee_id);
    const first = firstName(requester?.name || 'Jemand');
    const range = fmtRangeDe(v.start_date, v.end_date);
    const label = VACATION_REQUEST_LABEL[v.type];
    const byRequester = actor.employee_id === v.employee_id;
    const title = byRequester
      ? `${first} hat den ${label} ${range} zurückgezogen`
      : `${label} von ${first} (${range}) wurde von ${actor.name} gelöscht`;

    const targets = new Set<string>();
    if (v.status === 'beantragt') for (const a of approvers) targets.add(a.id);
    if (v.substitute_id) targets.add(v.substitute_id);
    if (!byRequester && requester) targets.add(requester.id);
    if (actor.employee_id) targets.delete(actor.employee_id);
    for (const id of targets) {
      await bell(id, id === requester?.id ? `Deine Abwesenheit ${range} (${VACATION_TYPE_LABEL[v.type]}) wurde von ${actor.name} gelöscht` : title, '', actor.name);
    }
  } catch (e) {
    console.warn('[Urlaub] Benachrichtigung zum Zurückziehen fehlgeschlagen:', (e as Error).message);
  }
}
