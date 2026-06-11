<?php
/**
 * Plugin Name: Super Bowl Next.js Integration
 * Plugin URI: https://faltintravel.com
 * Description: Integriert Super Bowl Komponenten von der Next.js App via Shortcodes
 * Version: 1.0.0
 * Author: Faltin Travel
 * Author URI: https://faltintravel.com
 */

// Sicherheit: Direkten Zugriff verhindern
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Shortcode: [superbowl_package]
 * Zeigt die Super Bowl Package Card mit Schema.org Daten
 */
function superbowl_package_shortcode($atts)
{
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'api_url' => 'https://superbowl.faltintravel.com/api/package', // Subdomain
        'event' => '',
        'package' => '',
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/api/package'
    ), $atts);

    $api_url = $atts['api_url'];
    if (!empty($atts['event'])) {
        $query_args = array('event' => $atts['event']);
        if (!empty($atts['package'])) {
            $query_args['package'] = $atts['package'];
        }
        $api_url = add_query_arg($query_args, $api_url);
    }

    // Eindeutige ID für diesen Shortcode
    $unique_id = 'superbowl-package-' . uniqid();

    // Server-side render für SEO
    $response = wp_remote_get($api_url, array(
        'timeout' => 8,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    $html = '';
    if (!is_wp_error($response)) {
        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        if ($status === 200 && !empty($body)) {
            $data = json_decode($body, true);
            if (is_array($data) && !empty($data['success']) && !empty($data['html'])) {
                $html = $data['html'];
            }
        }
    }

    ob_start();
    if (!empty($html)) {
        echo $html;
    }
    else {
?>
        <div id="<?php echo esc_attr($unique_id); ?>" class="superbowl-package-wrapper">
            <div style="text-align: center; padding: 40px;">
                <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #184a7b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 16px; color: #666;">Wird geladen...</p>
            </div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
        
        <script>
        (function() {
            fetch('<?php echo esc_js($api_url); ?>')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.html) {
                        var container = document.getElementById('<?php echo esc_js($unique_id); ?>');
                        container.innerHTML = data.html;
                        
                        // Script-Tags extrahieren und ausführen
                        var scripts = container.querySelectorAll('script');
                        scripts.forEach(function(script) {
                            var newScript = document.createElement('script');
                            if (script.src) {
                                newScript.src = script.src;
                            } else {
                                newScript.textContent = script.textContent;
                            }
                            document.body.appendChild(newScript);
                        });
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Laden des Super Bowl Packages:', error);
                    document.getElementById('<?php echo esc_js($unique_id); ?>').innerHTML = 
                        '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00;">Fehler beim Laden. Bitte später erneut versuchen.</div>';
                });
        })();
        </script>
        <?php
    }
    return ob_get_clean();
}
add_shortcode('superbowl_package', 'superbowl_package_shortcode');

/**
 * Shortcode: [superbowl_package_advanced]
 * Zeigt die Advanced Package Card mit Personen-Auswahl
 */
function superbowl_package_advanced_shortcode($atts)
{
    $atts = shortcode_atts(array(
        'api_url' => 'https://superbowl.faltintravel.com/api/package-advanced',
        'event' => '',
        'package' => '',
    ), $atts);

    $api_url = $atts['api_url'];
    if (!empty($atts['event'])) {
        $query_args = array('event' => $atts['event']);
        if (!empty($atts['package'])) {
            $query_args['package'] = $atts['package'];
        }
        $api_url = add_query_arg($query_args, $api_url);
    }

    $unique_id = 'superbowl-package-advanced-' . uniqid();

    // Server-side render für SEO
    $response = wp_remote_get($api_url, array(
        'timeout' => 8,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    $html = '';
    if (!is_wp_error($response)) {
        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        if ($status === 200 && !empty($body)) {
            $data = json_decode($body, true);
            if (is_array($data) && !empty($data['success']) && !empty($data['html'])) {
                $html = $data['html'];
            }
        }
    }

    ob_start();
    if (!empty($html)) {
        echo $html;
    }
    else {
?>
        <div id="<?php echo esc_attr($unique_id); ?>" class="superbowl-package-advanced-wrapper">
            <div style="text-align: center; padding: 40px;">
                <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #184a7b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 16px; color: #666;">Wird geladen...</p>
            </div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
        
        <script>
        (function() {
            fetch('<?php echo esc_js($api_url); ?>')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.html) {
                        var container = document.getElementById('<?php echo esc_js($unique_id); ?>');
                        container.innerHTML = data.html;
                        
                        // Script-Tags extrahieren und ausführen
                        var scripts = container.querySelectorAll('script');
                        scripts.forEach(function(script) {
                            var newScript = document.createElement('script');
                            if (script.src) {
                                newScript.src = script.src;
                            } else {
                                newScript.textContent = script.textContent;
                            }
                            document.body.appendChild(newScript);
                        });
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Laden des Advanced Packages:', error);
                    document.getElementById('<?php echo esc_js($unique_id); ?>').innerHTML = 
                        '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00;">Fehler beim Laden. Bitte später erneut versuchen.</div>';
                });
        })();
        </script>
        <?php
    }
    return ob_get_clean();
}
add_shortcode('superbowl_package_advanced', 'superbowl_package_advanced_shortcode');

/**
 * Shortcode: [superbowl_faqs]
 * Zeigt die FAQs mit Schema.org Daten
 */
function superbowl_faqs_shortcode($atts)
{
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'api_url' => 'https://superbowl.faltintravel.com/api/faqs', // Subdomain
        'event' => '',
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/api/faqs'
    ), $atts);

    $api_url = $atts['api_url'];
    if (!empty($atts['event'])) {
        $api_url = add_query_arg(array('event' => $atts['event']), $api_url);
    }

    $unique_id = 'superbowl-faqs-' . uniqid();

    // Server-side render für SEO
    $response = wp_remote_get($api_url, array(
        'timeout' => 8,
        'headers' => array(
            'Accept' => 'application/json'
        )
    ));
    $html = '';
    if (!is_wp_error($response)) {
        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        if ($status === 200 && !empty($body)) {
            $data = json_decode($body, true);
            if (is_array($data) && !empty($data['success']) && !empty($data['html'])) {
                $html = $data['html'];
            }
        }
    }

    ob_start();
    if (!empty($html)) {
        echo $html;
    }
    else {
?>
        <div id="<?php echo esc_attr($unique_id); ?>" class="superbowl-faqs-wrapper">
            <div style="text-align: center; padding: 40px;">
                <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #184a7b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 16px; color: #666;">FAQs werden geladen...</p>
            </div>
        </div>
        
        <script>
        (function() {
            fetch('<?php echo esc_js($api_url); ?>')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.html) {
                        document.getElementById('<?php echo esc_js($unique_id); ?>').innerHTML = data.html;
                    }
                })
                .catch(error => {
                    console.error('Fehler beim Laden der FAQs:', error);
                    document.getElementById('<?php echo esc_js($unique_id); ?>').innerHTML = 
                        '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c00;">Fehler beim Laden der FAQs.</div>';
                });
        })();
        </script>
        <?php
    }
    return ob_get_clean();
}
add_shortcode('superbowl_faqs', 'superbowl_faqs_shortcode');

/**
 * Shortcode: [superbowl_embed]
 * Komplette Einbettung der /embed Route
 */
function superbowl_embed_shortcode($atts)
{
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'url' => 'https://superbowl.faltintravel.com/embed', // Subdomain
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/embed'
        'height' => '3000',
    ), $atts);

    ob_start();
?>
    <div class="superbowl-embed-container" style="width: 100%; overflow: hidden;">
        <iframe 
            src="<?php echo esc_url($atts['url']); ?>" 
            id="superbowl-iframe"
            title="Super Bowl LXI 2027 Packages"
            style="width: 100%; border: none; min-height: <?php echo esc_attr($atts['height']); ?>px; display: block; margin: 0; padding: 0;"
            scrolling="no"
            frameborder="0"
        ></iframe>
    </div>
    
    <script>
    (function() {
        window.addEventListener('message', function(event) {
            if (event.data && event.data.frameHeight) {
                var iframe = document.getElementById('superbowl-iframe');
                if (iframe) {
                    iframe.style.height = event.data.frameHeight + 'px';
                }
            }
        });
    })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('superbowl_embed', 'superbowl_embed_shortcode');

/**
 * Shortcode: [superbowl_anfrage]
 * Bettet das "Unverbindlich anfragen"-Formular als iFrame ein.
 *
 * Beispiele:
 *   [superbowl_anfrage]
 *   [superbowl_anfrage event="super-bowl-2027" name="Super Bowl LXI 2027"]
 *   [superbowl_anfrage url="https://superbowl.faltintravel.com/embed/anfrage" height="900"]
 */
function superbowl_anfrage_shortcode($atts)
{
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'url' => 'https://superbowl.faltintravel.com/embed/anfrage', // Subdomain
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/embed/anfrage'
        'event' => '',
        'name' => '',
        'height' => '880',
    ), $atts);

    // Event/Name als Query-Parameter anhängen
    $url = $atts['url'];
    $query_args = array();
    if (!empty($atts['event'])) {
        $query_args['event'] = $atts['event'];
    }
    if (!empty($atts['name'])) {
        $query_args['name'] = $atts['name'];
    }
    if (!empty($query_args)) {
        $url = add_query_arg($query_args, $url);
    }

    $unique_id = 'superbowl-anfrage-' . uniqid();

    ob_start();
?>
    <div class="superbowl-anfrage-container" style="width: 100%; overflow: hidden;">
        <iframe
            src="<?php echo esc_url($url); ?>"
            id="<?php echo esc_attr($unique_id); ?>"
            title="Unverbindlich anfragen"
            style="width: 100%; border: none; min-height: <?php echo esc_attr($atts['height']); ?>px; display: block; margin: 0; padding: 0;"
            scrolling="no"
            frameborder="0"
        ></iframe>
    </div>

    <script>
    (function() {
        var iframeId = '<?php echo esc_js($unique_id); ?>';
        window.addEventListener('message', function(event) {
            if (event.data && event.data.frameHeight) {
                var iframe = document.getElementById(iframeId);
                if (iframe) {
                    iframe.style.height = event.data.frameHeight + 'px';
                }
            }
        });
    })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('superbowl_anfrage', 'superbowl_anfrage_shortcode');

/**
 * Admin-Hinweise für einfache Verwendung
 */
function superbowl_admin_notice()
{
    $screen = get_current_screen();
    if ($screen->base === 'post' || $screen->base === 'page') {
?>
        <div class="notice notice-info is-dismissible">
            <p><strong>Super Bowl Shortcodes verfügbar:</strong></p>
            <ul style="list-style: disc; margin-left: 20px;">
                <li><code>[superbowl_package]</code> - Package Card (Einfach)</li>
                <li><code>[superbowl_package_advanced]</code> - Package Card mit Personen-Auswahl ⭐</li>
                <li><code>[superbowl_faqs]</code> - Zeigt die FAQs</li>
                <li><code>[superbowl_anfrage]</code> - Anfrage-Formular einbetten ✉️</li>
                <li><code>[superbowl_embed]</code> - Komplette Seite einbetten</li>
            </ul>
        </div>
        <?php
    }
}
add_action('admin_notices', 'superbowl_admin_notice');
