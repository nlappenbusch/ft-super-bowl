#!/usr/bin/env python3
"""
seed-nations-league.py
──────────────────────────────────────────────────────────────────────────────
Befüllt das Spielplan-Modul des bestehenden Events "uefa-nations-league-2026"
(Serie: uefa-nations-league) mit den kompletten 156 Ligaphase-Paarungen der
UEFA Nations League 2026/27 – als saubere Content-Daten im data-seed/-Volume,
entsprechend den anderen Events/Modulen.

Single Source of Truth ist src/lib/nationsLeague.ts (dieselben, validierten
Fixtures wie auf der SEO-Landingpage). Das Skript ist idempotent: der Spielplan
wird bei jedem Lauf frisch aus der TS-Datei erzeugt und ersetzt.

Ausführen auf dem HOST (nicht in der Sandbox – dort ist der Mount schreibgeschützt):

    python3 scripts/seed-nations-league.py

Danach data-seed/events.json + data-seed/SEED_VERSION committen und pushen.
"""
import json
import os
import re
import sys
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = os.path.join(ROOT, "src", "lib", "nationsLeague.ts")
SEED_DIR = os.path.join(ROOT, "data-seed")
EVENTS = os.path.join(SEED_DIR, "events.json")
SEED_VERSION = os.path.join(SEED_DIR, "SEED_VERSION")
EVENT_SLUG = "uefa-nations-league-2026"

WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]  # Montag=0


def parse_fixtures():
    """Liest Ligen/Gruppen/Fixtures aus src/lib/nationsLeague.ts."""
    src = open(TS, encoding="utf-8").read()
    # League-Blöcke: id: 'A', name: 'League A', ... groups: [ ... ]
    leagues = re.findall(r"id:\s*'([A-D])',\s*name:\s*'([^']+)'", src)
    league_name = {lid: name for lid, name in leagues}
    rows = []
    for gid, fx_raw in re.findall(
        r"id:\s*'([A-D]\d)',\s*teams:\s*\[[^\]]*\],\s*fixtures:\s*\[(.*?)\]\s*\}", src, re.S
    ):
        lid = gid[0]
        for md, iso, home, away in re.findall(
            r"f\(\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)", fx_raw
        ):
            rows.append({
                "league": lid, "league_name": league_name.get(lid, f"League {lid}"),
                "group": gid, "md": int(md), "iso": iso, "home": home, "away": away,
            })
    return rows


def de_date(iso: str) -> str:
    d = datetime.strptime(iso, "%Y-%m-%d").date()
    return f"{WD[d.weekday()]}. {d.strftime('%d.%m.%Y')}"


def to_spielplan(rows):
    rows = sorted(rows, key=lambda r: (r["iso"], r["group"], r["home"]))
    out = []
    for r in rows:
        out.append({
            "date": de_date(r["iso"]),
            "session": f"Gruppe {r['group']}",
            "matchup": f"{r['home']} – {r['away']}",
            "round": f"{r['league_name']} · Spieltag {r['md']}",
        })
    return out


def bump_seed_version():
    cur = ""
    if os.path.exists(SEED_VERSION):
        cur = open(SEED_VERSION, encoding="utf-8").read().strip()
    today = date.today().strftime("%Y-%m-%d")
    # Format wie bestehend: <datum>-<n>. Wenn heute schon vorhanden, n hochzählen.
    n = 1
    m = re.match(rf"{re.escape(today)}-(\d+)$", cur)
    if m:
        n = int(m.group(1)) + 1
    new = f"{today}-{n}"
    open(SEED_VERSION, "w", encoding="utf-8").write(new + "\n")
    return cur, new


def main():
    if not os.path.exists(EVENTS):
        sys.exit(f"FEHLER: {EVENTS} nicht gefunden. Vom Repo-Root ausführen.")
    rows = parse_fixtures()
    if len(rows) != 156:
        sys.exit(f"FEHLER: {len(rows)} Fixtures geparst (erwartet 156). Abbruch.")
    spielplan = to_spielplan(rows)

    events = json.load(open(EVENTS, encoding="utf-8"))
    target = next((e for e in events if e.get("slug") == EVENT_SLUG), None)
    if target is None:
        sys.exit(f"FEHLER: Event '{EVENT_SLUG}' nicht in events.json gefunden.")

    before = len(target.get("spielplan") or [])
    target["spielplan"] = spielplan
    target["show_spielplan"] = True

    # Formatierung wie im Bestand (JSON.stringify(…, null, 2)): 2 Spaces, rohe Umlaute.
    with open(EVENTS, "w", encoding="utf-8") as fh:
        json.dump(events, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    old, new = bump_seed_version()
    print(f"✓ Event '{EVENT_SLUG}': Spielplan {before} → {len(spielplan)} Paarungen gesetzt, show_spielplan=true")
    print(f"✓ SEED_VERSION: {old!r} → {new!r}")
    print("→ Jetzt data-seed/events.json + data-seed/SEED_VERSION committen & pushen.")


if __name__ == "__main__":
    main()
