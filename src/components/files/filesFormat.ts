/** Anzeige-Helfer für Faltin Files (Client und Server). */

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  if (i === 0) return `${Math.max(1, Math.round(n / 1024 * 10) / 10)} KB`;
  return `${v >= 100 || i === 1 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '').replace('.', ',')} ${u[i]}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "vor 3 Std.", "gestern", "vor 4 Tagen" */
export function fmtAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d === 1) return 'gestern';
  if (d < 30) return `vor ${d} Tagen`;
  return `am ${fmtDate(iso)}`;
}

export type ExpiryTone = 'ok' | 'soon' | 'urgent' | 'gone';

/** Restlaufzeit als Text + Ampel. */
export function expiryInfo(iso: string, now = Date.now()): { label: string; tone: ExpiryTone; days: number } {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { label: 'abgelaufen', tone: 'gone', days: 0 };
  const hours = ms / 3_600_000;
  const days = Math.ceil(hours / 24);
  let label: string;
  if (hours < 1) label = 'läuft in < 1 Std. ab';
  else if (hours < 24) label = `noch ${Math.ceil(hours)} Std.`;
  else if (days === 1) label = 'noch 1 Tag';
  else label = `noch ${days} Tage`;
  const tone: ExpiryTone = hours < 24 ? 'urgent' : days <= 7 ? 'soon' : 'ok';
  return { label, tone, days };
}

export function fileKind(name: string, mime = ''): 'image' | 'pdf' | 'video' | 'audio' | 'archive' | 'sheet' | 'doc' | 'slides' | 'other' {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg', 'avif'].includes(ext)) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slides';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'].includes(ext)) return 'doc';
  return 'other';
}
