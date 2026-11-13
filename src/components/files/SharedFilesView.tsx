'use client';

/** Öffentliche Download-Ansicht eines Faltin-Files-Links (/s/[token]). */
import { useState } from 'react';
import Image from 'next/image';
import { Download, Lock, LoaderCircle, Eye, Clock, Archive, FileImage, FileText, FileVideo, FileAudio, FileArchive, FileSpreadsheet, File as FileIcon, Presentation, ShieldCheck } from 'lucide-react';
import { fmtBytes, fmtDate, fileKind, expiryInfo } from './filesFormat';

const NAVY = '#143047';
const ACCENT = '#d9531e';

interface ViewItem { id: string; name: string; size: number; mime: string }
interface View { title: string; message: string; sender: string; expires_at: string; total_size: number; zip: boolean; items: ViewItem[]; count: number }
interface Company { name: string; phone: string; email: string; website: string }

const PREVIEWABLE = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|video\/mp4|text\/plain)$/i;

function KindIcon({ name, mime }: { name: string; mime: string }) {
  const k = fileKind(name, mime);
  const map = { image: FileImage, pdf: FileText, video: FileVideo, audio: FileAudio, archive: FileArchive, sheet: FileSpreadsheet, slides: Presentation, doc: FileText, other: FileIcon };
  const color = { image: '#7c3aed', pdf: '#dc2626', video: '#0891b2', audio: '#db2777', archive: '#a16207', sheet: '#16a34a', slides: '#ea580c', doc: '#2563eb', other: '#64748b' }[k];
  const I = map[k];
  return <I className="h-6 w-6" style={{ color }} />;
}

function Shell({ children, company }: { children: React.ReactNode; company: Company }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'linear-gradient(180deg, #143047 0, #143047 260px, #f5f7fa 260px)' }}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-6 sm:px-6">
        <Image src="/faltin-logo.svg" alt="Faltin Travel" width={124} height={40} priority />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Files</span>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-xs text-slate-500 sm:px-6">
        {company.name} · {company.phone} · <a className="underline" href={`mailto:${company.email}`}>{company.email}</a> · <a className="underline" href={`https://${company.website.replace(/^https?:\/\//, '')}`}>{company.website}</a>
      </footer>
    </div>
  );
}

export default function SharedFilesView({ token, state, share, company }: {
  token: string; state: 'ok' | 'locked' | 'expired' | 'missing'; share?: View; company: Company;
}) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (state === 'expired' || state === 'missing' || !share) {
    return (
      <Shell company={company}>
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl sm:p-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#f1f5f9' }}>
            <Clock className="h-7 w-7 text-slate-500" />
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: NAVY }}>{state === 'expired' ? 'Dieser Link ist abgelaufen' : 'Link nicht gefunden'}</h1>
          <p className="mx-auto mt-2 max-w-md text-slate-600">
            {state === 'expired'
              ? 'Die Dateien wurden aus Datenschutzgründen automatisch gelöscht. Bitte wenden Sie sich an Ihre Ansprechperson bei Faltin Travel, wenn Sie sie erneut benötigen.'
              : 'Bitte prüfen Sie, ob der Link vollständig kopiert wurde.'}
          </p>
          <a href={`mailto:${company.email}`} className="mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: ACCENT }}>Kontakt aufnehmen</a>
        </div>
      </Shell>
    );
  }

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/s/${token}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || 'Passwort falsch');
      window.location.reload();
    } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  };

  const exp = expiryInfo(share.expires_at);
  const heading = share.title || (share.count === 1 ? share.items[0]?.name : 'Dateien für Sie') || 'Dateien für Sie';

  return (
    <Shell company={company}>
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="p-6 sm:p-8">
          <div className="text-sm font-semibold" style={{ color: ACCENT }}>{share.sender} von Faltin Travel hat Ihnen {share.count === 1 ? 'eine Datei' : `${share.count} Dateien`} gesendet</div>
          <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: NAVY }}>{heading}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>{fmtBytes(share.total_size)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> verfügbar bis {fmtDate(share.expires_at)}{exp.tone !== 'ok' && ` (${exp.label})`}</span>
          </div>
          {share.message && (
            <div className="mt-5 whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-slate-700" style={{ background: '#f5f7fa' }}>{share.message}</div>
          )}
        </div>

        {state === 'locked' ? (
          <form onSubmit={unlock} className="border-t px-6 py-8 sm:px-8" style={{ borderColor: '#eef1f5' }}>
            <div className="mx-auto max-w-sm text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#fdf0ea' }}>
                <Lock className="h-6 w-6" style={{ color: ACCENT }} />
              </div>
              <div className="font-bold" style={{ color: NAVY }}>Diese Dateien sind passwortgeschützt</div>
              <p className="mb-4 text-sm text-slate-500">Das Passwort haben Sie separat von uns erhalten.</p>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus placeholder="Passwort"
                className="w-full rounded-xl border px-4 py-3 text-center outline-none focus:ring-2" style={{ borderColor: '#e5e8ed', color: NAVY }} />
              {err && <div className="mt-2 text-sm font-semibold text-red-600">{err}</div>}
              <button disabled={busy || !pw} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white disabled:opacity-60" style={{ background: ACCENT }}>
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Öffnen
              </button>
            </div>
          </form>
        ) : (
          <>
            {share.zip && (
              <div className="px-6 sm:px-8">
                <a href={`/api/s/${token}/zip`} className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-bold text-white shadow-sm transition hover:opacity-95" style={{ background: ACCENT }}>
                  <Archive className="h-5 w-5" /> Alle herunterladen <span className="font-normal opacity-80">(ZIP, {fmtBytes(share.total_size)})</span>
                </a>
              </div>
            )}
            <ul className="mt-4 divide-y divide-slate-100 border-t" style={{ borderColor: '#eef1f5' }}>
              {share.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-6 py-3.5 sm:px-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: '#f5f7fa' }}>
                    <KindIcon name={it.name} mime={it.mime} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold" style={{ color: NAVY }} title={it.name}>{it.name}</div>
                    <div className="text-xs text-slate-500">{fmtBytes(it.size)}</div>
                  </div>
                  {PREVIEWABLE.test(it.mime) && (
                    <a href={`/api/s/${token}/${it.id}?inline=1`} target="_blank" rel="noreferrer" className="hidden rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 sm:inline-flex" title="Ansehen">
                      <Eye className="h-5 w-5" />
                    </a>
                  )}
                  <a href={`/api/s/${token}/${it.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition"
                    style={share.count === 1 ? { background: ACCENT, color: '#fff' } : { background: '#f1f5f9', color: NAVY }}>
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Herunterladen</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Sicher übertragen · wird am {fmtDate(share.expires_at)} automatisch gelöscht
      </p>
    </Shell>
  );
}
