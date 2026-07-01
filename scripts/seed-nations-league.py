#!/usr/bin/env python3
"""
seed-nations-league.py  (aufräumend)
──────────────────────────────────────────────────────────────────────────────
Die UEFA-Nations-League-Fixtures leben jetzt als CODE (src/lib/nationsLeague.ts +
Komponente NationsLeagueFixtures) und werden auf der SEO-Landingpage
/uefa-nations-league-2026-27 gerendert – NICHT mehr im Content-Seed.

Dieses Skript räumt daher den früher (fälschlich, mit „Gruppe" als Spielort)
befüllten Spielplan am Event `uefa-nations-league-2026` in data-seed/ wieder auf:
setzt spielplan=[] und show_spielplan=false. So bekommen frische Volumes das Event
sauber ohne das generische Spielplan-Modul.

Wichtig: Der LIVE-Server behält den alten Spielplan im Volume (der additive Seed
überschreibt bestehende Einträge bewusst nicht). Dort einmalig im Admin beim Event
„Spielplan anzeigen" ausschalten.

Auf dem HOST ausführen:  python3 scripts/seed-nations-league.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS = os.path.join(ROOT, "data-seed", "events.json")
EVENT_SLUG = "uefa-nations-league-2026"


def main():
    if not os.path.exists(EVENTS):
        sys.exit(f"FEHLER: {EVENTS} nicht gefunden. Vom Repo-Root ausführen.")
    events = json.load(open(EVENTS, encoding="utf-8"))
    target = next((e for e in events if e.get("slug") == EVENT_SLUG), None)
    if target is None:
        sys.exit(f"FEHLER: Event '{EVENT_SLUG}' nicht in events.json gefunden.")

    before = len(target.get("spielplan") or [])
    target["spielplan"] = []
    target["show_spielplan"] = False

    with open(EVENTS, "w", encoding="utf-8") as fh:
        json.dump(events, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"✓ Event '{EVENT_SLUG}': Spielplan {before} → 0 geleert, show_spielplan=false (in data-seed).")
    print("→ Live-Server: im Admin beim Event 'Spielplan anzeigen' ausschalten (einmalig).")


if __name__ == "__main__":
    main()
