export function toCategorySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ae|oe|ue/g, (match) => match)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
