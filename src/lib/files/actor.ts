/** files/actor.ts — aktuelle Person aus der Session (für "erstellt von"/"gelöscht von"). */
import { getSession } from '../serverSession';
import type { Actor } from './store';

export async function currentActor(): Promise<Actor | null> {
  const s = await getSession();
  if (!s) return null;
  return { id: s.sub, name: s.name || s.email || 'Unbekannt', email: s.email };
}
