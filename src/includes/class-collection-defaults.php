<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Collection Defaults Class
 *
 * Manages default settings for galleries and albums with a hierarchical structure:
 * - Base defaults (shared by both galleries and albums)
 * - Gallery-specific defaults
 * - Album-specific defaults
 *
 * @since 1.0.0
 */
class Collection_Defaults {

    /**
     * Get base defaults (shared by both galleries and albums)
     *
     * @param bool $is_defaults_page If true, use second item from array defaults
     * @return array Base default settings
     */
    public static function get_base_defaults( $is_defaults_page = false ) {
        $defaults = array(
            'layout' => 'grid',
            'columns_mode' => 'fixed',
            'columns' => array(
                'desktop' => 4,
                'tablet' => 3,
                'mobile' => 1
            ),
            'columns_auto_range' => array(
                'desktop' => array(
                    'min' => array('value' => 200, 'unit' => 'px'),
                    'max' => array('value' => 400, 'unit' => 'px')
                ),
                'tablet' => array(
                    'min' => array('value' => 180, 'unit' => 'px'),
                    'max' => array('value' => 350, 'unit' => 'px')
                ),
                'mobile' => array(
                    'min' => array('value' => 100, 'unit' => 'px'),
                    'max' => array('value' => 300, 'unit' => 'px')
                )
            ),
            'item_spacing' => array(
                'desktop' => 10,
                'tablet' => 8,
                'mobile' => 5
            ),
            'margin' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'padding' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'hover_effects' => false,
            'hover_effect' => 'none',
            'loading_icon' => '12-dots',
            'loading_icon_color' => 'rgba(60, 70, 240, 1)',
            'loaded_effect' => 'fade',
            'lightbox' => true,
            'captions' => true,
            'lazy_load' => true,
            'lightbox_preload_slides' => 2,
            'border_radius' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'border_enabled' => false,
            'border_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'border_color' => '#000000',
            'border_style' => 'solid',
            'shadow_enabled' => false,
            'shadow_color' => 'rgba(0,0,0,0.5)',
            'shadow_offset_x' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'shadow_offset_y' => array(
                'desktop' => 4,
                'tablet' => 4,
                'mobile' => 4
            ),
            'shadow_blur' => array(
                'desktop' => 10,
                'tablet' => 10,
                'mobile' => 10
            ),
            'shadow_spread' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'thumbnail_filter_enabled' => false,
            'thumbnail_filter_type' => array(),
            // Per-filter amount controls (regular state).
            'thumbnail_filter_amount_grayscale' => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'thumbnail_filter_amount_sepia'     => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'thumbnail_filter_amount_blur'      => array( 'desktop' => 5,   'tablet' => 5,   'mobile' => 5   ),
            'thumbnail_filter_amount_brightness'=> array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_amount_contrast'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_amount_saturate'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_amount_invert'    => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_amount_opacity'   => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_amount_hue_rotate'=> array( 'desktop' => 0,   'tablet' => 0,   'mobile' => 0   ),
            // Per-filter amount controls (hover/mouseover state).
            'thumbnail_filter_hover_amount_grayscale' => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'thumbnail_filter_hover_amount_sepia'     => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'thumbnail_filter_hover_amount_blur'      => array( 'desktop' => 5,   'tablet' => 5,   'mobile' => 5   ),
            'thumbnail_filter_hover_amount_brightness'=> array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_hover_amount_contrast'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_hover_amount_saturate'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_hover_amount_invert'    => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_hover_amount_opacity'   => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'thumbnail_filter_hover_amount_hue_rotate'=> array( 'desktop' => 0,   'tablet' => 0,   'mobile' => 0   ),
            'full_image_filter_enabled' => false,
            'full_image_filter_type' => array(),
            // Per-filter amount controls (regular state).
            'full_image_filter_amount_grayscale' => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'full_image_filter_amount_sepia'     => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'full_image_filter_amount_blur'      => array( 'desktop' => 5,   'tablet' => 5,   'mobile' => 5   ),
            'full_image_filter_amount_brightness'=> array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_amount_contrast'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_amount_saturate'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_amount_invert'    => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_amount_opacity'   => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_amount_hue_rotate'=> array( 'desktop' => 0,   'tablet' => 0,   'mobile' => 0   ),
            // Per-filter amount controls (hover/mouseover state).
            'full_image_filter_hover_amount_grayscale' => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'full_image_filter_hover_amount_sepia'     => array( 'desktop' => 50,  'tablet' => 50,  'mobile' => 50  ),
            'full_image_filter_hover_amount_blur'      => array( 'desktop' => 5,   'tablet' => 5,   'mobile' => 5   ),
            'full_image_filter_hover_amount_brightness'=> array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_hover_amount_contrast'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_hover_amount_saturate'  => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_hover_amount_invert'    => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_hover_amount_opacity'   => array( 'desktop' => 100, 'tablet' => 100, 'mobile' => 100 ),
            'full_image_filter_hover_amount_hue_rotate'=> array( 'desktop' => 0,   'tablet' => 0,   'mobile' => 0   ),
            'animation_speed' => 300,
            'filter_buttons' => false,
            'pagination_type' => 'paginated',
            'pagination_method' => 'load_more',
            'default_sort_order' => 'manual',
            'date_sort_type' => 'date_created',
            'date_sort_direction' => 'desc',
            'title_sort_direction' => 'asc',
            'user_sortable' => false,
            'sort_ui_position' => 'top',
            'sort_ui_style' => 'dropdown',
            'sort_ui_label' => 'Sort by:',
            'filtering_enabled' => false,
            'filter_by' => array( 'tags' ),
            'date_filter_type' => 'date_taken',
            'filter_display_mode' => 'toggle',
            'filter_ui_position' => 'top',
            'filter_sidebar_side' => 'left',
            'filter_ui_style' => 'buttons',
            'show_filter_count' => true,
            'filter_all_label' => 'All',
            // Filter UI spacing
            'filter_wrapper_gap'   => 16,
            'filter_bar_gap'       => 8,
            'filter_gap'           => 8,
            'filter_sidebar_width' => 200,
            // Button shape
            'filter_btn_padding'   => '6px 14px',
            'filter_btn_radius'    => 4,
            'filter_btn_font_size' => 0.875,
            // Button colors (empty = use SCSS defaults / inherit)
            'filter_btn_bg'           => '',
            'filter_btn_color'        => '',
            'filter_btn_border'       => '1px solid currentColor',
            'filter_btn_active_bg'    => '',
            'filter_btn_active_color' => '',
            'filter_btn_hover_bg'     => '',
            'filter_btn_hover_color'  => '',
            // Dropdown trigger
            'filter_select_padding' => '6px 32px 6px 12px',
            'filter_select_radius'  => 4,
            'filter_select_bg'      => '',
            'filter_select_color'   => '',
            'filter_select_border'  => '1px solid currentColor',
            // Dropdown popover
            'filter_dropdown_list_bg'             => '',
            'filter_dropdown_list_border'          => '',
            'filter_dropdown_list_radius'          => 4,
            'filter_dropdown_option_hover_bg'      => '',
            'filter_dropdown_option_active_color'  => '',
            // Checkbox shape
            'filter_cb_size'   => 16,
            'filter_cb_radius' => 3,
            'filter_cb_gap'    => 8,
            // Checkbox colors
            'filter_cb_border'               => '1px solid currentColor',
            'filter_cb_bg'                   => '',
            'filter_cb_checked_bg'           => '',
            'filter_cb_checked_border_color' => '',
            'filter_cb_checkmark_color'      => '',
            // Count badge
            'filter_count_color'     => '',
            'filter_count_font_size' => 0.8,
            'filter_count_bg'        => '',
            'filter_count_radius'    => 0,
            'filter_count_padding'   => '0',
            'items_per_page' => array(
                'desktop' => 12,
                'tablet' => 8,
                'mobile' => 6
            ),
            'load_more_button_text' => 'Load More',
            'load_more_button_alignment' => 'center',
            'load_more_button_full_width' => false,
            'pagination_alignment' => 'stretch',
            'pages_show_prev_next' => true,
            'pages_prev_text' => 'Previous',
            'pages_next_text' => 'Next',
            'pages_button_icon' => 'chevron',
            'pages_show_numbers' => true,
            'pages_truncate' => true,
            'item_click_behavior' => 'lightbox',
            'external_link_target' => '_self',
            'lightbox_img_shadow_enabled'             => false,
            'lightbox_img_shadow_offset_x'            => array( 'desktop' => 0,  'tablet' => 0,  'mobile' => 0 ),
            'lightbox_img_shadow_offset_y'            => array( 'desktop' => 4,  'tablet' => 4,  'mobile' => 4 ),
            'lightbox_img_shadow_blur'                => array( 'desktop' => 10, 'tablet' => 10, 'mobile' => 10 ),
            'lightbox_img_shadow_spread'              => array( 'desktop' => 0,  'tablet' => 0,  'mobile' => 0 ),
            'lightbox_theme' => 'dark',
            // Custom theme colours - defaults match the dark theme.
            'lightbox_background_color'               => 'rgba(0, 0, 0, 0.92)',
            'lightbox_img_shadow_color'               => 'rgba(0, 0, 0, 0.3)',
            'lightbox_spinner_color'                  => 'rgba(255, 255, 255, 0.8)',
            'lightbox_top_toolbar_background'         => 'rgba(0, 0, 0, 0.35)',
            'lightbox_toolbar_button_color'           => 'rgba(255, 255, 255, 0.7)',
            'lightbox_toolbar_button_hover_color'     => 'rgba(255, 255, 255, 1)',
            'lightbox_toolbar_btn_active_bg'          => 'rgba(255, 255, 255, 0.15)',
            'lightbox_navigation_arrow_background'    => 'rgba(0, 0, 0, 0.45)',
            'lightbox_navigation_arrow_background_hover' => 'rgba(0, 0, 0, 0.75)',
            'lightbox_navigation_arrow_color'         => 'rgba(255, 255, 255, 1)',
            'lightbox_navigation_arrow_mouseover_color' => 'rgba(255, 255, 255, 1)',
            'lightbox_bullet_color'                   => 'rgba(255, 255, 255, 1)',
            'lightbox_bullet_mouseover_color'         => 'rgba(255, 255, 255, 1)',
            'lightbox_bullet_active_color'            => 'rgba(60, 70, 240, 1)',
            'lightbox_thumbnails_background'          => 'rgba(0, 0, 0, 0.7)',
            'lightbox_thumbnail_border_color'         => 'rgba(255, 255, 255, 0.45)',
            'lightbox_thumbnail_active_color'         => 'rgba(60, 70, 240, 1)',
            'lightbox_info_panel_background'          => 'rgba(0, 0, 0, 0.25)',
            'lightbox_info_block_bg'                  => 'rgba(255, 255, 255, 0.06)',
            'lightbox_info_block_divider'             => 'rgba(255, 255, 255, 0.12)',
            'lightbox_info_panel_text'                => 'rgba(255, 255, 255, 0.85)',
            'lightbox_info_panel_title'               => 'rgba(255, 255, 255, 1)',
            'lightbox_transition' => 'fade',
            'lightbox_transition_duration' => 300,
            'lightbox_transition_duration_custom' => 400,
            'lightbox_auto_progress' => true,
            'lightbox_auto_progress_delay' => 5,
            'lightbox_fit_media' => true,
            'lightbox_mobile_layout' => 'mobile_optimized',
            'lightbox_show_arrows' => true,
            'lightbox_arrow_icon' => 'chevron',
            'lightbox_arrow_size' => 40,
            'lightbox_arrow_color' => 'rgba(255, 255, 255, 1)',
            'lightbox_show_dots'    => false,
            'lightbox_show_counter' => false,
            'lightbox_dot_style'    => 'fill',
            'lightbox_dot_size' => 12,
            'lightbox_dot_color' => 'rgba(255, 255, 255, 1)',
            'lightbox_active_dot_color' => 'rgba(60, 70, 240, 1)',
            'lightbox_dots_spacing' => array(
                'value' => 8,
                'unit' => 'px'
            ),
            'lightbox_thumbnail_strip_location' => 'bottom',
            'lightbox_thumbnail_size' => 'normal',
            'lightbox_thumbnail_spacing' => 5,
            'lightbox_thumbnail_drag' => true,
            'lightbox_thumbnail_swipe' => true,
            'lightbox_overlay_blur' => 8,
            'lightbox_loop' => true,
            'lightbox_hide_arrows_at_ends' => false,
            'lightbox_fullscreen' => true,
            'lightbox_show_tooltips' => true,
            'lightbox_auto_progress_style' => 'bar',
            'lightbox_progress_color' => 'rgba(60, 70, 240, 1)',
            'lightbox_auto_progress_bar_location' => 'bottom',
            'lightbox_auto_progress_pause_on' => array( 'image_hover' ),
            'lightbox_auto_progress_stop_on_interaction' => true,
            'lightbox_auto_progress_show_controls' => false,
            'lightbox_zoom' => true,
            'lightbox_zoom_trigger' => 'double_click',
            'lightbox_zoom_icons' => false,
            'lightbox_zoom_beyond_original' => true,
            'lightbox_info_panel' => 'always',
            'lightbox_info_panel_location' => 'right',
            'lightbox_info_blocks' => array( 'caption', 'description', 'file_info', 'exif', 'share', 'credit', 'tags', 'people', 'location' ),
            'lightbox_credit_source' => 'item_meta',
            'lightbox_info_blocks_style' => 'boxed',
            'lightbox_backdrop_close'      => true,
            'caption_type' => 'default',
            'caption_placement' => 'overlay',
            'caption_gap' => array(
                'desktop' => 8,
                'tablet' => 8,
                'mobile' => 8
            ),
            'caption_alignment' => array( 'left' ),
            'caption_vertical_alignment' => 'bottom',
            'caption_hide_title' => false,
            'caption_title_source' => array( 'item_title' ),
            'caption_title_font_family' => 'default',
            'caption_title_font_weight' => 'default',
            'caption_title_font_size' => array(
                'desktop' => 16,
                'tablet' => 15,
                'mobile' => 14
            ),
            'caption_title_color' => 'rgba(255, 255, 255, 1)',
            'caption_hide_description' => false,
            'caption_description_source' => array( 'item_caption' ),
            'caption_description_font_size' => array(
                'desktop' => 12,
                'tablet' => 11,
                'mobile' => 10
            ),
            'caption_description_color' => 'rgba(255, 255, 255, 0.7)',
            'caption_limit_title_length' => 'lines',
            'caption_max_title_characters' => array(
                'desktop' => 200,
                'tablet' => 200,
                'mobile' => 200
            ),
            'caption_max_title_lines' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'caption_limit_description_length' => 'lines',
            'caption_max_desc_characters' => array(
                'desktop' => 200,
                'tablet' => 200,
                'mobile' => 200
            ),
            'caption_max_desc_lines' => array(
                'desktop' => 2,
                'tablet' => 2,
                'mobile' => 2
            ),
            'caption_overlay_color' => 'rgba(0, 0, 0, 0.3)',
            // Stored on a 0-100 scale (matches the % range control). Frontend
            // divides by 100 before applying as a CSS opacity value.
            'caption_overlay_opacity' => 100,
            'caption_overlay_hover_opacity' => 50,
            'who_can_edit' => 'all',
            'who_can_view' => 'all',
            'thumbnail_size' => 'fotogrids_thumbnail',
            'thumbnail_custom_size_width' => 400,
            'thumbnail_custom_size_height' => 300,
            'thumbnail_custom_size_crop' => true,
            'thumbnail_custom_size_crop_alignment' => 'center',
            'full_image_size' => 'fotogrids_full',
            'full_image_custom_size_width' => 1920,
            'full_image_custom_size_height' => 0,
            'full_image_custom_size_crop' => false,
            'full_image_custom_size_crop_alignment' => 'center',
            'password_protect' => false,
            'password' => '',
            'password_remember' => false,
            'password_remember_days' => 7,
            'disable_right_click' => false,
            'enable_watermark' => false,
            'watermark_type' => 'text',
            'watermark_image_url' => '',
            'watermark_image_size' => 20,
            'watermark_text' => '© Your Name',
            'watermark_font_size' => 24,
            'watermark_text_color' => 'light',
            'watermark_custom_text_color' => '#ffffff',
            'watermark_font_family' => 'Arial',
            'watermark_custom_font' => '',
            'watermark_position' => 'bottom-right',
            'watermark_opacity' => 70,
            'watermark_margin' => array(
                'desktop' => 20,
                'tablet' => 15,
                'mobile' => 10
            ),
            'watermark_apply_to' => 'full',
            'watermark_repeat' => false,
            'watermark_repeat_spacing' => array(
                'desktop' => 200,
                'tablet' => 150,
                'mobile' => 100
            ),
            'sharing_override' => false,
            'sharing_disabled_for_collection' => false,
            'sharing_networks_override' => array( 'facebook', 'x', 'pinterest', 'email', 'copy_link' ),
            'sharing_placements_override' => array( 'view_page', 'lightbox' ),
            'sharing_custom_text_override' => '',
            // SEO per-collection overrides (paired with the plugin-wide SEO
            // store in `SEO_Settings_Store`). All optional - empty / falsy
            // values fall through to the resolver's layered fallback chain
            // (post excerpt → post content → count summary for the
            // description; Featured Item/Gallery → custom → site-wide
            // default for the image; permalink for the canonical).
            'fotogrids_og_title'           => '',
            'fotogrids_og_description'     => '',
            'fotogrids_og_image_source'    => 'featured',
            'fotogrids_og_image_custom_id' => 0,
            'fotogrids_noindex'            => false,
            'fotogrids_canonical_override' => '',
            'enable_cache' => true,
            'cache_duration' => 24,
            'hover_cursor_icon' => 'pointer',
            'auto_clear_cache' => true,
            'enable_statistics' => true,
            'retain_statistics' => 'forever',
            'use_ajax_from_album' => true,
            'navigation_show_breadcrumbs' => false,
            'navigation_breadcrumbs_placements' => array( 'view_pages', 'embedded' ),
            'navigation_show_breadcrumbs_on_direct_visit' => false,
            'navigation_emit_breadcrumb_schema' => true,
            'navigation_breadcrumb_source' => 'fotogrids',
            'navigation_show_back_button' => true,
            'navigation_back_button_show_album_name' => true,
            'display_exif' => false,
            'exif_camera' => true,
            'exif_aperture' => true,
            'exif_shutter_speed' => true,
            'exif_iso' => true,
            'exif_lens' => false,
            'exif_focal_length' => false,
            'exif_date_taken' => false,
            'exif_copyright' => false,
            'exif_orientation' => false,
            'exif_flash' => false,
            'exif_white_balance' => false,
            'exif_exposure_mode' => false,
            'custom_css' => '',
            'custom_js' => '',
            // Default follows the global plugin setting so admins can opt in
            // site-wide without having to flip the toggle on every collection.
            'custom_js_allow_dynamic_execution' => (bool) get_option( 'fotogrids_custom_js_allow_dynamic_execution', false ),
        );

        // Process defaults for is_defaults_page
        $defaults = self::process_defaults_array( $defaults, $is_defaults_page );

        // Apply filter
        return apply_filters( 'fotogrids/settings/defaults/base', $defaults, $is_defaults_page );
    }

    /**
     * Get gallery-specific defaults
     *
     * @param bool $is_defaults_page If true, use second item from array defaults
     * @return array Gallery-specific default settings
     */
    public static function get_gallery_defaults( $is_defaults_page = false ) {
        // Gallery-specific defaults can be added here as needed
        $defaults = array();

        return apply_filters( 'fotogrids/settings/defaults/gallery', $defaults, $is_defaults_page );
    }

    /**
     * Get album-specific defaults
     *
     * @param bool $is_defaults_page If true, use second item from array defaults
     * @return array Album-specific default settings
     */
    public static function get_album_defaults( $is_defaults_page = false ) {
        // Album-specific defaults can be added here as needed
        $defaults = array();

        return apply_filters( 'fotogrids/settings/defaults/album', $defaults, $is_defaults_page );
    }

    /**
     * Process defaults array values based on is_defaults_page flag
     *
     * @param array $defaults The defaults array to process
     * @param bool $is_defaults_page If true, use second item from array defaults
     * @return array Processed defaults
     */
    private static function process_defaults_array( $defaults, $is_defaults_page ) {
        foreach ( $defaults as $key => $value ) {
            if ( is_array( $value ) && ! isset( $value['desktop'] ) && ! isset( $value['value'] ) && ! isset( $value['unit'] ) ) {
                if ( $is_defaults_page && isset( $value[1] ) ) {
                    $defaults[$key] = $value[1];
                } elseif ( ! $is_defaults_page && isset( $value[0] ) ) {
                    $defaults[$key] = $value[0];
                }
            }
        }
        return $defaults;
    }
}
