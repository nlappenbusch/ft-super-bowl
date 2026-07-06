<?php
/**
 * Plugin Name: Faltin CF7 → Anfrage Migration
 * Description: Findet Contact-Form-7-Formulare + die Seiten, auf denen sie stehen, schlägt automatisch das passende Faltin-Event vor (über /api/wp/match) und ersetzt CF7 auf Klick durch [faltin_anfrage]. Mit manueller Event-Auswahl und Revision/Undo.
 * Version: 1.1.0
 * Author: Faltin Travel
 *
 * Changelog:
 * 1.1.0
 * - CF7-5.8+-Hash-IDs ([contact-form-7 id="8f7a3bc" …]) werden erkannt — vorher wurden nur
 *   numerische IDs geparst, neuere Formulare tauchten deshalb GAR NICHT in der Liste auf
 *   (Tickets: Karneval/Eishockey-WM "nicht gefunden", Swiss Indoors "nicht verknüpfbar").
 * - Alle CF7-Formulare werden gelistet, auch wenn ihr Shortcode in keiner veröffentlichten
 *   Seite gefunden wurde (z. B. Page-Builder-Widget) — mit Shortcode zum manuellen Einbau.
 * - Seitentitel gehen als Kontext an /api/wp/match → bessere Vorschläge bei generischen
 *   Formulartiteln ("Kontaktformular 12").
 * - Manuelle Event-Auswahl pro Zeile (Dropdown mit allen aktiven Events der Plattform) —
 *   Verknüpfen funktioniert jetzt auch ohne Auto-Treffer.
 * - "Ersetzen" schreibt name="…" in den Shortcode — vorher zeigte das Formular den Slug
 *   (z. B. "karneval-in-rio-2026") statt des Eventnamens an.
 * - Ersetzen matcht numerische ID UND Hash-Schreibweise desselben Formulars; exakte
 *   ID-Grenze (Formular 3544 ersetzt nicht mehr versehentlich 35443).
 * 1.0.0 Initial.
 */

if (!defined('ABSPATH')) exit;

if (!defined('FALTIN_CF7_API')) {
    // Basis-URL der neuen Plattform (bei Bedarf in wp-config.php überschreiben: define('FALTIN_CF7_API', '...'))
    define('FALTIN_CF7_API', 'https://next.faltintravel.com');
}

/* ---------- Admin-Menü ---------- */
add_action('admin_menu', function () {
    add_management_page(
        'CF7 → Faltin Anfrage',
        'CF7 → Faltin',
        'manage_options',
        'faltin-cf7-migrate',
        'faltin_cf7_migrate_page'
    );
});

/** CF7-Formular über numerische ID (klassisch) oder Hash-ID (CF7 ≥ 5.8) auflösen. */
function faltin_cf7_get_form($id) {
    if (!class_exists('WPCF7_ContactForm')) return null;
    $id = (string)$id;
    if (preg_match('/^\d+$/', $id)) {
        $form = WPCF7_ContactForm::get_instance((int)$id);
        return $form ?: null;
    }
    if (function_exists('wpcf7_get_contact_form_by_hash')) {
        $form = wpcf7_get_contact_form_by_hash($id);
        return $form ?: null;
    }
    return null;
}

/**
 * Alle CF7-Formulare sammeln:
 * 1. aus [contact-form-7]-Shortcodes in veröffentlichten Posts/Pages (numerische ID + Hash-ID),
 * 2. plus alle in CF7 registrierten Formulare, deren Shortcode nirgends im post_content steht
 *    (z. B. Page-Builder-Widgets) — sonst sind sie im Tool unauffindbar.
 */
function faltin_cf7_collect() {
    global $wpdb;
    $rows = $wpdb->get_results(
        "SELECT ID, post_title, post_type FROM {$wpdb->posts}
         WHERE post_status = 'publish' AND post_content LIKE '%[contact-form-7%'"
    );
    $forms = array(); // key => ['id'=>, 'title'=>, 'pages'=>[ [ID,title,type] ]]
    foreach ($rows as $r) {
        $content = get_post_field('post_content', $r->ID);
        if (!preg_match_all('/\[contact-form-7[^\]]*\]/i', $content, $m)) continue;
        foreach ($m[0] as $sc) {
            $scid = ''; $title = '';
            // CF7 < 5.8: id="12345" — ab 5.8: Hash, z. B. id="8f7a3bc"
            if (preg_match('/\bid="?([0-9a-zA-Z_-]+)"?/i', $sc, $mm)) $scid = $mm[1];
            if (preg_match('/\btitle="([^"]*)"/i', $sc, $mm)) $title = $mm[1];
            if ($scid === '') continue;
            $form = faltin_cf7_get_form($scid);
            // Kanonische ID (Post-ID), damit Hash- und Zahl-Schreibweise desselben Formulars zusammenfallen
            $key = $form ? 'f' . $form->id() : 'sc-' . strtolower($scid);
            if (!isset($forms[$key])) {
                $forms[$key] = array(
                    'id' => $form ? (string)$form->id() : $scid,
                    'title' => $form ? $form->title() : $title,
                    'pages' => array(),
                );
            }
            if ($title && !$forms[$key]['title']) $forms[$key]['title'] = $title;
            $forms[$key]['pages'][$r->ID] = array('ID' => $r->ID, 'title' => $r->post_title, 'type' => $r->post_type);
        }
    }
    // Formulare ohne Shortcode-Fundstelle ergänzen (Seiten-Liste bleibt leer)
    if (class_exists('WPCF7_ContactForm')) {
        $all = WPCF7_ContactForm::find(array('posts_per_page' => -1));
        foreach ($all as $cf) {
            $key = 'f' . $cf->id();
            if (!isset($forms[$key])) {
                $forms[$key] = array('id' => (string)$cf->id(), 'title' => $cf->title(), 'pages' => array());
            }
        }
    }
    return array_values($forms);
}

/** Vorschläge von der Plattform holen (Formular-Titel + Seitentitel als Kontext). */
function faltin_cf7_suggest($forms) {
    $payload = array('forms' => array_map(function ($f) {
        return array(
            'id' => $f['id'],
            'title' => $f['title'] ?: $f['id'],
            'pages' => array_values(array_map(function ($p) { return $p['title']; }, $f['pages'])),
        );
    }, $forms));
    $res = wp_remote_post(rtrim(FALTIN_CF7_API, '/') . '/api/wp/match', array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => wp_json_encode($payload),
        'timeout' => 25,
    ));
    if (is_wp_error($res)) return array('error' => $res->get_error_message());
    $body = json_decode(wp_remote_retrieve_body($res), true);
    if (!is_array($body) || empty($body['success'])) return array('error' => 'Plattform-Antwort ungültig.');
    $byId = array();
    foreach ($body['results'] as $r) { if (!empty($r['id'])) $byId[$r['id']] = $r; }
    return array('byId' => $byId);
}

/** Alle aktiven Events der Plattform (für die manuelle Auswahl). */
function faltin_cf7_events() {
    $res = wp_remote_get(rtrim(FALTIN_CF7_API, '/') . '/api/events', array('timeout' => 20));
    if (is_wp_error($res)) return array('error' => $res->get_error_message());
    $body = json_decode(wp_remote_retrieve_body($res), true);
    if (!is_array($body) || empty($body['success']) || !is_array($body['data'])) return array('error' => 'Plattform-Antwort ungültig.');
    $events = array();
    foreach ($body['data'] as $e) {
        if (empty($e['slug'])) continue;
        if (isset($e['status']) && $e['status'] === 'archived') continue;
        $name = !empty($e['name']) ? $e['name'] : (!empty($e['title']) ? $e['title'] : $e['slug']);
        $events[] = array('slug' => (string)$e['slug'], 'name' => (string)$name);
    }
    usort($events, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
    return array('events' => $events);
}

/* ---------- Seite ---------- */
function faltin_cf7_migrate_page() {
    if (!current_user_can('manage_options')) return;
    $forms = faltin_cf7_collect();
    $sug = faltin_cf7_suggest($forms);
    $byId = isset($sug['byId']) ? $sug['byId'] : array();
    $ev = faltin_cf7_events();
    $events = isset($ev['events']) ? $ev['events'] : array();
    $nonce = wp_create_nonce('faltin_cf7_replace');
    ?>
    <div class="wrap">
        <h1>CF7 → Faltin Anfrage – Migration</h1>
        <p>Gefundene Contact-Form-7-Formulare. Vorschlag = automatisch erkanntes Faltin-Event; per Dropdown lässt sich jedes Event auch manuell wählen. „Ersetzen" tauscht den CF7-Shortcode in allen betroffenen Seiten gegen <code>[faltin_anfrage]</code> (eine Revision wird angelegt, also rückgängig machbar).</p>
        <?php if (!empty($sug['error'])): ?>
            <div class="notice notice-error"><p>Vorschläge konnten nicht geladen werden: <?php echo esc_html($sug['error']); ?> (API: <?php echo esc_html(FALTIN_CF7_API); ?>)</p></div>
        <?php endif; ?>
        <?php if (!empty($ev['error'])): ?>
            <div class="notice notice-warning"><p>Event-Liste konnte nicht geladen werden (manuelle Auswahl deaktiviert): <?php echo esc_html($ev['error']); ?></p></div>
        <?php endif; ?>
        <?php if (empty($forms)): ?>
            <div class="notice notice-info"><p>Keine Contact-Form-7-Formulare gefunden.</p></div>
        <?php endif; ?>
        <table class="widefat striped">
            <thead><tr><th>CF7-Formular</th><th>Seiten</th><th>Vorschlag</th><th>Event / Ersetzen durch</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($forms as $f):
                $r = isset($byId[$f['id']]) ? $byId[$f['id']] : null;
                $s = $r && !empty($r['suggestion']) ? $r['suggestion'] : null;
                $pages = array_values($f['pages']);
                $selSlug = $s ? $s['event_slug'] : '';
                $selName = $s ? $s['event_name'] : '';
                $shortcode = $selSlug ? '[faltin_anfrage event="' . $selSlug . '" name="' . $selName . '"]' : '';
            ?>
                <tr>
                    <td><strong><?php echo esc_html($f['title'] ?: '(ohne Titel)'); ?></strong><br><small>id <?php echo esc_html($f['id']); ?></small></td>
                    <td>
                        <?php if ($pages) { foreach ($pages as $p) { echo '<div><a href="' . esc_url(get_edit_post_link($p['ID'])) . '" target="_blank">' . esc_html($p['title']) . '</a></div>'; } }
                        else { echo '<em>Shortcode in keiner veröffentlichten Seite gefunden (evtl. Page-Builder/Widget)</em>'; } ?>
                    </td>
                    <td>
                        <?php if ($s): ?>
                            <span style="display:inline-block;padding:1px 6px;border-radius:4px;color:#fff;background:<?php echo $s['score'] >= 0.6 ? '#15803d' : '#b45309'; ?>"><?php echo round($s['score'] * 100); ?>%</span>
                            <strong><?php echo esc_html($s['event_name']); ?></strong>
                        <?php else: ?>
                            <em>Kein sicherer Treffer</em>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?php if ($events): ?>
                            <select class="faltin-event-select" style="max-width:280px">
                                <option value="">– Event wählen –</option>
                                <?php foreach ($events as $e): ?>
                                    <option value="<?php echo esc_attr($e['slug']); ?>" data-name="<?php echo esc_attr($e['name']); ?>"<?php selected($selSlug, $e['slug']); ?>><?php echo esc_html($e['name']); ?></option>
                                <?php endforeach; ?>
                            </select><br>
                        <?php endif; ?>
                        <code class="faltin-sc"><?php echo esc_html($shortcode); ?></code>
                    </td>
                    <td>
                        <?php if ($pages): ?>
                            <button class="button button-primary faltin-replace"
                                data-formid="<?php echo esc_attr($f['id']); ?>"
                                data-slug="<?php echo esc_attr($selSlug); ?>"
                                data-name="<?php echo esc_attr($selName); ?>"
                                data-nonce="<?php echo esc_attr($nonce); ?>"
                                <?php disabled(!$selSlug); ?>>Ersetzen</button>
                        <?php else: ?>
                            <em>Shortcode manuell einbauen</em>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <script>
    document.querySelectorAll('.faltin-event-select').forEach(function (sel) {
        sel.addEventListener('change', function () {
            var row = sel.closest('tr');
            var opt = sel.options[sel.selectedIndex];
            var slug = sel.value;
            var name = opt ? (opt.dataset.name || '') : '';
            var code = row.querySelector('.faltin-sc');
            if (code) code.textContent = slug ? '[faltin_anfrage event="' + slug + '" name="' + name + '"]' : '';
            var btn = row.querySelector('.faltin-replace');
            if (btn) { btn.dataset.slug = slug; btn.dataset.name = name; btn.disabled = !slug; btn.textContent = 'Ersetzen'; }
        });
    });
    document.querySelectorAll('.faltin-replace').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!btn.dataset.slug) return;
            if (!confirm('CF7-Shortcode in allen betroffenen Seiten durch [faltin_anfrage] ersetzen? Eine Revision wird angelegt.')) return;
            btn.disabled = true; btn.textContent = '…';
            var data = new FormData();
            data.append('action', 'faltin_cf7_replace');
            data.append('formid', btn.dataset.formid);
            data.append('slug', btn.dataset.slug);
            data.append('name', btn.dataset.name || '');
            data.append('_wpnonce', btn.dataset.nonce);
            fetch(ajaxurl, { method: 'POST', body: data, credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (j) { btn.textContent = j.success ? ('✓ ' + j.data.count + ' Seite(n)') : ('Fehler: ' + (j.data || '')); if (!j.success) btn.disabled = false; })
                .catch(function () { btn.textContent = 'Fehler'; btn.disabled = false; });
        });
    });
    </script>
    <?php
}

/* ---------- AJAX: Ersetzen ---------- */
add_action('wp_ajax_faltin_cf7_replace', function () {
    if (!current_user_can('manage_options')) wp_send_json_error('Keine Berechtigung');
    check_ajax_referer('faltin_cf7_replace');
    $formid = preg_replace('/[^0-9a-zA-Z_-]/', '', $_POST['formid'] ?? '');
    $slug = preg_replace('/[^0-9a-z-]/', '', strtolower(sanitize_text_field($_POST['slug'] ?? '')));
    $name = str_replace(array('"', '[', ']'), '', sanitize_text_field($_POST['name'] ?? ''));
    if (!$formid || !$slug) wp_send_json_error('Parameter fehlen');

    // Alle Schreibweisen dieses Formulars matchen: numerische ID und CF7-5.8+-Hash(-Präfix).
    $idPatterns = array(preg_quote($formid, '/'));
    $form = faltin_cf7_get_form($formid);
    if ($form) {
        $idPatterns[] = preg_quote((string)$form->id(), '/');
        $hash = get_post_meta($form->id(), '_hash', true);
        if (is_string($hash) && strlen($hash) >= 7) {
            $idPatterns[] = preg_quote(substr($hash, 0, 7), '/') . '[0-9a-f]*';
        }
    }
    $idAlt = '(?:' . implode('|', array_unique($idPatterns)) . ')';

    global $wpdb;
    $rows = $wpdb->get_results("SELECT ID FROM {$wpdb->posts} WHERE post_status='publish' AND post_content LIKE '%[contact-form-7%'");
    $replacement = '[faltin_anfrage event="' . $slug . '"' . ($name !== '' ? ' name="' . $name . '"' : '') . ']';
    $count = 0;
    foreach ($rows as $r) {
        $content = get_post_field('post_content', $r->ID);
        // Nur Shortcodes mit GENAU dieser Form-ID ersetzen (Lookahead: keine Teil-ID-Treffer)
        $new = preg_replace('/\[contact-form-7[^\]]*\bid="?' . $idAlt . '"?(?![0-9a-zA-Z_-])[^\]]*\]/i', $replacement, $content, -1, $n);
        if ($n > 0 && $new !== $content) {
            wp_update_post(array('ID' => $r->ID, 'post_content' => $new)); // legt automatisch eine Revision an
            $count++;
        }
    }
    wp_send_json_success(array('count' => $count));
});
