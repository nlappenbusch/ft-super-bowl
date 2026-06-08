import { mkdir, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads', 'media');

export interface MediaItem {
  name: string;
  url: string;
  relativePath: string;
  size: number;
  updatedAt: string;
  source: 'upload' | 'public';
}

function isImageFile(fileName: string) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function toPublicUrl(relativePath: string) {
  return `/${relativePath.split(path.sep).join('/')}`;
}

async function collectMediaFiles(dirPath: string, rootPath: string): Promise<MediaItem[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        return collectMediaFiles(fullPath, rootPath);
      }

      if (!entry.isFile() || !isImageFile(entry.name)) {
        return [] as MediaItem[];
      }

      const fileStat = await stat(fullPath);
      const relativePath = path.relative(rootPath, fullPath);
      const normalizedRelativePath = relativePath.split(path.sep).join('/');

      const source: MediaItem['source'] = normalizedRelativePath.startsWith('uploads/media/') ? 'upload' : 'public';

      return [
        {
          name: entry.name,
          url: toPublicUrl(normalizedRelativePath),
          relativePath: normalizedRelativePath,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
          source
        }
      ];
    })
  );

  return files.flat();
}

export async function listMediaLibrary(): Promise<MediaItem[]> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const files = await collectMediaFiles(PUBLIC_DIR, PUBLIC_DIR);

  return files.sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'upload' ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension);

  const safeBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'media';

  return `${safeBaseName}${extension}`;
}

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('png')) return '.png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('avif')) return '.avif';
  if (ct.includes('svg')) return '.svg';
  if (ct.includes('gif')) return '.gif';
  return '.jpg';
}

/**
 * Lädt ein Remote-Bild herunter und speichert es lokal unter /public/uploads/media.
 * Gibt die lokale Public-URL zurück. Bereits lokale URLs (oder leere) werden
 * unverändert zurückgegeben.
 */
export async function localizeRemoteImage(url: string): Promise<string> {
  const trimmed = (url || '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return trimmed; // schon lokal / leer

  const res = await fetch(trimmed, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${trimmed}`);

  const contentType = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());

  let pathname = '/image';
  try { pathname = new URL(trimmed).pathname; } catch { /* ignore */ }
  const rawBase = path.basename(pathname) || 'image';
  let ext = path.extname(rawBase).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) ext = extFromContentType(contentType);

  const baseNoExt = path.basename(rawBase, path.extname(rawBase));
  const safeBase = sanitizeFileName(`${baseNoExt}${ext}`);

  await mkdir(UPLOADS_DIR, { recursive: true });
  const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalName = `${timeStamp}-${safeBase}`;
  const finalPath = path.join(UPLOADS_DIR, finalName);
  await writeFile(finalPath, buf);

  const relativePath = path.relative(PUBLIC_DIR, finalPath).split(path.sep).join('/');
  return toPublicUrl(relativePath);
}

export async function saveUploadedMedia(file: File): Promise<MediaItem> {
  const originalName = file.name || 'upload.bin';
  const extension = path.extname(originalName).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error('Nur Bilddateien sind erlaubt.');
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const safeName = sanitizeFileName(originalName);
  const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalName = `${timeStamp}-${safeName}`;
  const finalPath = path.join(UPLOADS_DIR, finalName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(finalPath, bytes);

  const fileStat = await stat(finalPath);
  const relativePath = path.relative(PUBLIC_DIR, finalPath).split(path.sep).join('/');

  return {
    name: finalName,
    url: toPublicUrl(relativePath),
    relativePath,
    size: fileStat.size,
    updatedAt: fileStat.mtime.toISOString(),
    source: 'upload'
  };
}