# Custom 502-Page für Nginx Proxy Manager

Gebrandete Wartungsseite (Faltin Travel Style) mit direkten Kontaktdaten.
Wird angezeigt, wenn der App-Server nicht erreichbar ist (z. B. während eines Deployments).
Die Seite prüft alle 8 Sekunden per HEAD-Request, ob die Site wieder online ist, und lädt dann automatisch neu.

## Schnellste Variante: Install-Script

Beide Dateien auf die NPM-VM kopieren und dort ausführen:

```bash
scp 502.html install-502-page.sh user@npm-vm:~/
ssh user@npm-vm
chmod +x install-502-page.sh
sudo ./install-502-page.sh
```

Das Script findet den NPM-Container und das data-Volume automatisch, legt vorher
ein Backup an (`<npm-data>/backup-ft502-<timestamp>/`), installiert Seite + Snippet
über `nginx/custom/server_proxy.conf` (gilt für **alle** Proxy Hosts), testet die
Config mit `nginx -t` und rollt bei Fehlern automatisch zurück. Mehrfach ausführbar –
bei Updates der 502.html einfach erneut laufen lassen.

Soll die Seite nur für **einen** Host gelten: Script nicht nutzen, sondern manuell
einrichten (siehe unten, Snippet in den Advanced-Tab des Hosts).

## Manuelle Einrichtung (NPM auf separatem Server)

### 1. Datei auf den NPM-Server kopieren

In das NPM-Datenverzeichnis (das Volume, das im Container als `/data` gemountet ist):

```bash
# auf dem NPM-Server, Pfad ggf. anpassen (siehe docker-compose des NPM)
mkdir -p /pfad/zum/npm/data/error-pages
scp 502.html npm-server:/pfad/zum/npm/data/error-pages/502.html
```

Im Container liegt sie dann unter `/data/error-pages/502.html` – kein Rebuild/Restart nötig.

### 2. Proxy Host konfigurieren

NPM UI → Proxy Host (faltintravel.com) → **Edit** → Tab **Advanced** → einfügen:

```nginx
proxy_intercept_errors on;
error_page 502 503 504 @ft_maintenance;

location @ft_maintenance {
    root /data/error-pages;
    rewrite ^ /502.html break;
    add_header Cache-Control "no-store" always;
}
```

Speichern – gilt sofort.

## Hinweise

- Greift bei **502/503/504**: Container down, Deployment läuft, App antwortet nicht.
- `proxy_intercept_errors on` fängt zusätzlich 502/503/504 ab, die die App selbst
  zurückgibt (z. B. Next.js beim Hochfahren). Wenn die App eigene Fehlerseiten
  für diese Codes ausliefern soll, Zeile entfernen – bei "Server weg" greift
  `error_page` trotzdem.
- `Cache-Control: no-store` verhindert, dass Browser/Proxies die Wartungsseite cachen.
- Logo, Farben und Kontaktdaten sind inline eingebettet – die Seite ist eine
  einzige Datei ohne externe Abhängigkeiten und funktioniert auch komplett offline
  vom App-Server.
- Test: App-Container kurz stoppen (`docker compose stop app`) und Domain aufrufen.

## Kontaktdaten in der Seite

+41 44 700 22 77 · +41 44 740 33 27 · info@faltintravel.com ·
Mo–Fr 08:00–18:00 · Riedthofstrasse 172, CH-8105 Regensdorf

Bei Änderungen direkt in `502.html` anpassen (im `<body>`, gut auffindbar).
