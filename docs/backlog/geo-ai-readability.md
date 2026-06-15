# Feature Request: GEO / KI-Lesbarkeit pushen (SSR-Fakten, strukturierte Daten, llms.txt)

**Status:** offen · **Priorität:** hoch (Sichtbarkeits-Hebel) · **Bereich:** SEO / AI Discoverability

## Ziel
Die Inhalte von next.faltintravel.com maximal **maschinen-/KI-lesbar** machen, damit sie sowohl
in der klassischen Google-Suche als auch in **KI-Antwortmaschinen** (AI Overviews, ChatGPT-Suche,
Perplexity, Claude etc.) zuverlässig auftauchen.

## Hintergrund
KI-Crawler (GPTBot, ClaudeBot, PerplexityBot …) **führen in der Regel kein JavaScript aus** – sie
lesen nur rohes HTML. Googlebot rendert JS, bevorzugt aber serverseitiges HTML. Inhalte, die nur
client-seitig gerendert werden (z. B. aktuell die **Package-/Preis-Karten**), sind damit für die
wachsende KI-Suche praktisch unsichtbar.

## Umfang (Tasks)
1. **Paket-/Preis-/Ticket-Inhalte serverseitig rendern**
   - Kernfakten (Paketname, Preis ab, Leistungen, Nächte, Hotel) im SSR-HTML ausgeben –
     nicht nur in Client-Komponenten (`PackageCardPro` etc.).
   - Alternativ/ergänzend: pro Paket `Product` + `Offer` als JSON-LD.
   - **Akzeptanz:** `curl` auf eine Event-Seite zeigt Paketnamen + Preise im HTML.
2. **Strukturierte Daten (schema.org JSON-LD) breit ausspielen**
   - `Event` (Event-Seiten), `Product`/`Offer` (Packages), `FAQPage` (FAQ-Modul),
     `BreadcrumbList` (Breadcrumbs), ggf. `Organization` global.
   - **Akzeptanz:** Rich-Results-Test / Schema-Validator ohne Fehler für je 1 Beispielseite.
3. **`llms.txt` ergänzen**
   - `/llms.txt` mit kuratierter Übersicht der wichtigsten Seiten/Inhalte (Events, Serien, Kontakt)
     für KI-Crawler. Optional `/llms-full.txt` mit ausführlicherem Abriss.
   - **Akzeptanz:** `https://next.faltintravel.com/llms.txt` liefert valide Markdown-Liste.
4. **FAQ & SEO-Texte konsequent pflegen (per KI-Tool)**
   - Mit dem KI-Redaktions-Assistenten je Event FAQ + SEO-Text füllen; klar beantwortete Fragen
     sind ideales Futter für Antwortmaschinen.
   - **Akzeptanz:** alle aktiven Events haben FAQ (>=4) und einen SEO-Text.

## Nice-to-have
- `robots.txt` bewusst für KI-Crawler konfigurieren (erlauben/zulassen, wo gewollt).
- Sitemap(s) vollständig & aktuell halten.
- Saubere, semantische Überschriftenstruktur (H1/H2) pro Modul.

## Referenzen
- AI-Crawler rendern kein JS: https://www.asklantern.com/blogs/ai-crawlers-do-not-render-javascript
- LLMs & JS-Rendering 2026: https://www.clickrank.ai/llms-render-javascript/
- llms.txt-Konvention: https://llmstxt.org
