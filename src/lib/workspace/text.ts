/** workspace/text.ts — kleine Text-Helfer (HTML→Text, Kürzen mit sichtbarem Hinweis). */

export function htmlToText(html: string): string {
  return (html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Kürzt auf max Zeichen und markiert die Kürzung ausdrücklich (nie still abschneiden). */
export function clip(text: string, max: number): string {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max)}\n[… gekürzt, ${text.length - max} weitere Zeichen]`;
}
