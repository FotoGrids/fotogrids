<?php
namespace FotoGrids;

use FotoGrids\Hooks\Filters_Settings;

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
     * Resolve the full default settings for a gallery (base + gallery-specific + filter).
     *
     * Single entry point for gallery defaults. Callers should use this instead
     * of composing `get_base_defaults()` + `get_gallery_defaults()` themselves.
     *
     * @since 1.0.0
     * @param bool $is_defaults_page If true, use second item from array defaults
     *                               (for settings with isGlobalDefault options).
     * @return array Default gallery settings.
     */
    public static function resolve_gallery( $is_defaults_page = false ) {
        $defaults = array_merge(
            self::get_base_defaults( $is_defaults_page ),
            self::get_gallery_defaults( $is_defaults_page )
        );

        return apply_filters( Filters_Settings::DEFAULTS_GALLERY, $defaults, $is_defaults_page );
    }

    /**
     * Resolve the full default settings for an album (base + album-specific + filter).
     *
     * @since 1.0.0
     * @param bool $is_defaults_page If true, use second item from array defaults.
     * @return array Default album settings.
     */
    public static function resolve_album( $is_defaults_page = false ) {
        $defaults = array_merge(
            self::get_base_defaults( $is_defaults_page ),
            self::get_album_defaults( $is_defaults_page )
        );

        return apply_filters( Filters_Settings::DEFAULTS_ALBUM, $defaults, $is_defaults_page );
    }

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
            'layout_item_aspect_ratio' => '4/3',
            'layout_item_aspect_ratio_w' => 4,
            'layout_item_aspect_ratio_h' => 3,
            'layout_item_object_fit' => 'cover',
            // Masonry-only.
            'layout_masonry_order' => 'row',
            // Instant Photos-only.
            'instant_photo_max_rotation' => array(
                'desktop' => 15,
                'tablet'  => 12,
                'mobile'  => 8,
            ),
            'instant_photo_hover_action' => 'straighten',
            'instant_photo_elevation' => true,
            'instant_photo_sticker' => false,
            'instant_photo_sticker_color' => 'rgba(225, 210, 175, 0.85)',
            'instant_photo_sticker_hide_on_hover' => false,
            'instant_photo_frame_thickness' => array(
                'desktop' => 16,
                'tablet'  => 14,
                'mobile'  => 12,
            ),
            // Justified-only.
            'layout_justified_row_height' => array(
                'desktop' => 220,
                'tablet'  => 180,
                'mobile'  => 140,
            ),
            'layout_justified_row_height_tolerance' => 25,
            'layout_justified_last_row' => 'nojustify',
            'layout_justified_max_rows' => 0,
            'layout_justified_page_trailing_row' => 'fill',
            'layout_justified_snap_window' => 20,
            'layout_justified_snap_fill_threshold' => 85,
            'layout_justified_snap_direction' => 'auto',
            // Slider-only items-per-view.
            'layout_items_per_view' => array(
                'desktop' => 3,
                'tablet'  => 2,
                'mobile'  => 1,
            ),
            // Height (Slider / Image Viewer).
            'layout_height_mode'  => 'auto',
            'layout_height_fixed' => array(
                'desktop' => 500,
                'tablet'  => 400,
                'mobile'  => 300,
            ),
            'layout_height_max'   => array(
                'desktop' => 0,
                'tablet'  => 0,
                'mobile'  => 0,
            ),
            // Navigation (Image Viewer / Slider).
            'layout_loop' => true,
            'layout_show_counter' => false,
            'layout_autoplay' => false,
            'layout_autoplay_delay' => 4000,
            'layout_autoplay_pause_on_hover' => true,
            // Transition.
            'layout_transition' => 'horizontal',
            'layout_transition_duration' => 'normal',
            'layout_transition_duration_custom' => 300,
            // Arrows.
            'layout_show_arrows' => true,
            'layout_arrow_icon' => 'chevron',
            'layout_arrow_size' => array(
                'value' => 40,
                'unit'  => 'px',
            ),
            'layout_arrows_location' => 'inset',
            'layout_arrow_distance' => array(
                'value' => 8,
                'unit'  => 'px',
            ),
            'layout_arrows_reserve_space' => false,
            'layout_arrows_visibility' => 'always',
            'layout_hide_arrows_at_ends' => false,
            // Bullets.
            'layout_show_bullets' => true,
            'layout_bullet_style' => 'fill',
            'layout_bullet_size' => array(
                'value' => 10,
                'unit'  => 'px',
            ),
            'layout_bullets_spacing' => array(
                'value' => 8,
                'unit'  => 'px',
            ),
            'layout_bullets_location' => 'bottom',
            'layout_bullet_distance' => array(
                'value' => 8,
                'unit'  => 'px',
            ),
            'layout_bullets_visibility' => 'always',
            // Thumbnails (slider).
            'layout_thumbnails_show' => false,
            'layout_thumbnails_location' => 'bottom',
            'layout_thumbnails_size' => 'normal',
            'layout_thumbnails_spacing' => 5,
            'layout_thumbnails_drag' => true,
            'layout_thumbnails_swipe' => true,
            // Lightbox scope (only consulted for single-item layout).
            'lightbox_scope' => 'gallery',
            // Interactions: zoom.
            'interactions_zoom' => false,
            'interactions_zoom_mode' => 'hover',
            'interactions_zoom_style' => 'inline',
            'interactions_zoom_hover_delay' => 300,
            'interactions_zoom_popover_bg' => 'rgba(0, 0, 0, 0.2)',
            'interactions_zoom_popover_bg_blur' => 8,
            'interactions_zoom_popover_padding' => 24,
            'interactions_zoom_popover_close_button' => true,
            'interactions_zoom_popover_click_outside_to_close' => true,
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
            'loading_icon_color' => 'rgba(0, 0, 0, 0.2)',
            'loaded_effect' => 'fade',
            'lightbox' => true,
            'captions' => true,
            'lazy_load' => true,
            'lightbox_preload_slides' => 2,
            // Thumbnail background (regular / hover / loading).
            'background_enabled' => false,
            'background_color' => 'rgba(0,0,0,0)',
            'background_hover_color' => 'rgba(0,0,0,0)',
            'background_loading_color' => 'rgba(0,0,0,0)',
            'border_radius' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'border_enabled' => false,
            // Border - regular state.
            'border_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'border_color' => '#000000',
            'border_style' => 'solid',
            // Border - hover (mouseover) state.
            'border_hover_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'border_hover_color' => '#000000',
            'border_hover_style' => 'solid',
            // Border - loading state.
            'border_loading_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'border_loading_color' => '#000000',
            'border_loading_style' => 'solid',
            'shadow_enabled' => false,
            // Shadow - regular state.
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
            // Shadow - hover (mouseover) state.
            'shadow_hover_color' => 'rgba(0,0,0,0.5)',
            'shadow_hover_offset_x' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'shadow_hover_offset_y' => array(
                'desktop' => 4,
                'tablet' => 4,
                'mobile' => 4
            ),
            'shadow_hover_blur' => array(
                'desktop' => 10,
                'tablet' => 10,
                'mobile' => 10
            ),
            'shadow_hover_spread' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            // Shadow - loading state.
            'shadow_loading_color' => 'rgba(0,0,0,0.5)',
            'shadow_loading_offset_x' => array(
                'desktop' => 0,
                'tablet' => 0,
                'mobile' => 0
            ),
            'shadow_loading_offset_y' => array(
                'desktop' => 4,
                'tablet' => 4,
                'mobile' => 4
            ),
            'shadow_loading_blur' => array(
                'desktop' => 10,
                'tablet' => 10,
                'mobile' => 10
            ),
            'shadow_loading_spread' => array(
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
            // Full image background (regular / hover / loading).
            'full_image_background_enabled' => false,
            'full_image_background_color' => 'rgba(0,0,0,0)',
            'full_image_background_hover_color' => 'rgba(0,0,0,0)',
            'full_image_background_loading_color' => 'rgba(0,0,0,0)',
            // Full image border (regular / hover / loading).
            'full_image_border_enabled' => false,
            'full_image_border_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'full_image_border_color' => '#000000',
            'full_image_border_style' => 'solid',
            'full_image_border_hover_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'full_image_border_hover_color' => '#000000',
            'full_image_border_hover_style' => 'solid',
            'full_image_border_loading_width' => array(
                'desktop' => 1,
                'tablet' => 1,
                'mobile' => 1
            ),
            'full_image_border_loading_color' => '#000000',
            'full_image_border_loading_style' => 'solid',
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
            'filtering_multiple_enabled' => true,
            'filter_by' => array( 'tags' ),
            'date_filter_type' => 'date_taken',
            'filter_display_mode' => 'toggle',
            'filter_ui_position' => 'top',
            'filter_sidebar_side' => 'left',
            'filter_ui_style' => 'buttons',
            'show_filter_count' => true,
            'filter_reset_btn_enabled'  => true,
            'filter_reset_btn_position' => 'start',
            'filter_reset_btn_label'    => 'All',
            // Filter UI spacing - all responsive with px/em/rem units.
            'filter_wrapper_gap'   => array(
                'desktop' => 16,
                'tablet'  => 16,
                'mobile'  => 12,
            ),
            'filter_bar_gap'       => array(
                'desktop' => 8,
                'tablet'  => 8,
                'mobile'  => 6,
            ),
            'filter_gap'           => array(
                'desktop' => 8,
                'tablet'  => 8,
                'mobile'  => 6,
            ),
            'filter_sidebar_width' => array(
                'desktop' => 200,
                'tablet'  => 180,
                'mobile'  => 160,
            ),
            'filter_panel_padding' => array(
                'desktop' => 0,
                'tablet'  => 0,
                'mobile'  => 0,
            ),
            'filter_panel_bg'      => 'rgba(0, 0, 0, 0)',
            'filter_panel_radius'  => 12,
            // Button shape
            'filter_btn_padding'   => array(
                'desktop' => 8,
                'tablet'  => 8,
                'mobile'  => 8,
            ),
            'filter_btn_radius'    => 4,
            'filter_btn_font_size' => array(
                'desktop' => 14,
                'tablet'  => 14,
                'mobile'  => 13,
            ),
            // Button colors per state.
            'filter_btn_bg'                   => 'rgba(0, 0, 0, 0)',
            'filter_btn_color'                => 'rgba(0, 0, 0, 1)',
            'filter_btn_border_color'         => 'rgba(0, 0, 0, 1)',
            'filter_btn_border_width'         => 1,
            'filter_btn_hover_bg'             => 'rgba(60, 70, 240, 0.05)',
            'filter_btn_hover_color'          => 'rgba(60, 70, 240, 1)',
            'filter_btn_hover_border_color'   => 'rgba(60, 70, 240, 1)',
            'filter_btn_hover_border_width'   => 1,
            'filter_btn_active_bg'            => 'rgba(60, 70, 240, 1)',
            'filter_btn_active_color'         => 'rgba(255, 255, 255, 1)',
            'filter_btn_active_border_color'  => 'rgba(60, 70, 240, 1)',
            'filter_btn_active_border_width'  => 1,
            // Dropdown trigger - same shape as filter_btn_*.
            'filter_select_padding'             => array(
                'desktop' => 10,
                'tablet'  => 10,
                'mobile'  => 10,
            ),
            'filter_select_radius'              => 4,
            'filter_select_border_width'        => 1,
            // Per-state colours (Regular / Mouseover / Open).
            'filter_select_bg'                  => 'rgba(0, 0, 0, 0)',
            'filter_select_color'               => 'rgba(0, 0, 0, 1)',
            'filter_select_border_color'        => 'rgba(0, 0, 0, 0.3)',
            'filter_select_hover_bg'            => 'rgba(60, 70, 240, 0.05)',
            'filter_select_hover_color'         => 'rgba(0, 0, 0, 1)',
            'filter_select_hover_border_color'  => 'rgba(60, 70, 240, 1)',
            'filter_select_open_bg'             => 'rgba(60, 70, 240, 1)',
            'filter_select_open_color'          => 'rgba(255, 255, 255, 1)',
            'filter_select_open_border_color'   => 'rgba(60, 70, 240, 1)',
            // Dropdown popover - shared chrome (radius + border + separator)
            // plus per-option-state bg/text colours.
            'filter_dropdown_list_radius'              => 4,
            'filter_dropdown_list_border_color'        => 'rgba(0, 0, 0, 0.3)',
            'filter_dropdown_list_border_width'        => 1,
            'filter_dropdown_option_separator_color'   => 'rgba(0, 0, 0, 0.08)',
            'filter_dropdown_option_bg'                => 'rgba(255, 255, 255, 1)',
            'filter_dropdown_option_color'             => 'rgba(0, 0, 0, 1)',
            'filter_dropdown_option_hover_bg'          => 'rgba(60, 70, 240, 0.05)',
            'filter_dropdown_option_hover_color'       => 'rgba(60, 70, 240, 1)',
            'filter_dropdown_option_selected_bg'       => 'rgba(60, 70, 240, 1)',
            'filter_dropdown_option_selected_color'    => 'rgba(255, 255, 255, 1)',
            // Checkbox shape
            'filter_cb_size'   => 16,
            'filter_cb_radius' => 3,
            'filter_cb_gap'    => 8,
            // Checkbox border width (shared across states).
            'filter_cb_border_width'             => 1,
            // Checkbox colors - per state (unchecked / hover / checked).
            // Unchecked has no visible checkmark, so no checkmark key.
            'filter_cb_bg'                       => 'rgba(255, 255, 255, 1)',
            'filter_cb_border_color'             => 'rgba(0, 0, 0, 1)',
            'filter_cb_hover_bg'                 => 'rgba(255, 255, 255, 1)',
            'filter_cb_hover_border_color'       => 'rgba(60, 70, 240, 1)',
            'filter_cb_hover_checkmark_color'    => 'rgba(60, 70, 240, 0.3)',
            'filter_cb_checked_bg'               => 'rgba(60, 70, 240, 1)',
            'filter_cb_checked_border_color'     => 'rgba(60, 70, 240, 1)',
            'filter_cb_checked_checkmark_color'  => 'rgba(255, 255, 255, 1)',
            // Count badge
            // Count badge - per-state colours mirror filter_btn_* states so
            // the badge tracks its containing button's hover / active states.
            'filter_count_bg'           => 'rgba(0, 0, 0, 0.1)',
            'filter_count_color'        => 'rgba(0, 0, 0, 0.7)',
            'filter_count_hover_bg'     => 'rgba(60, 70, 240, 0.2)',
            'filter_count_hover_color'  => 'rgba(60, 70, 240, 1)',
            'filter_count_active_bg'    => 'rgba(255, 255, 255, 0.3)',
            'filter_count_active_color' => 'rgba(255, 255, 255, 1)',
            'filter_count_font_size'    => array(
                'desktop' => 12,
                'tablet'  => 12,
                'mobile'  => 11,
            ),
            'filter_count_radius'       => 3,
            'filter_count_padding'      => array(
                'desktop' => array( 'top' => 2, 'right' => 6, 'bottom' => 2, 'left' => 6 ),
                'tablet'  => array( 'top' => 2, 'right' => 6, 'bottom' => 2, 'left' => 6 ),
                'mobile'  => array( 'top' => 2, 'right' => 6, 'bottom' => 2, 'left' => 6 ),
            ),
            'items_per_page' => array(
                'desktop' => 12,
                'tablet' => 8,
                'mobile' => 6
            ),
            'load_more_button_text' => 'Load More',
            'load_more_button_alignment' => 'center',
            'load_more_button_full_width' => false,
            'pagination_button_font_family' => '',
            'pagination_button_font_weight' => '',
            'pagination_button_font_size' => array(
                'desktop' => 14,
                'tablet'  => 14,
                'mobile'  => 13,
            ),
            'pagination_button_bg' => 'rgba(255, 255, 255, 0)',
            'pagination_button_color' => 'rgba(0, 0, 0, 1)',
            'pagination_button_border_width' => 1,
            'pagination_button_border_color' => 'rgba(0, 0, 0, 1)',
            'pagination_button_hover_bg' => 'rgba(60, 70, 240, 0.05)',
            'pagination_button_hover_color' => 'rgba(0, 0, 0, 1)',
            'pagination_button_hover_border_color' => 'rgba(60, 70, 240, 1)',
            'pagination_button_active_bg' => 'rgba(60, 70, 240, 1)',
            'pagination_button_active_color' => 'rgba(255, 255, 255, 1)',
            'pagination_button_active_border_color' => 'rgba(60, 70, 240, 1)',
            'pagination_distance_from_items' => array(
                'desktop' => 16,
                'tablet'  => 16,
                'mobile'  => 16,
            ),
            'pagination_alignment' => 'stretch',
            'pages_show_prev_next' => true,
            'pages_prev_text' => 'Previous',
            'pages_next_text' => 'Next',
            'pages_button_icon' => 'chevron',
            'pages_show_numbers' => true,
            'pages_truncate' => true,
            'item_click_behavior' => 'lightbox',
            'external_link_target' => '_self',
            // Video items: how a video opens when clicked (inline | lightbox).
            'video_playback_mode' => 'inline',
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
            // Per-collection watermark opt-out. The watermark itself is now
            // configured site-wide (Plugin Settings → Watermark); a collection
            // can only opt out of having it applied.
            'watermark_apply_to_collection' => true,
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
        return apply_filters( Filters_Settings::DEFAULTS_BASE, $defaults, $is_defaults_page );
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

        return apply_filters( Filters_Settings::DEFAULTS_GALLERY, $defaults, $is_defaults_page );
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

        return apply_filters( Filters_Settings::DEFAULTS_ALBUM, $defaults, $is_defaults_page );
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
