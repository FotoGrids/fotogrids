<?php
/**
 * FotoGrids Upgrade Modal
 * 
 * Handles the upgrade to pro modal content and functionality
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class FotoGrids_Upgrade_Modal {

    /**
     * Get all upgrade benefits data
     * 
     * @return array Array of benefit objects
     */
    public static function get_benefits() {
        return array(
            array(
                'key' => 'unlimited_galleries',
                'shortTitle' => __( 'Unlimited', 'fotogrids' ),
                'title' => __( 'Level up your store with', 'fotogrids' ),
                'subtitle' => __( 'Unlimited Galleries!', 'fotogrids' ),
                'content' => __( 'Create as many galleries as you need without any restrictions. Perfect for photographers, agencies, and businesses showcasing extensive portfolios.', 'fotogrids' ),
                'color' => '#6366f1',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/unlimited-galleries.svg'
            ),
            array(
                'key' => 'advanced_layouts',
                'shortTitle' => __( 'Layouts', 'fotogrids' ),
                'title' => __( 'Stunning Visual Impact with', 'fotogrids' ),
                'subtitle' => __( 'Advanced Layout Options!', 'fotogrids' ),
                'content' => __( 'Access premium layouts including Polaroid, Carousel, Slideshow, and more. Create unique presentations that captivate your audience.', 'fotogrids' ),
                'color' => '#8b5cf6',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/advanced-layouts.svg'
            ),
            array(
                'key' => 'custom_css',
                'shortTitle' => __( 'Styling', 'fotogrids' ),
                'title' => __( 'Complete Design Freedom with', 'fotogrids' ),
                'subtitle' => __( 'Custom CSS & Styling!', 'fotogrids' ),
                'content' => __( 'Take full control of your gallery appearance with custom CSS, advanced color options, and unlimited styling possibilities.', 'fotogrids' ),
                'color' => '#06b6d4',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/custom-css.png'
            ),
            array(
                'key' => 'priority_support',
                'shortTitle' => __( 'Support', 'fotogrids' ),
                'title' => __( 'Get Help When You Need It with', 'fotogrids' ),
                'subtitle' => __( 'Priority Support!', 'fotogrids' ),
                'content' => __( 'Receive fast, dedicated support from our expert team. Get priority assistance, custom solutions, and peace of mind.', 'fotogrids' ),
                'color' => '#10b981',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/priority-support.png'
            ),
            array(
                'key' => 'white_label',
                'shortTitle' => __( 'Branding', 'fotogrids' ),
                'title' => __( 'Professional Presentation with', 'fotogrids' ),
                'subtitle' => __( 'White Label Options!', 'fotogrids' ),
                'content' => __( 'Remove FotoGrids branding and add your own. Perfect for agencies and developers who want to maintain their professional image.', 'fotogrids' ),
                'color' => '#f59e0b',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/white-label.svg'
            ),
            array(
                'key' => 'analytics',
                'shortTitle' => __( 'Analytics', 'fotogrids' ),
                'title' => __( 'Understand Your Audience with', 'fotogrids' ),
                'subtitle' => __( 'Advanced Analytics!', 'fotogrids' ),
                'content' => __( 'Track views, clicks, and engagement across all your galleries. Make data-driven decisions to improve your content strategy.', 'fotogrids' ),
                'color' => '#ef4444',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/analytics.svg'
            ),
            array(
                'key' => 'integrations',
                'shortTitle' => __( 'Integrations', 'fotogrids' ),
                'title' => __( 'Connect Everything with', 'fotogrids' ),
                'subtitle' => __( 'Powerful Integrations!', 'fotogrids' ),
                'content' => __( 'Seamlessly integrate with popular services like Google Photos, Dropbox, Instagram, and more. Streamline your workflow.', 'fotogrids' ),
                'color' => '#8b5cf6',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/integrations.svg'
            ),
            array(
                'key' => 'bulk_operations',
                'shortTitle' => __( 'Bulk Tools', 'fotogrids' ),
                'title' => __( 'Save Time and Effort with', 'fotogrids' ),
                'subtitle' => __( 'Bulk Operations!', 'fotogrids' ),
                'content' => __( 'Edit multiple items at once, bulk import from various sources, and manage large galleries efficiently. Work smarter, not harder.', 'fotogrids' ),
                'color' => '#06b6d4',
                'image' => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/bulk-operations.svg'
            )
        );
    }

    /**
     * Get benefit by key
     * 
     * @param string $key Benefit key
     * @return array|null Benefit data or null if not found
     */
    public static function get_benefit_by_key( $key ) {
        $benefits = self::get_benefits();
        foreach ( $benefits as $benefit ) {
            if ( $benefit['key'] === $key ) {
                return $benefit;
            }
        }
        return null;
    }

    /**
     * Get benefit index by key
     * 
     * @param string $key Benefit key
     * @return int Benefit index or 0 if not found
     */
    public static function get_benefit_index_by_key( $key ) {
        $benefits = self::get_benefits();
        foreach ( $benefits as $index => $benefit ) {
            if ( $benefit['key'] === $key ) {
                return $index;
            }
        }
        return 0;
    }

    /**
     * Get modal strings for translation
     * 
     * @return array Translatable strings
     */
    public static function get_modal_strings() {
        return array(
            'close' => __( 'Close', 'fotogrids' ),
            'upgradeNow' => __( 'Upgrade Now', 'fotogrids' ),
            'freeVsPro' => __( 'Free vs. Pro', 'fotogrids' ),
            'noCreditCard' => __( 'No credit card required', 'fotogrids' ),
            'startFree' => __( 'Start now for free', 'fotogrids' )
        );
    }

    /**
     * Get upgrade and comparison URLs
     * 
     * @return array URLs for upgrade and comparison
     */
    public static function get_urls() {
        return array(
            'upgrade' => 'https://fotogrids.com/upgrade/?utm_source=plugin&utm_medium=modal&utm_campaign=upgrade',
            'comparison' => 'https://fotogrids.com/free-vs-pro/?utm_source=plugin&utm_medium=modal&utm_campaign=comparison'
        );
    }

    /**
     * Enqueue modal assets
     */
    public static function enqueue_assets() {
        // This will be called when the modal needs to be displayed
        wp_enqueue_style( 'fotogrids-upgrade-modal' );
        wp_enqueue_script( 'fotogrids-upgrade-modal' );
    }

    /**
     * Get all modal data for JavaScript
     * 
     * @return array Complete modal data
     */
    public static function get_modal_data() {
        return array(
            'benefits' => self::get_benefits(),
            'strings' => self::get_modal_strings(),
            'urls' => self::get_urls()
        );
    }
}
