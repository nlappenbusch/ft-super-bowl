<?php
/**
 * Plugin Name: Faltin CF7 → Anfrage Migration
 * Description: Findet Contact-Form-7-Formulare + die Seiten, auf denen sie stehen, schlägt automatisch das passende Faltin-Event vor (über /api/wp/match) und ersetzt CF7 auf Klick durch [faltin_anfrage]. Mit Revision/Undo.
 * Version: 1.0.0
 * Author: Faltin Travel
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

/** Alle veröffentlichten Posts/Pages, die einen [contact-form-7]-Shortcode enthalten. */
function faltin_cf7_collect() {
    global $wpdb;
    $rows = $wpdb->get_results(
        "SELECT ID, post_title, post_type FROM {$wpdb->posts}
         WHERE post_status = 'publish' AND post_content LIKE '%[contact-form-7%'"
    );
    $forms = array(); // id => ['id'=>, 'title'=>, 'pages'=>[ [ID,title,type] ]]
    foreach ($rows as $r) {
        $content = get_post_field('post_content', $r->ID);
        if (!preg_match_all('/\[contact-form-7[^\]]*\]/i', $content, $m)) continue;
        foreach ($m[0] as $sc) {
            $id = '';   $title = '';
            if (preg_match('/\bid="?(\d+)"?/i', $sc, $mm)) $id = $mm[1];
            if (preg_match('/\btitle="([^"]*)"/i', $sc, $mm)) $title = $mm[1];
            if ($id === '') continue;
            if (!isset($forms[$id])) $forms[$id] = array('id' => $id, 'title' => $title, 'pages' => array());
            if ($title && !$forms[$id]['title']) $forms[$id]['title'] = $title;
            $forms[$id]['pages'][$r->ID] = array('ID' => $r->ID, 'title' => $r->post_title, 'type' => $r->post_type);
        }
    }
    // CF7-Titel ergänzen, wo nur die ID im Shortcode stand
    if (class_exists('WPCF7_ContactForm')) {
        foreach ($forms as $id => &$f) {
            if (!$f['title']) {
                $cf = WPCF7_ContactForm::get_instance((int)$id);
                if ($cf) $f['title'] = $cf->title();
            }
        }
        unset($f);
    }
    return array_values($forms);
}

/** Vorschläge von der Plattform holen. */
function faltin_cf7_suggest($forms) {
    $payload = array('forms' => array_map(function ($f) { return array('id' => $f['id'], 'title' => $f['title'] ?: $f['id']); }, $forms));
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

/* ---------- Seite ---------- */
function faltin_cf7_migrate_page() {
    if (!current_user_can('manage_options')) return;
    $forms = faltin_cf7_collect();
    $sug = faltin_cf7_suggest($forms);
    $byId = isset($sug['byId']) ? $sug['byId'] : array();
    $nonce = wp_create_nonce('faltin_cf7_replace');
    ?>
    <div class="wrap">
        <h1>CF7 → Faltin Anfrage – Migration</h1>
        <p>Gefundene Contact-Form-7-Formulare in veröffentlichten Seiten. Vorschlag = automatisch erkanntes Faltin-Event. „Ersetzen" tauscht den CF7-Shortcode in allen betroffenen Seiten gegen <code>[faltin_anfrage]</code> (eine Revision wird angelegt, also rückgängig machbar).</p>
        <?php if (!empty($sug['error'])): ?>
            <div class="notice notice-error"><p>Vorschläge konnten nicht geladen werden: <?php echo esc_html($sug['error']); ?> (API: <?php echo esc_html(FALTIN_CF7_API); ?>)</p></div>
        <?php endif; ?>
        <?php if (empty($forms)): ?>
            <div class="notice notice-info"><p>Keine [contact-form-7]-Shortcodes in veröffentlichten Seiten gefunden.</p></div>
        <?php endif; ?>
        <table class="widefat striped">
            <thead><tr><th>CF7-Formular</th><th>Seiten</th><th>Vorschlag</th><th>Ersetzen durch</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($forms as $f):
                $r = isset($byId[$f['id']]) ? $byId[$f['id']] : null;
                $s = $r && !empty($r['suggestion']) ? $r['suggestion'] : null;
                $pages = array_values($f['pages']);
            ?>
                <tr>
                    <td><strong><?php echo esc_html($f['title'] ?: '(ohne Titel)'); ?></strong><br><small>id <?php echo esc_html($f['id']); ?></small></td>
                    <td><?php foreach ($pages as $p) { echo '<div><a href="' . esc_url(get_edit_post_link($p['ID'])) . '" target="_blank">' . esc_html($p['title']) . '</a></div>'; } ?></td>
                    <td>
                        <?php if ($s): ?>
                            <span style="display:inline-block;padding:1px 6px;border-radius:4px;color:#fff;background:<?php echo $s['score'] >= 0.6 ? '#15803d' : '#b45309'; ?>"><?php echo round($s['score'] * 100); ?>%</span>
                            <strong><?php echo esc_html($s['event_name']); ?></strong>
                        <?php else: ?>
                            <em>Kein sicherer Treffer</em>
                        <?php endif; ?>
                    </td>
                    <td><?php if ($s): ?><code class="faltin-sc"><?php echo esc_html($s['shortcode']); ?></code><?php endif; ?></td>
                    <td>
                        <?php if ($s): ?>
                            <button class="button button-primary faltin-replace"
                                data-formid="<?php echo esc_attr($f['id']); ?>"
                                data-slug="<?php echo esc_attr($s['event_slug']); ?>"
                                data-nonce="<?php echo esc_attr($nonce); ?>">Ersetzen</button>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <script>
    document.querySelectorAll('.faltin-replace').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!confirm('CF7-Shortcode in allen betroffenen Seiten durch [faltin_anfrage] ersetzen? Eine Revision wird angelegt.')) return;
            btn.disabled = true; btn.textContent = '…';
            var data = new FormData();
            data.append('action', 'faltin_cf7_replace');
            data.append('formid', btn.dataset.formid);
            data.append('slug', btn.dataset.slug);
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
    $formid = preg_replace('/\D/', '', $_POST['formid'] ?? '');
    $slug = sanitize_text_field($_POST['slug'] ?? '');
    if (!$formid || !$slug) wp_send_json_error('Parameter fehlen');

    global $wpdb;
    $rows = $wpdb->get_results("SELECT ID FROM {$wpdb->posts} WHERE post_status='publish' AND post_content LIKE '%[contact-form-7%'");
    $replacement = '[faltin_anfrage event="' . $slug . '"]';
    $count = 0;
    foreach ($rows as $r) {
        $content = get_post_field('post_content', $r->ID);
        // Nur Shortcodes mit GENAU dieser Form-ID ersetzen
        $new = preg_replace('/\[contact-form-7[^\]]*\bid="?' . preg_quote($formid, '/') . '"?[^\]]*\]/i', $replacement, $content, -1, $n);
        if ($n > 0 && $new !== $content) {
            wp_update_post(array('ID' => $r->ID, 'post_content' => $new)); // legt automatisch eine Revision an
            $count++;
        }
    }
    wp_send_json_success(array('count' => $count));
});
