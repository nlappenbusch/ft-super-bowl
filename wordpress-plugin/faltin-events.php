<?php
/**
 * Plugin Name: Faltin Travel – Event Shortcodes
 * Description: SEO-freundliche, serverseitig gerenderte Event-Karten, Package-Karten + natives Anfrageformular. Shortcodes: [faltin_events serie="..."], [faltin_event event="..."], [faltin_packages event="..."], [faltin_anfrage event="..."].
 * Version: 1.8.2
 * Author: Faltin Travel AG
 *
 * 1.8.0: Deploy-/Ausfall-Fallback: (1) Letzter guter API-Stand wird 7 Tage als
 *        Backup-Transient vorgehalten und bei nicht erreichbarer Plattform
 *        (z.B. während eines Deploys) ausgeliefert. (2) Ist gar kein Stand da,
 *        erscheint statt einer Fehlermeldung ein freundlicher Hinweis
 *        ("Unser Buchungsmodul wird gerade aktualisiert") mit den direkten
 *        Kontaktdaten. (3) Schlägt das Absenden des Anfrageformulars fehl,
 *        zeigt es denselben Hinweis inkl. Telefon/E-Mail.
 *
 * 1.7.1: [faltin_anfrage] ohne name="…" zeigt nicht mehr den rohen Slug
 *        ("karneval-in-rio-2026"), sondern einen lesbaren Eventnamen
 *        ("Karneval in Rio 2026") im Intro-Text an.
 *
 * Die Inhalte werden serverseitig per REST-API geladen (wp_remote_get) und als
 * echtes HTML ausgegeben – kein iframe, kein Client-JS nötig. Google sieht die
 * Inhalte und Links direkt. Ergebnisse werden 10 Minuten gecacht (Transient).
 *
 * Shortcodes:
 *   [faltin_events serie="darts-wm" limit="6" columns="3"]
 *   [faltin_event event="super-bowl-lxi-2027"]
 *   [faltin_packages event="super-bowl-2027"]  – Package-Karten; ohne Packages → Anfrageformular
 *
 * Ab 1.5.0 gilt dieselbe Logik auch für [faltin_anfrage]: hat das Event
 * buchbare Packages, werden automatisch die Package-Karten ausgeliefert —
 * bestehende Einbettungen wie [faltin_anfrage event="americas-cup-2024"
 * name="America's Cup 2024"] bleiben unverändert gültig. Mit packages="0"
 * lässt sich das reine Formular erzwingen.
 *
 * Optionale Parameter:
 *   api_url   – Basis-URL des Systems (Default: https://next.faltintravel.com)
 *   cache     – Cache-Dauer in Sekunden (0 = aus, Default 600)
 *   cta       – Button-Text (Default "Zum Event")
 */

if (!defined('ABSPATH')) exit;

define('FALTIN_EVENTS_DEFAULT_API', 'https://next.faltintravel.com');

/* ─── Daten laden (mit Transient-Cache) ──────────────────────────────────── */

/** Plattform als nicht erreichbar markiert? (gesetzt für 90 s nach einem Fetch-Fehler) */
function faltin_api_is_down() {
    return (bool) get_transient('faltin_api_down');
}

function faltin_events_fetch($url, $cache_seconds = 600) {
    $key = 'faltin_ev_' . md5($url);
    if ($cache_seconds > 0) {
        $cached = get_transient($key);
        if ($cached !== false) return $cached;
    }
    // Plattform als down markiert → gar nicht erst anfragen. So zeigen ALLE
    // Shortcodes konsistent die Wartungsbox und die API wird nicht gehämmert.
    if (faltin_api_is_down()) return null;
    $res = wp_remote_get($url, array('timeout' => 10));
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
        // Plattform gerade nicht erreichbar (z.B. Deploy) → KEIN Stale-Inhalt:
        // gecachte Karten würden mit kaputten (hotverlinkten) Bildern und
        // funktionslosen Formularen erscheinen. Stattdessen Wartungsbox.
        set_transient('faltin_api_down', 1, 90); // nach 90 s automatisch neuer Versuch
        return null;
    }
    $json = json_decode(wp_remote_retrieve_body($res), true);
    if (empty($json['success'])) return null;
    $data = $json['data'];
    if ($cache_seconds > 0) set_transient($key, $data, $cache_seconds);
    return $data;
}

/* ─── Wartungshinweis (Plattform nicht erreichbar, kein Cache-Stand) ─────── */

function faltin_events_maintenance_box() {
    return '<div class="ft-maintenance" style="margin:16px 0;padding:22px 24px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc">'
        . '<p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#143047 !important">Unser Buchungsmodul wird gerade aktualisiert.</p>'
        . '<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#3f5468 !important">Es ist in wenigen Augenblicken wieder erreichbar – laden Sie die Seite einfach gleich neu. In dringenden Fällen sind wir direkt für Sie da:</p>'
        . '<div style="display:flex;flex-wrap:wrap;gap:10px 26px;font-size:14px;color:#143047 !important">'
        . '<span style="white-space:nowrap">&#128222; <a href="tel:+41447002277" style="color:#143047 !important;text-decoration:none;font-weight:600">+41 44 700 22 77</a></span>'
        . '<span style="white-space:nowrap">&#128222; <a href="tel:+41447403327" style="color:#143047 !important;text-decoration:none;font-weight:600">+41 44 740 33 27</a></span>'
        . '<span style="white-space:nowrap">&#9993;&#65039; <a href="mailto:info@faltintravel.com" style="color:#143047 !important;text-decoration:none;font-weight:600">info@faltintravel.com</a></span>'
        . '<span style="white-space:nowrap">&#128340; Mo&#8211;Fr, 08:00&#8211;18:00 Uhr</span>'
        . '</div></div>';
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function faltin_events_format_daterange($start, $end) {
    if (!$start) return '';
    $months = array(1=>'Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember');
    $s = date_create($start);
    if (!$s) return '';
    $e = $end ? date_create($end) : null;
    if ($e && $e != $s) {
        if ($s->format('Y-m') === $e->format('Y-m')) {
            return $s->format('j.') . '–' . $e->format('j.') . ' ' . $months[(int)$e->format('n')] . ' ' . $e->format('Y');
        }
        return $s->format('j.') . ' ' . $months[(int)$s->format('n')] . ' – ' . $e->format('j.') . ' ' . $months[(int)$e->format('n')] . ' ' . $e->format('Y');
    }
    return $s->format('j.') . ' ' . $months[(int)$s->format('n')] . ' ' . $s->format('Y');
}

/** Markenkonforme Styles – einmal pro Seite. */
function faltin_events_styles() {
    static $done = false;
    if ($done) return '';
    $done = true;
    return '<style>
.ft-ev-grid{display:grid;gap:24px;margin:8px 0}
.ft-ev-grid.cols-2{grid-template-columns:repeat(2,1fr)}
.ft-ev-grid.cols-3{grid-template-columns:repeat(3,1fr)}
.ft-ev-grid.cols-4{grid-template-columns:repeat(4,1fr)}
@media(max-width:900px){.ft-ev-grid.cols-3,.ft-ev-grid.cols-4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.ft-ev-grid{grid-template-columns:1fr!important}}
.ft-ev-card{display:flex;flex-direction:column;background:#fff;border:1px solid #e5e8ed;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(20,48,71,.08);transition:transform .15s ease,box-shadow .15s ease;text-decoration:none!important}
.ft-ev-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(20,48,71,.14)}
.ft-ev-img{position:relative;aspect-ratio:16/9;background:#143047;overflow:hidden}
.ft-ev-img img{width:100%;height:100%;object-fit:cover;display:block}
.ft-ev-date{position:absolute;top:12px;left:12px;background:#d9531e;color:#fff!important;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:.2px}
.ft-ev-body{display:flex;flex-direction:column;flex:1;padding:20px 22px 22px}
.ft-ev-card .ft-ev-title,.ft-ev-single .ft-ev-title{margin:0 0 6px;font-size:19px;line-height:1.3;font-weight:800;color:#143047!important}
.ft-ev-card .ft-ev-loc,.ft-ev-single .ft-ev-loc{margin:0 0 10px;font-size:13px;color:#6b7280!important}
.ft-ev-card .ft-ev-desc,.ft-ev-single .ft-ev-desc{margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ft-ev-cta{margin-top:auto;align-self:flex-start;background:#d9531e;color:#fff!important;font-size:14px;font-weight:700;padding:10px 22px;border-radius:10px;text-decoration:none!important;transition:opacity .15s}
.ft-ev-card:hover .ft-ev-cta{opacity:.9}
.ft-ev-single{display:grid;grid-template-columns:5fr 4fr;gap:0;background:#fff;border:1px solid #e5e8ed;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(20,48,71,.08);margin:8px 0}
@media(max-width:700px){.ft-ev-single{grid-template-columns:1fr}}
.ft-ev-single .ft-ev-img{aspect-ratio:auto;min-height:240px}
.ft-ev-single .ft-ev-body{padding:28px 30px}
.ft-ev-single .ft-ev-title{font-size:24px}
.ft-ev-error{font-size:13px;color:#9ca3af;font-style:italic}
</style>';
}

/** JSON-LD (schema.org SportsEvent) für SEO. */
function faltin_events_jsonld($events) {
    $items = array();
    foreach ($events as $e) {
        $item = array(
            '@type' => 'SportsEvent',
            'name' => $e['name'] ?: $e['title'],
            'url' => $e['url'],
        );
        if (!empty($e['start_date'])) $item['startDate'] = $e['start_date'];
        if (!empty($e['end_date'])) $item['endDate'] = $e['end_date'];
        if (!empty($e['hero_image'])) $item['image'] = $e['hero_image'];
        if (!empty($e['description'])) $item['description'] = wp_strip_all_tags($e['description']);
        if (!empty($e['venue']) || !empty($e['location_city'])) {
            $item['location'] = array(
                '@type' => 'Place',
                'name' => $e['venue'] ?: $e['location_city'],
                'address' => trim(($e['location_city'] ?? '') . ', ' . ($e['location_country'] ?? ''), ', '),
            );
        }
        $items[] = $item;
    }
    if (!$items) return '';
    $ld = array('@context' => 'https://schema.org', '@graph' => $items);
    return '<script type="application/ld+json">' . wp_json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
}

/** Eine Event-Karte rendern. */
function faltin_events_card($e, $cta) {
    $date = faltin_events_format_daterange($e['start_date'] ?? null, $e['end_date'] ?? null);
    $loc = trim(implode(' · ', array_filter(array($e['venue'] ?? '', $e['location_city'] ?? ''))));
    $desc = wp_strip_all_tags($e['description'] ?? '');
    if (mb_strlen($desc) > 180) $desc = mb_substr($desc, 0, 177) . '…';

    ob_start(); ?>
    <a class="ft-ev-card" href="<?php echo esc_url($e['url']); ?>">
      <div class="ft-ev-img">
        <?php if (!empty($e['hero_image'])): ?>
          <img src="<?php echo esc_url($e['hero_image']); ?>" alt="<?php echo esc_attr($e['name'] ?: $e['title']); ?>" loading="lazy" onerror="this.style.display='none'" />
        <?php endif; ?>
        <?php if ($date): ?><span class="ft-ev-date"><?php echo esc_html($date); ?></span><?php endif; ?>
      </div>
      <div class="ft-ev-body">
        <h3 class="ft-ev-title"><?php echo esc_html($e['name'] ?: $e['title']); ?></h3>
        <?php if ($loc): ?><p class="ft-ev-loc"><?php echo esc_html($loc); ?></p><?php endif; ?>
        <?php if ($desc): ?><p class="ft-ev-desc"><?php echo esc_html($desc); ?></p><?php endif; ?>
        <span class="ft-ev-cta"><?php echo esc_html($cta); ?> →</span>
      </div>
    </a>
    <?php return ob_get_clean();
}

/* ─── Shortcode: Event-Serie ─────────────────────────────────────────────── */

function faltin_events_series_shortcode($atts) {
    $atts = shortcode_atts(array(
        'serie' => '',
        'limit' => '0',
        'columns' => '3',
        'api_url' => FALTIN_EVENTS_DEFAULT_API,
        'cache' => '600',
        'cta' => 'Zum Event',
    ), $atts, 'faltin_events');

    if (!$atts['serie']) return '<p class="ft-ev-error">[faltin_events]: Parameter serie fehlt.</p>';

    $url = rtrim($atts['api_url'], '/') . '/api/events?serie=' . rawurlencode($atts['serie']);
    $events = faltin_events_fetch($url, (int)$atts['cache']);
    if (!is_array($events)) return faltin_events_maintenance_box();
    if (!count($events)) return '<p class="ft-ev-error">Keine Events in dieser Serie.</p>';

    $limit = (int)$atts['limit'];
    if ($limit > 0) $events = array_slice($events, 0, $limit);
    $cols = max(1, min(4, (int)$atts['columns']));

    $html = faltin_events_styles();
    $html .= '<div class="ft-ev-grid cols-' . $cols . '">';
    foreach ($events as $e) $html .= faltin_events_card($e, $atts['cta']);
    $html .= '</div>';
    $html .= faltin_events_jsonld($events);
    return $html;
}
add_shortcode('faltin_events', 'faltin_events_series_shortcode');

/* ─── Shortcode: einzelnes Event ─────────────────────────────────────────── */

function faltin_event_single_shortcode($atts) {
    $atts = shortcode_atts(array(
        'event' => '',
        'api_url' => FALTIN_EVENTS_DEFAULT_API,
        'cache' => '600',
        'cta' => 'Zum Event',
    ), $atts, 'faltin_event');

    if (!$atts['event']) return '<p class="ft-ev-error">[faltin_event]: Parameter event fehlt.</p>';

    $url = rtrim($atts['api_url'], '/') . '/api/events?event=' . rawurlencode($atts['event']);
    $e = faltin_events_fetch($url, (int)$atts['cache']);
    if (!is_array($e) || empty($e['url'])) return faltin_events_maintenance_box();

    $date = faltin_events_format_daterange($e['start_date'] ?? null, $e['end_date'] ?? null);
    $loc = trim(implode(' · ', array_filter(array($e['venue'] ?? '', $e['location_city'] ?? '', $e['location_country'] ?? ''))));
    $desc = wp_strip_all_tags($e['description'] ?? '');
    if (mb_strlen($desc) > 320) $desc = mb_substr($desc, 0, 317) . '…';

    ob_start(); ?>
    <div class="ft-ev-single">
      <div class="ft-ev-img">
        <?php if (!empty($e['hero_image'])): ?>
          <img src="<?php echo esc_url($e['hero_image']); ?>" alt="<?php echo esc_attr($e['name'] ?: $e['title']); ?>" loading="lazy" onerror="this.style.display='none'" />
        <?php endif; ?>
        <?php if ($date): ?><span class="ft-ev-date"><?php echo esc_html($date); ?></span><?php endif; ?>
      </div>
      <div class="ft-ev-body">
        <h3 class="ft-ev-title"><?php echo esc_html($e['name'] ?: $e['title']); ?></h3>
        <?php if ($loc): ?><p class="ft-ev-loc"><?php echo esc_html($loc); ?></p><?php endif; ?>
        <?php if ($desc): ?><p class="ft-ev-desc" style="-webkit-line-clamp:5"><?php echo esc_html($desc); ?></p><?php endif; ?>
        <a class="ft-ev-cta" href="<?php echo esc_url($e['url']); ?>"><?php echo esc_html($atts['cta']); ?> →</a>
      </div>
    </div>
    <?php
    $inner = ob_get_clean();
    return faltin_events_styles() . $inner . faltin_events_jsonld(array($e));
}
add_shortcode('faltin_event', 'faltin_event_single_shortcode');

/* ─── Shortcode: Anfrageformular (nativ gerendert, kein iframe) ──────────── */

/** Styles für das Anfrageformular – einmal pro Seite. */
function faltin_anfrage_styles() {
    static $done = false;
    if ($done) return '';
    $done = true;
    return '<style>
.ft-af{max-width:760px;margin:8px auto;border:1.5px solid #e5e8ed;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(20,48,71,.08);background:#fff;font-family:inherit}
.ft-af-head{background:#143047;padding:30px 32px 24px}
.ft-af-head h3{margin:0 0 8px;display:flex;align-items:center;gap:10px;font-size:21px;font-weight:800;color:#fff!important}
.ft-af-head h3 svg{flex:none}
.ft-af-head p{margin:0;font-size:14px;line-height:1.6;color:rgba(255,255,255,.7)!important}
.ft-af-head p strong{color:#fff!important}
.ft-af-body{padding:30px 32px;background:#fff}
.ft-af-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.ft-af-row{grid-template-columns:1fr}}
.ft-af-field{margin-bottom:14px}
.ft-af-field label{display:block!important;margin:0 0 6px!important;padding:0!important;background:transparent!important;background-color:transparent!important;box-shadow:none!important;text-shadow:none!important;font-size:12px!important;font-weight:700;color:#143047!important;letter-spacing:.2px}
.ft-af-field label span{color:#d9531e!important;background:transparent!important}
.ft-af h3,.ft-af p,.ft-af label,.ft-af small,.ft-af strong{background:transparent!important;text-shadow:none!important}
.ft-af input,.ft-af textarea,.ft-af select{width:100%;box-sizing:border-box;border:1.5px solid #e5e8ed;border-radius:12px;padding:11px 14px;font-size:14px;color:#143047!important;background:#fff!important;outline:none;transition:border-color .15s;font-family:inherit;height:auto;line-height:1.3}
.ft-af input:focus,.ft-af textarea:focus,.ft-af select:focus{border-color:#d9531e}
.ft-af input::placeholder,.ft-af textarea::placeholder{color:#9ca3af!important}
.ft-af select{cursor:pointer;height:46px}
.ft-af textarea{min-height:110px;resize:vertical}
.ft-af-consent{display:flex!important;align-items:flex-start;gap:10px;margin:0 0 16px;cursor:pointer;font-size:12px!important;font-weight:400!important;line-height:1.5;color:#6b7280!important;background:transparent!important}
.ft-af-consent input[type=checkbox]{width:16px!important;height:16px!important;min-width:16px;margin:1px 0 0!important;padding:0!important;border-radius:4px!important;accent-color:#143047;cursor:pointer;box-shadow:none!important;flex:none}
.ft-af-consent span{color:#6b7280!important;background:transparent!important;text-shadow:none!important}
.ft-af-consent a{color:#143047!important;font-weight:700;text-decoration:underline;background:transparent!important}
.ft-af-btn{width:100%;border:none;cursor:pointer;background:#d9531e;color:#fff!important;font-size:15px;font-weight:800;padding:14px 20px;border-radius:12px;transition:opacity .15s;font-family:inherit}
.ft-af-btn:hover{opacity:.92}
.ft-af-btn:disabled{opacity:.6;cursor:wait}
.ft-af-trust{margin:14px 0 0;text-align:center;font-size:11.5px;color:#9ca3af!important}
.ft-af-error{margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;font-size:13px;color:#dc2626!important;display:none}
.ft-af-success{display:none;text-align:center;padding:48px 32px;background:#f5f7fa}
.ft-af-success h3{margin:0 0 8px;font-size:23px;font-weight:800;color:#143047!important}
.ft-af-success p{margin:0 auto;max-width:420px;font-size:14px;line-height:1.6;color:#6b7280!important}
.ft-af-rq{display:inline-flex;flex-direction:column;gap:2px;margin-top:18px;padding:12px 26px;border-radius:12px;background:#143047}
.ft-af-rq small{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.6)!important}
.ft-af-rq strong{font-size:20px;font-weight:800;letter-spacing:1px;color:#fff!important}
.ft-af-check{width:54px;height:54px;margin:0 auto 14px;display:block;color:#2ecc71}
</style>';
}

/**
 * [faltin_anfrage event="super-bowl-2027" name="Super Bowl LXI 2027"]
 *
 * Natives Anfrageformular im Design der Faltin-Seite (kein iframe).
 * Sendet direkt an /api/bookings → CRM, RQ-Nummer, Bestätigungsmail.
 *
 * Parameter:
 *   event  – Event-Slug (Default "allgemeine-anfrage")
 *   name   – Anzeigename des Events im Intro-Text (optional)
 *   title  – Überschrift-Override
 *   intro  – Intro-Text-Override
 */
function faltin_anfrage_shortcode($atts) {
    $atts = shortcode_atts(array(
        'event' => 'allgemeine-anfrage',
        'name' => '',
        'title' => 'Jetzt unverbindlich anfragen',
        'intro' => '',
        'api_url' => FALTIN_EVENTS_DEFAULT_API,
        'packages' => 'auto', // auto = Package-Karten ausliefern, wenn das Event welche hat; 0/off = immer Formular
        'cache' => 600,
    ), $atts, 'faltin_anfrage');

    // Plattform down → auch das reine Formular nicht rendern (Absenden würde
    // scheitern); gilt ebenso für packages="0" und die allgemeine Anfrage.
    if (faltin_api_is_down()) return faltin_events_maintenance_box();

    // Wie auf der Faltin-Event-Seite: hat das Event buchbare Packages, zeigen
    // wir die Karten statt des Formulars — bestehende [faltin_anfrage]-
    // Einbettungen bleiben so unverändert gültig und "upgraden" automatisch.
    $want_packages = !in_array(strtolower((string)$atts['packages']), array('0', 'off', 'no', 'false'), true);
    if ($want_packages && $atts['event'] && $atts['event'] !== 'allgemeine-anfrage') {
        $pk_url = rtrim($atts['api_url'], '/') . '/api/packages-html?event=' . rawurlencode($atts['event'])
                . '&site=' . rawurlencode(home_url());
        $pk = faltin_events_fetch($pk_url, (int)$atts['cache']);
        if ($pk && !empty($pk['has_packages']) && !empty($pk['html'])) {
            return $pk['html'];
        }
        // Plattform nicht erreichbar (Deploy) → Wartungshinweis statt Formular
        if (!is_array($pk)) {
            return faltin_events_maintenance_box();
        }
    }

    static $instance = 0;
    $instance++;
    $id = 'ft-af-' . $instance;
    $api = rtrim($atts['api_url'], '/') . '/api/bookings';
    // Ohne name="…" den Slug in einen lesbaren Namen wandeln ("karneval-in-rio-2026" → "Karneval in Rio 2026")
    $event_name = $atts['name'];
    if ($event_name === '' && $atts['event']) {
        $event_name = ucwords(str_replace('-', ' ', (string)$atts['event']));
        // Kleine Füllwörter wieder kleinschreiben (In/Der/Und …)
        $event_name = preg_replace_callback('/\s(In|Im|Der|Die|Das|Und|Von|De|La|Le|Of|The|And)\s/', function ($m) {
            return ' ' . strtolower($m[1]) . ' ';
        }, $event_name);
    }
    if ($event_name === '') $event_name = $atts['event'];
    $intro = $atts['intro']
        ? esc_html($atts['intro'])
        : 'Kontaktieren Sie uns direkt — wir erstellen Ihnen ein individuelles Angebot für <strong>' . esc_html($event_name) . '</strong>.';

    $mail_icon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d9531e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
    $check_icon = '<svg class="ft-af-check" style="color:#2ecc71 !important" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

    ob_start(); ?>
    <div class="ft-af" id="<?php echo esc_attr($id); ?>" data-ftv="1.3.0">
      <div class="ft-af-main">
        <div class="ft-af-head">
          <h3><?php echo $mail_icon; ?> <?php echo esc_html($atts['title']); ?></h3>
          <p><?php echo $intro; ?></p>
        </div>
        <div class="ft-af-body">
          <p class="ft-af-error" style="color:#dc2626 !important;background:#fef2f2 !important;text-shadow:none !important"></p>
          <?php
          $lbl = 'style="color:#143047 !important;background:transparent !important;text-shadow:none !important;padding:0 !important;display:block !important;margin:0 0 6px !important;font-size:12px !important;font-weight:700 !important"';
          $inp = 'style="color:#143047 !important;background:#fff !important"';
          ?>
          <div class="ft-af-field"><label <?php echo $lbl; ?>>Anrede</label>
            <select <?php echo $inp; ?> name="salutation" autocomplete="honorific-prefix">
              <option value="">– bitte wählen –</option>
              <option value="herr">Herr</option>
              <option value="frau">Frau</option>
            </select>
          </div>
          <div class="ft-af-row">
            <div class="ft-af-field"><label <?php echo $lbl; ?>>Vorname</label><input <?php echo $inp; ?> type="text" name="firstName" placeholder="Max" autocomplete="given-name"></div>
            <div class="ft-af-field"><label <?php echo $lbl; ?>>Nachname</label><input <?php echo $inp; ?> type="text" name="lastName" placeholder="Mustermann" autocomplete="family-name"></div>
          </div>
          <div class="ft-af-field"><label <?php echo $lbl; ?>>E-Mail <span style="color:#d9531e !important">*</span></label><input <?php echo $inp; ?> type="email" name="email" placeholder="max@example.com" autocomplete="email" required></div>
          <div class="ft-af-field"><label <?php echo $lbl; ?>>Telefon <span style="color:#d9531e !important">*</span></label><input <?php echo $inp; ?> type="tel" name="phone" placeholder="+41 79 123 45 67" autocomplete="tel" required></div>
          <div class="ft-af-field"><label <?php echo $lbl; ?>>Nachricht / Wunsch</label><textarea <?php echo $inp; ?> name="message" placeholder="Ich interessiere mich für… (Reisezeitraum, Personenanzahl, besondere Wünsche)"></textarea></div>
          <label class="ft-af-consent">
            <input type="checkbox" name="consent">
            <span>Ich habe die <a href="https://faltintravel.com/allgemeine-geschaeftsbedingungen/" target="_blank" rel="noopener noreferrer">AGB</a> und die <a href="https://faltintravel.com/datenschutzerklaerung/" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a> gelesen und stimme diesen zu. <span style="color:#d9531e !important">*</span></span>
          </label>
          <button type="button" class="ft-af-btn" style="color:#fff !important;background:#d9531e !important">Unverbindlich anfragen</button>
          <p class="ft-af-trust" style="color:#9ca3af !important;background:transparent !important">✓ Kostenlos &amp; unverbindlich &nbsp;·&nbsp; ✓ Antwort innerhalb 24h &nbsp;·&nbsp; ✓ Schweizer Reisegarantie</p>
        </div>
      </div>
      <div class="ft-af-success">
        <?php echo $check_icon; ?>
        <h3 style="color:#143047 !important;background:transparent !important;text-shadow:none !important">Vielen Dank für Ihre Anfrage!</h3>
        <p style="color:#6b7280 !important;background:transparent !important">Wir haben Ihre Nachricht erhalten und melden uns schnellstmöglich bei Ihnen. Unser Team ist in der Regel innerhalb von 24 Stunden für Sie da.</p>
        <div class="ft-af-rq" style="display:none"><small style="color:rgba(255,255,255,.6) !important;background:transparent !important">Ihre Anfragenummer</small><strong style="color:#fff !important;background:transparent !important">RQ</strong></div>
        <p class="ft-af-trust" style="color:#9ca3af !important;background:transparent !important">Eine Bestätigung mit dieser Nummer wurde an Ihre E-Mail gesendet.</p>
      </div>
    </div>
    <script>
    (function(){
      var root = document.getElementById(<?php echo wp_json_encode($id); ?>);
      if (!root) return;
      var btn = root.querySelector('.ft-af-btn');
      var err = root.querySelector('.ft-af-error');
      var val = function(n){ return (root.querySelector('[name="'+n+'"]').value || '').trim(); };
      btn.addEventListener('click', function(){
        err.style.display = 'none';
        if (!val('email') || !val('phone')) {
          err.textContent = 'Bitte E-Mail und Telefonnummer angeben.';
          err.style.display = 'block';
          return;
        }
        var consentEl = root.querySelector('[name="consent"]');
        if (!consentEl || !consentEl.checked) {
          err.textContent = 'Bitte stimmen Sie den AGB und der Datenschutzerklärung zu.';
          err.style.display = 'block';
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Wird gesendet…';
        fetch(<?php echo wp_json_encode($api); ?>, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventSlug: <?php echo wp_json_encode($atts['event']); ?>,
            source: <?php echo wp_json_encode((string) wp_parse_url(home_url(), PHP_URL_HOST)); ?>,
            packageSlug: null,
            packageId: 'contact-inquiry',
            packageTitle: 'Allgemeine Anfrage – ' + <?php echo wp_json_encode($event_name); ?>,
            startDate: '',
            numberOfPersons: 1,
            doubleRooms: 0,
            singleRooms: 0,
            salutation: val('salutation'),
            travelers: [{ salutation: val('salutation'), firstName: val('firstName'), lastName: val('lastName'), email: val('email') }],
            email: val('email'),
            phone: val('phone'),
            message: val('message'),
            totalPrice: 0,
            consent: true
          })
        }).then(function(r){ return r.json(); }).then(function(d){
          if (d.success) {
            root.querySelector('.ft-af-main').style.display = 'none';
            var s = root.querySelector('.ft-af-success');
            s.style.display = 'block';
            if (d.requestNumber) {
              var rq = root.querySelector('.ft-af-rq');
              rq.style.display = 'inline-flex';
              rq.querySelector('strong').textContent = d.requestNumber;
            }
            s.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            throw new Error(d.error || 'Fehler');
          }
        }).catch(function(e){
          var msg = String((e && e.message) || '');
          // Netzwerkfehler / 5xx / HTML statt JSON (Proxy-Fehlerseite) → Plattform gerade im Deploy
          var offline = !msg || /failed to fetch|networkerror|load failed|unexpected token|not valid json|bad gateway|50\d/i.test(msg);
          if (offline) {
            err.innerHTML = 'Unser Buchungsmodul wird gerade aktualisiert und ist in wenigen Augenblicken wieder erreichbar. '
              + 'Bitte versuchen Sie es gleich noch einmal – Ihre Eingaben bleiben erhalten. In dringenden Fällen: '
              + '<a href="tel:+41447002277" style="color:#dc2626 !important;font-weight:600">+41 44 700 22 77</a> &middot; '
              + '<a href="mailto:info@faltintravel.com" style="color:#dc2626 !important;font-weight:600">info@faltintravel.com</a>';
          } else {
            err.textContent = 'Senden fehlgeschlagen: ' + msg + ' — bitte erneut versuchen.';
          }
          err.style.display = 'block';
        }).finally(function(){
          btn.disabled = false;
          btn.textContent = 'Unverbindlich anfragen';
        });
      });
    })();
    </script>
    <?php
    // SEO/GEO: Auch ohne Packages strukturierte Event-Daten ausliefern —
    // SportsEvent-JSON-LD aus /api/events (gecacht), gleiche LD-Funktion
    // wie [faltin_events]/[faltin_event]. Formular bleibt unverändert.
    $jsonld = '';
    if ($atts['event'] && $atts['event'] !== 'allgemeine-anfrage') {
        $ev_url = rtrim($atts['api_url'], '/') . '/api/events?event=' . rawurlencode($atts['event']);
        $ev = faltin_events_fetch($ev_url, (int)$atts['cache']);
        if (is_array($ev) && !empty($ev['url']) && (!empty($ev['name']) || !empty($ev['title']))) {
            $jsonld = faltin_events_jsonld(array($ev));
        }
    }
    return $jsonld . faltin_anfrage_styles() . ob_get_clean();
}
add_shortcode('faltin_anfrage', 'faltin_anfrage_shortcode');

/* ─── Shortcode: Package-Karten (mit Anfrageformular-Fallback) ───────────── */
/**
 * [faltin_packages event="super-bowl-2027"]
 *
 * Rendert die buchbaren Packages des Events als Karten-Grid — fertiges HTML
 * aus dem Faltin-System (/api/packages-html): Fotos, Leistungen, Preise,
 * Ausgebucht-Status, Buchungslinks. Design-Änderungen im System sind damit
 * automatisch live, ohne dieses Plugin anzufassen.
 *
 * Hat das Event keine aktiven Packages, wird stattdessen das native
 * Anfrageformular gerendert (gleiche Logik wie die Faltin-Event-Seite).
 *
 * Parameter:
 *   event   – Event-Slug (Pflicht), z.B. super-bowl-2027
 *   name    – Anzeigename fürs Fallback-Formular (optional)
 *   cache   – Cache-Dauer in Sekunden (Default 600, 0 = aus)
 *   api_url – API-Server überschreiben (selten nötig)
 */
function faltin_packages_shortcode($atts) {
    $atts = shortcode_atts(array(
        'event' => '',
        'name' => '',
        'cache' => 600,
        'api_url' => FALTIN_EVENTS_DEFAULT_API,
    ), $atts, 'faltin_packages');

    if (!$atts['event']) return '<!-- faltin_packages: Parameter "event" fehlt -->';

    $url = rtrim($atts['api_url'], '/') . '/api/packages-html?event=' . rawurlencode($atts['event'])
         . '&site=' . rawurlencode(home_url());
    $data = faltin_events_fetch($url, (int)$atts['cache']);

    if ($data && !empty($data['has_packages']) && !empty($data['html'])) {
        // Fertiges, selbstenthaltenes HTML aus dem System (inkl. Styles & JSON-LD)
        return $data['html'];
    }

    // Plattform nicht erreichbar (Deploy) und kein Backup-Stand → Wartungshinweis
    // statt eines Formulars, dessen Absenden ohnehin scheitern würde.
    if (!is_array($data)) {
        return faltin_events_maintenance_box();
    }

    // Keine aktiven Packages → Anfrageformular
    return faltin_anfrage_shortcode(array(
        'event' => $atts['event'],
        'name' => $atts['name'] ?: (is_array($data) && !empty($data['event_name']) ? $data['event_name'] : ''),
        'api_url' => $atts['api_url'],
        'packages' => '0', // Packages wurden hier bereits geprüft — direkt das Formular rendern
    ));
}
add_shortcode('faltin_packages', 'faltin_packages_shortcode');
