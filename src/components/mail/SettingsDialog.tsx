'use client';

/**
 * SettingsDialog — persönlich: Funktion (DE/EN), Mobilnummer, eigene Signatur, KI-Standardaktion.
 * Admins zusätzlich: Senden mit Vollzugriff, ausgeblendete Postfächer, Zusatzfreigaben.
 */
import { useEffect, useState } from 'react';
import { X, Save, Loader2, Settings, ShieldCheck, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { AccountsResponse, AssistMode, GlobalMailConfig, PersonalPrefs } from './types';
import { api } from './util';
import { ASSIST_MODES } from './Composer';

interface Props {
  accounts: AccountsResponse;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsDialog({ accounts, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'me' | 'admin'>('me');
  const [prefs, setPrefs] = useState<PersonalPrefs>(accounts.prefs);
  const [global, setGlobal] = useState<GlobalMailConfig | null>(accounts.admin?.global || null);
  const [sigLang, setSigLang] = useState<'de' | 'en'>('de');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [extra, setExtra] = useState({ person: '', mailbox: '', send: true });

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const sigKey = sigLang === 'en' ? 'en:*' : '*';
  const ownSig = prefs.signatures[sigKey] || '';
  const firstBox = accounts.mailboxes.find((m) => m.kind === 'own')?.address || accounts.mailboxes[0]?.address || '';
  const autoSig = accounts.signatures[sigLang]?.[firstBox] || '';

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api('prefs', { json: { personal: prefs, global: tab === 'admin' && global ? global : undefined } });
      onSaved(); onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-400';
  const people = accounts.employees.filter((e) => e.email);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 sm:p-6" onMouseDown={onClose}>
      <div className="flex h-full w-full max-w-[860px] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-5 py-3" style={{ borderColor: '#eef1f5' }}>
          <Settings className="h-5 w-5" style={{ color: '#d9531e' }} />
          <h2 className="flex-1 text-[15px] font-bold" style={{ color: '#143047' }}>Signatur &amp; Einstellungen</h2>
          {accounts.admin && (
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
              <button onClick={() => setTab('me')} className={`rounded-md px-3 py-1 ${tab === 'me' ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>Ich</button>
              <button onClick={() => setTab('admin')} className={`flex items-center gap-1 rounded-md px-3 py-1 ${tab === 'admin' ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}><ShieldCheck className="h-3.5 w-3.5" /> Team</button>
            </div>
          )}
          <button onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {tab === 'me' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-[11.5px] text-slate-500">Funktion (Deutsch)
                  <input className={input} style={{ borderColor: '#e3e8ef' }} value={prefs.title} onChange={(e) => setPrefs({ ...prefs, title: e.target.value })} placeholder="z. B. Office Manager" />
                </label>
                <label className="text-[11.5px] text-slate-500">Funktion (Englisch)
                  <input className={input} style={{ borderColor: '#e3e8ef' }} value={prefs.title_en} onChange={(e) => setPrefs({ ...prefs, title_en: e.target.value })} placeholder="z. B. Owner / CEO" />
                </label>
                <label className="text-[11.5px] text-slate-500">Mobil (optional)
                  <input className={input} style={{ borderColor: '#e3e8ef' }} value={prefs.phone} onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })} placeholder="+41 79 …" />
                </label>
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-slate-700">Signatur</span>
                  <div className="flex rounded-md bg-slate-100 p-0.5 text-[11.5px]">
                    {(['de', 'en'] as const).map((l) => (
                      <button key={l} onClick={() => setSigLang(l)} className={`rounded px-2 py-0.5 ${sigLang === l ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>{l.toUpperCase()}</button>
                    ))}
                  </div>
                  <span className="flex-1" />
                  {ownSig ? (
                    <button onClick={() => { const s = { ...prefs.signatures }; delete s[sigKey]; setPrefs({ ...prefs, signatures: s }); }} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800">
                      <RotateCcw className="h-3.5 w-3.5" /> Faltin-Standard verwenden
                    </button>
                  ) : (
                    <button onClick={() => setPrefs({ ...prefs, signatures: { ...prefs.signatures, [sigKey]: autoSig } })} className="text-[12px] text-slate-500 hover:text-slate-800">Eigene Signatur (HTML) bearbeiten</button>
                  )}
                </div>
                <p className="mb-2 text-[12px] text-slate-500">
                  Standard ist die Faltin-Signatur mit deinem Namen, deiner Funktion und deiner eigenen Adresse — auch wenn du aus kontakt@ schreibst (wie bisher in Outlook).
                  Bei Mails nur an Kolleginnen und Kollegen lässt der Client die Signatur automatisch weg.
                </p>
                {ownSig ? (
                  <textarea rows={8} className={`${input} font-mono text-[11.5px]`} style={{ borderColor: '#e3e8ef' }} value={ownSig}
                    onChange={(e) => setPrefs({ ...prefs, signatures: { ...prefs.signatures, [sigKey]: e.target.value } })} />
                ) : null}
                <div className="mt-2 rounded-xl border bg-white p-4" style={{ borderColor: '#eef1f5' }}>
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Vorschau{ownSig ? '' : ' (nach dem Speichern mit neuer Funktion/Nummer)'}</div>
                  <div dangerouslySetInnerHTML={{ __html: ownSig || autoSig }} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11.5px] text-slate-500">KI-Knopf im Editor macht standardmässig
                  <select className={input} style={{ borderColor: '#e3e8ef' }} value={prefs.assist_mode} onChange={(e) => setPrefs({ ...prefs, assist_mode: e.target.value as AssistMode })}>
                    {ASSIST_MODES.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-5 text-[13px] text-slate-700">
                  <input type="checkbox" checked={prefs.load_images} onChange={(e) => setPrefs({ ...prefs, load_images: e.target.checked })} />
                  Bilder in Mails automatisch laden
                </label>
              </div>
            </>
          ) : global ? (
            <>
              <label className="flex items-start gap-2 text-[13px] text-slate-700">
                <input type="checkbox" className="mt-0.5" checked={global.send_with_full_access} onChange={(e) => setGlobal({ ...global, send_with_full_access: e.target.checked })} />
                <span>Wer Vollzugriff auf ein Postfach hat, darf auch daraus senden
                  <span className="block text-[12px] text-slate-500">Sonst nur mit «Senden als»-Recht in Exchange. Die Rechte kommen direkt aus Exchange (Vollzugriff, Senden als) und werden alle 15 Minuten aktualisiert.</span>
                </span>
              </label>

              <div>
                <div className="mb-1 text-[12.5px] font-semibold text-slate-700">Postfächer im Client ausblenden</div>
                <div className="grid max-h-[220px] grid-cols-1 gap-x-4 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2" style={{ borderColor: '#eef1f5' }}>
                  {(accounts.admin?.tenantMailboxes || []).map((m) => (
                    <label key={m.address} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px] text-slate-700">
                      <input type="checkbox" checked={global.hidden.includes(m.address)}
                        onChange={(e) => setGlobal({ ...global, hidden: e.target.checked ? [...global.hidden, m.address] : global.hidden.filter((x) => x !== m.address) })} />
                      <span className="truncate">{m.name} <span className="text-slate-400">{m.address}</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[12.5px] font-semibold text-slate-700">Zusätzliche Freigaben (ohne Exchange-Recht)</div>
                <div className="space-y-1">
                  {Object.entries(global.extra_access).flatMap(([person, list]) => list.map((x) => (
                    <div key={`${person}|${x.mailbox}`} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12.5px]">
                      <span className="flex-1 truncate">{person} → {x.mailbox}{x.send ? ' (lesen + senden)' : ' (nur lesen)'}</span>
                      <button onClick={() => {
                        const next = { ...global.extra_access, [person]: list.filter((y) => y.mailbox !== x.mailbox) };
                        if (!next[person].length) delete next[person];
                        setGlobal({ ...global, extra_access: next });
                      }} className="rounded p-0.5 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="rounded-lg border px-2 py-1.5 text-[12.5px]" style={{ borderColor: '#e3e8ef' }} value={extra.person} onChange={(e) => setExtra({ ...extra, person: e.target.value })}>
                    <option value="">Person …</option>
                    {people.map((e) => <option key={e.id} value={e.email.toLowerCase()}>{e.name}</option>)}
                  </select>
                  <select className="rounded-lg border px-2 py-1.5 text-[12.5px]" style={{ borderColor: '#e3e8ef' }} value={extra.mailbox} onChange={(e) => setExtra({ ...extra, mailbox: e.target.value })}>
                    <option value="">Postfach …</option>
                    {(accounts.admin?.tenantMailboxes || []).map((m) => <option key={m.address} value={m.address}>{m.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-[12.5px]"><input type="checkbox" checked={extra.send} onChange={(e) => setExtra({ ...extra, send: e.target.checked })} /> senden</label>
                  <button disabled={!extra.person || !extra.mailbox} onClick={() => {
                    const cur = (global.extra_access[extra.person] || []).filter((x) => x.mailbox !== extra.mailbox);
                    setGlobal({ ...global, extra_access: { ...global.extra_access, [extra.person]: [...cur, { mailbox: extra.mailbox, send: extra.send }] } });
                    setExtra({ person: '', mailbox: '', send: true });
                  }} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12.5px] disabled:opacity-40" style={{ borderColor: '#e3e8ef' }}>
                    <Plus className="h-3.5 w-3.5" /> Hinzufügen
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {err && <div className="text-[12.5px] text-red-600">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: '#eef1f5' }}>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-100">Abbrechen</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#d9531e' }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
