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
function superbowl_package_shortcode($atts) {
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'api_url' => 'https://superbowl.faltintravel.com/api/package', // Subdomain
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/api/package'
    ), $atts);
    
    // Eindeutige ID für diesen Shortcode
    $unique_id = 'superbowl-package-' . uniqid();
    
    ob_start();
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
        fetch('<?php echo esc_js($atts['api_url']); ?>')
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
    return ob_get_clean();
}
add_shortcode('superbowl_package', 'superbowl_package_shortcode');

/**
 * Shortcode: [superbowl_faqs]
 * Zeigt die FAQs mit Schema.org Daten
 */
function superbowl_faqs_shortcode($atts) {
    $atts = shortcode_atts(array(
        // WICHTIG: Next.js läuft auf separatem Server!
        'api_url' => 'https://superbowl.faltintravel.com/api/faqs', // Subdomain
        // ODER wenn auf Vercel: 'https://ihr-projekt.vercel.app/api/faqs'
    ), $atts);
    
    $unique_id = 'superbowl-faqs-' . uniqid();
    
    ob_start();
    ?>
    <div id="<?php echo esc_attr($unique_id); ?>" class="superbowl-faqs-wrapper">
        <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #184a7b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 16px; color: #666;">FAQs werden geladen...</p>
        </div>
    </div>
    
    <script>
    (function() {
        fetch('<?php echo esc_js($atts['api_url']); ?>')
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
    return ob_get_clean();
}
add_shortcode('superbowl_faqs', 'superbowl_faqs_shortcode');

/**
 * Shortcode: [superbowl_embed]
 * Komplette Einbettung der /embed Route
 */
function superbowl_embed_shortcode($atts) {
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
 * Admin-Hinweise für einfache Verwendung
 */
function superbowl_admin_notice() {
    $screen = get_current_screen();
    if ($screen->base === 'post' || $screen->base === 'page') {
        ?>
        <div class="notice notice-info is-dismissible">
            <p><strong>Super Bowl Shortcodes verfügbar:</strong></p>
            <ul style="list-style: disc; margin-left: 20px;">
                <li><code>[superbowl_package]</code> - Zeigt die Package Card</li>
                <li><code>[superbowl_faqs]</code> - Zeigt die FAQs</li>
                <li><code>[superbowl_embed]</code> - Komplette Seite einbetten</li>
            </ul>
        </div>
        <?php
    }
}
add_action('admin_notices', 'superbowl_admin_notice');
