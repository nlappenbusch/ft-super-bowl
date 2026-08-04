/**
 * /api/admin/files — Mediathek (TASK-00120)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET     Inventar aller auf dem Server gespeicherten Dateien (alle Ablagen).
 * POST    Datei hochladen (multipart, Feld "file"):
 *           Bilder  → public/uploads/media   (öffentliche URL /uploads/media/…)
 *           PDF     → data/uploads/auto-reply (öffentliche URL /dokumente/…)
 * DELETE  ?file=<name> löscht einen Auto-Antwort-Anhang — nur wenn er in
 *         keinem Event mehr referenziert ist (Schutz vor kaputten Mailanhängen).
 *
 * Auth: greift die Middleware (alles unter /api/admin/* erfordert Session).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { NextResponse } from 'next/server';
import { deleteAutoReplyPdf, saveAutoReplyPdf, autoReplyPublicPath } from '@/lib/autoReplyStore';
import { saveUploadedMedia } from '@/lib/mediaLibrary';
import { listFileInventory } from '@/lib/fileInventory';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

export async function GET() {
  try {
    const inventory = await listFileInventory();
    return NextResponse.json({ success: true, data: inventory });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Keine Datei erhalten.' }, { status: 400 });
    }

    // Bilder in die Bild-Mediathek (werden optimiert), alles andere als Dokument.
    const target = (formData.get('target') as string | null) || (IMAGE_EXT.test(file.name) ? 'bild' : 'dokument');

    if (target === 'bild') {
      const item = await saveUploadedMedia(file);
      return NextResponse.json({
        success: true,
        data: { kind: 'bild', name: item.name, url: item.url, size: item.size },
      });
    }

    const meta = await saveAutoReplyPdf(file);
    return NextResponse.json({
      success: true,
      data: { kind: 'anhang', name: meta.name, url: autoReplyPublicPath(meta.file), size: meta.size },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file') || '';
    if (!fileName) {
      return NextResponse.json({ success: false, error: 'Parameter "file" fehlt.' }, { status: 400 });
    }

    const inventory = await listFileInventory();
    const entry = inventory.files.find((f) => f.kind === 'anhang' && f.fileName === fileName);

    if (!entry) {
      return NextResponse.json({ success: false, error: 'Datei nicht gefunden.' }, { status: 404 });
    }
    if (entry.usedIn.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Datei wird noch verwendet (${entry.usedIn.map((u) => u.label).join(', ')}). Erst im Event entfernen.`,
        },
        { status: 409 }
      );
    }

    await deleteAutoReplyPdf(fileName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
