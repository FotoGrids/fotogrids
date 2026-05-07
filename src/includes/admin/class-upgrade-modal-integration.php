<?php
/**
 * FotoGrids Upgrade Modal Integration
 *
 * Handles integration of the upgrade modal into the admin interface
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

use FotoGrids\Admin_Helpers;

class FotoGrids_Upgrade_Modal_Integration {

    /**
     * Initialize the upgrade modal integration
     */
    public static function init() {
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
        add_action( 'admin_footer', array( __CLASS__, 'render_modal_data' ) );
    }

    /**
     * Enqueue modal assets on admin pages
     *
     * @param string $hook Current admin page hook
     */
    public static function enqueue_assets( $hook ) {
        // Don't enqueue for Pro users
        if ( fotogrids_has_pro() || ! is_admin() ) {
            return;
        }

        // Enqueue modal styles
        wp_enqueue_style(
            'fotogrids-upgrade-modal',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/upgrade-modal.css',
            array(),
            FOTOGRIDS_VERSION
        );

        // Enqueue global modal initialization script
        wp_enqueue_script(
            'fotogrids-global-modal',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/global-modal-init.js',
            array( 'wp-element', 'wp-i18n', 'react', 'react-dom' ),
            FOTOGRIDS_VERSION,
            true
        );

        // Mark as Pro user for JS
        wp_localize_script( 'fotogrids-global-modal', 'fotogridsGlobalSettings', array(
            'isPro' => fotogrids_has_pro(),
            'debugMode' => defined( 'WP_DEBUG' ) && WP_DEBUG
        ) );
    }

    /**
     * Render modal data in admin footer
     */
    public static function render_modal_data() {
        // Don't render for Pro users
        if ( fotogrids_has_pro() || ! is_admin() ) {
            return;
        }

        $modal_data = FotoGrids_Upgrade_Modal::get_modal_data();

        // Ensure fotogridsAdmin.isFotoGridsPage is set for modal init (e.g. on post edit where fotogrids-admin may load late)
        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
        $is_fotogrids_page = $screen && Admin_Helpers::is_fotogrids_page( $screen );
        ?>
        <div id="fotogrids-upgrade-modal"></div>
        <script type="text/javascript">
            window.fotogridsUpgradeModal = <?php echo wp_json_encode( $modal_data ); ?>;
            window.fotogridsIsPro = <?php echo fotogrids_has_pro() ? 'true' : 'false'; ?>;
            <?php if ( $is_fotogrids_page ) : ?>
            if ( ! window.fotogridsAdmin ) {
                window.fotogridsAdmin = {};
            }
            if ( window.fotogridsAdmin.isFotoGridsPage === undefined ) {
                window.fotogridsAdmin.isFotoGridsPage = true;
            }
            <?php endif; ?>
        </script>
        <?php
    }

    /**
     * Check if current page is a FotoGrids admin page
     *
     * @param string $hook Current admin page hook
     * @return bool
     */
    private static function is_fotogrids_admin_page( $hook ) {
        return Admin_Helpers::is_fotogrids_page( $hook );
    }

    /**
     * Check if modal should be shown (not for Pro users)
     *
     * @return bool
     */
    private static function should_show_modal() {
        // Don't show for Pro users
        if ( fotogrids_has_pro() ) {
            return false;
        }

        // Only show on FotoGrids admin pages
        $screen = get_current_screen();
        if ( ! $screen ) {
            return false;
        }

        return self::is_fotogrids_admin_page( $screen->id );
    }

    /**
     * Add pro feature indicators to admin UI
     */
    public static function add_pro_indicators() {
        if ( fotogrids_has_pro() ) {
            return;
        }

        // Add CSS for pro badges
        ?>
        <style>
            .fotogrids-pro-feature-btn {
                position: relative;
            }

            .fotogrids-pro-feature-btn .pro-badge {
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 4px;
                margin-left: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .fotogrids-pro-feature-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .gallery-limit-notice {
                background: #f3f4f6;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }

            .gallery-limit-notice p {
                margin: 0 0 15px 0;
                color: #6b7280;
            }

            .upgrade-btn {
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease;
            }

            .upgrade-btn:hover {
                transform: translateY(-1px);
            }
        </style>
        <?php
    }

    /**
     * Create upgrade button HTML
     *
     * @param string $feature Feature key
     * @param string $text Button text
     * @param array $args Additional arguments
     * @return string Button HTML
     */
    public static function create_upgrade_button( $feature, $text, $args = array() ) {
        if ( fotogrids_has_pro() ) {
            return '';
        }

        $defaults = array(
            'class' => 'button button-secondary',
            'show_badge' => true,
            'onclick' => "window.FotoGridsUpgrade && window.FotoGridsUpgrade.launch('{$feature}')"
        );

        $args = wp_parse_args( $args, $defaults );

        $badge = $args['show_badge'] ? '<span class="pro-badge">PRO</span>' : '';

        return sprintf(
            '<button class="fotogrids-pro-feature-btn %s" onclick="%s">%s%s</button>',
            esc_attr( $args['class'] ),
            esc_attr( $args['onclick'] ),
            esc_html( $text ),
            $badge
        );
    }
}
