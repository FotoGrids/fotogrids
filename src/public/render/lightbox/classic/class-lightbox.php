<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Classic;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Lightbox feature module.
 *
 * Active when click_behavior === 'lightbox'. Responsible for:
 *
 * 1. Writing data-fg-click="lightbox" and all data-fg-lb-* settings onto the
 *    gallery wrapper so the JS singleton can read per-gallery configuration
 *    without any global state.
 *
 * 2. Declaring the lightbox JS and CSS assets so the Asset_Resolver enqueues
 *    them only when a lightbox gallery is actually on the page.
 *
 * Data attribute contract (JS reads these from the gallery wrapper element):
 *
 *   data-fg-click                    = "lightbox"
 *   data-fg-lb-theme                 = "dark" | "light" | "custom"
 *
 * Colour attributes (all themes - JS reads these to build the per-gallery <style> block):
 *   data-fg-lb-bg                        rgba - backdrop background
 *   data-fg-lb-toolbar-bg                rgba - toolbar background
 *   data-fg-lb-toolbar-btn-color         rgba - toolbar icon colour
 *   data-fg-lb-toolbar-btn-hover         rgba - toolbar icon hover colour
 *   data-fg-lb-toolbar-btn-active-bg     rgba - active toggle button background
 *   data-fg-lb-arrow-bg                  rgba - nav arrow button background
 *   data-fg-lb-arrow-bg-hover            rgba - nav arrow button hover background
 *   data-fg-lb-arrow-hover-color         rgba - nav arrow icon hover colour
 *   data-fg-lb-bullet-color              rgba - dot fill colour
 *   data-fg-lb-bullet-hover-color        rgba - dot hover colour
 *   data-fg-lb-bullet-active-color       rgba - active dot colour
 *   data-fg-lb-thumbs-bg                 rgba - thumbnail strip background
 *   data-fg-lb-thumb-border-color        rgba - thumbnail hover border
 *   data-fg-lb-thumb-active-color        rgba - active thumbnail border
 *   data-fg-lb-info-bg                   rgba - info panel (sidebar/overlay) background
 *   data-fg-lb-info-block-bg             rgba - individual info block card background
 *   data-fg-lb-info-text                 rgba - info panel caption text
 *   data-fg-lb-info-title                rgba - info panel title text
 *   data-fg-lb-spinner-color             rgba - loading spinner colour
 *   data-fg-lb-img-shadow                rgba - image drop-shadow colour (only when shadow enabled)
 *
 * Behaviour / layout attributes:
 *   data-fg-lb-transition            = "fade" | "horizontal" | "vertical" | "none"
 *   data-fg-lb-duration              = "300"                  (ms, integer string)
 *   data-fg-lb-auto-progress         = "1" | omitted
 *   data-fg-lb-auto-delay            = "5"                    (seconds, integer string)
 *   data-fg-lb-fit-media             = "1" | omitted
 *   data-fg-lb-mobile-layout         = "mobile_optimized" | "desktop"
 *   data-fg-lb-show-arrows           = "1" | omitted
 *   data-fg-lb-arrow-icon            = "chevron" | "chevron_double" | "arrow" | "arrow_narrow" | "arrow_square" | "arrow_circle" | "arrow_circle_broken" | "arrow_block"
 *   data-fg-lb-arrow-size            = "40"                   (px, integer string)
 *   data-fg-lb-show-dots             = "1" | omitted
 *   data-fg-lb-show-counter                                    (present = show "1 / N" counter in toolbar-start)
 *   data-fg-lb-dot-style             = "fill" | "stroke" | "square" | "square_stroke"
 *   data-fg-lb-dot-size              = "12"                  (px integer; absent = 12 default)
 *   data-fg-lb-dots-spacing          = "8px"
 *   data-fg-lb-thumbnail-location    = "none" | "bottom" | "top" | "left" | "right"
 *   data-fg-lb-thumbnail-size        = "small" | "normal" | "large"
 *   data-fg-lb-overlay-blur          = "2"                    (px integer; 0 = none)
 *   data-fg-lb-preload-slides        = "2"                    (integer; slides to preload ahead and behind; absent = 2)
 *   data-fg-lb-info-panel            = "on_click" | "never"   (absent = "always" default)
 *   data-fg-lb-info-location         = "left" | "bottom"      (absent = "right" default; omitted when info-panel=never)
 *   data-fg-lb-no-backdrop-close                              (present = disabled; absent = enabled)
 *   data-fg-lb-no-loop                                        (present = no-loop; absent = loop enabled)
 *   data-fg-lb-hide-arrows-at-ends                            (present = hide at first/last; absent = always show)
 *   data-fg-lb-progress-style        = "spinner" | "none"     (absent = "bar" default)
 *   data-fg-lb-progress-color        rgba                     progress indicator colour
 *   data-fg-lb-progress-bar-loc      = "top" | "left" | "right" (absent = "bottom" default)
 *   data-fg-lb-progress-pause-on     = "image_hover thumbnail_hover" (space-sep, absent = "image_hover" default)
 *   data-fg-lb-progress-stop                                   (present = stop on interaction)
 *   data-fg-lb-progress-controls                               (present = show play/pause controls)
 *   data-fg-lb-thumb-spacing         = "5"                    (px integer string, absent = 5 default)
 *   data-fg-lb-no-thumb-drag                                   (present = drag disabled; absent = enabled)
 *   data-fg-lb-no-thumb-swipe                                  (present = swipe disabled; absent = enabled)
 *   data-fg-lb-fullscreen                                      (present = fullscreen button shown)
 *   data-fg-lb-no-tooltips                                     (present = tooltips disabled)
 *   data-fg-lb-zoom                                            (present = zoom enabled)
 *   data-fg-lb-zoom-icons                                      (present = show zoom +/- icons)
 *   data-fg-lb-zoom-beyond                                     (present = allow zoom beyond original size)
 *   data-fg-lb-info-blocks           = "caption description ..." (space-sep ordered list of enabled blocks)
 *   data-fg-lb-info-blocks-style     = "boxed" | "divided" | "plain"
 *   data-fg-lb-info-block-divider    rgba - divider colour (only when style=divided)
 *   data-fg-lb-credit-source         = "exif"  (absent = "item_meta" default)
 *   data-fg-lb-exif-fields           = "camera aperture ..." (space-sep list of enabled EXIF field keys; absent = exif block disabled or display_exif off)
 *
 * Image filter attributes (desktop breakpoint values only - lightbox is fullscreen):
 *   data-fg-lb-thumb-filter          = combined CSS filter string for lightbox thumbnail strip images
 *                                      (e.g. "grayscale(50%) blur(3px)") - emitted only when thumbnail
 *                                      filter is enabled and at least one filter type is selected.
 *   data-fg-lb-thumb-filter-hover    = combined CSS filter string applied on thumbnail :hover
 *                                      - emitted only when thumbnail filter is enabled.
 *   data-fg-lb-full-filter           = combined CSS filter string for the main lightbox stage image
 *                                      (e.g. "sepia(80%)") - emitted only when full-image filter is
 *                                      enabled and at least one filter type is selected.
 *   data-fg-lb-full-filter-hover     = combined CSS filter string applied on main image :hover
 *                                      - emitted only when full-image filter is enabled.
 *
 * Attributes with a boolean nature follow the "presence = true, absence = false"
 * convention: they are only emitted when the setting is truthy. The JS reads them
 * with hasAttribute() or dataset checks rather than comparing against the string "true".
 *
 * @package FotoGrids\Render\Lightbox\Classic
 * @since   1.0.0
 */
final class Lightbox implements Feature {

    use Setting_Helpers;

    private const DEFAULT_INFO_BLOCKS = [ 'caption', 'description', 'file_info', 'exif', 'share', 'credit', 'tags', 'people', 'location' ];

    /** @var array<string, array{prev: string, next: string}>|null */
    private static ?array $arrow_icons_cache = null;

    /**
     * Loads arrow SVG pairs from arrow-icons.json, cached for the request.
     *
     * @return array<string, array{prev: string, next: string}>
     */
    private static function arrow_icons(): array {
        if ( self::$arrow_icons_cache !== null ) {
            return self::$arrow_icons_cache;
        }
        $path = __DIR__ . '/../shared/arrow-icons.json';
        if ( file_exists( $path ) ) {
            $decoded = json_decode( file_get_contents( $path ), true );
            if ( is_array( $decoded ) ) {
                self::$arrow_icons_cache = $decoded;
                return self::$arrow_icons_cache;
            }
        }
        // Fallback: bare chevrons so the lightbox always has something.
        self::$arrow_icons_cache = [
            'chevron' => [
                'prev' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                'next' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            ],
        ];
        return self::$arrow_icons_cache;
    }

    public function id(): string {
        return 'fotogrids/lightbox';
    }

    public function origin(): string {
        return 'fotogrids';
    }

    public function replaces(): ?string {
        return null;
    }

    public function extends_id(): ?string {
        return null;
    }

    public function supports( Render_Context $render_context ): bool {
        // Lightbox shows full-size attachment media for the items inside a
        // collection. Album items are themselves galleries (their click goes
        // to a view-page or AJAX-swaps to the child gallery), so there is
        // no "open this item in a lightbox" semantic. Opt out cleanly to
        // avoid polluting album wrappers with data-fg-click + data-fg-lb-*.
        if ( $render_context->meta->collection_kind === Collection_Kind::ALBUM ) {
            return false;
        }

        return $render_context->behavior->click_behavior === 'lightbox';
    }

    /**
     * Emits data-fg-click and all per-gallery lightbox configuration as
     * data-fg-lb-* attributes on the gallery wrapper element.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        $s    = $render_context->settings;
        $attrs = [ 'data-fg-click' => 'lightbox' ];

        // Theme
        $theme = \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::theme( $s );
        $attrs['data-fg-lb-theme'] = $theme;

        // ── Colour palette ────────────────────────────────────────────────────
        // The dark/light/custom palette is resolved by the shared
        // Lightbox_Colors helper (also used by LightboxGrid). attrs() returns
        // the always-on data-fg-lb-* colour map; the conditional colours
        // (info-block bg/divider, image shadow) are emitted below because they
        // depend on non-colour settings. $palette gives the resolved fallback
        // values those conditional emissions need. JS uses these to build the
        // full CSS variable block - no theme classes in SCSS.
        $attrs   = array_merge( $attrs, \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::attrs( $s ) );
        $palette = \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::palette( $s );

        // Info blocks style - drives visual separation between blocks.
        $info_blocks_style = is_string( $s['lightbox_info_blocks_style'] ?? null ) ? (string) $s['lightbox_info_blocks_style'] : 'boxed';
        $allowed_styles    = [ 'boxed', 'divided', 'plain' ];
        if ( ! in_array( $info_blocks_style, $allowed_styles, true ) ) {
            $info_blocks_style = 'boxed';
        }
        $attrs['data-fg-lb-info-blocks-style'] = $info_blocks_style;

        // Info block background - only when style = boxed.
        if ( $info_blocks_style === 'boxed' ) {
            $attrs['data-fg-lb-info-block-bg'] = $theme === 'custom'
                ? $this->safe_color( $s['lightbox_info_block_bg'] ?? null, $palette['info_block_bg'] )
                : $palette['info_block_bg'];
        }

        // Info block divider colour - only when style = divided.
        if ( $info_blocks_style === 'divided' ) {
            $attrs['data-fg-lb-info-block-divider'] = $theme === 'custom'
                ? $this->safe_color( $s['lightbox_info_block_divider'] ?? null, $palette['info_block_divider'] )
                : $palette['info_block_divider'];
        }

        // Image shadow - emitted only when the shadow is enabled.
        if ( $this->setting_to_bool( $s['lightbox_img_shadow_enabled'] ?? false ) ) {
            $shadow_color = $theme === 'custom'
                ? $this->safe_color( $s['lightbox_img_shadow_color'] ?? null, 'rgba(0, 0, 0, 0.3)' )
                : ( $theme === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.3)' );
            $attrs['data-fg-lb-img-shadow'] = $shadow_color;
        }

        // Transition
        $attrs['data-fg-lb-transition'] = is_string( $s['lightbox_transition'] ?? null ) ? (string) $s['lightbox_transition'] : 'fade';

        // Duration (ms) - when the button_group value is "custom", use the custom field.
        $duration_raw = $s['lightbox_transition_duration'] ?? 300;
        if ( $duration_raw === 'custom' ) {
            $duration = absint( $s['lightbox_transition_duration_custom'] ?? 400 );
        } else {
            $duration = absint( $duration_raw );
        }
        if ( $duration !== 300 ) {
            $attrs['data-fg-lb-duration'] = (string) $duration;
        }

        // Auto-progress (boolean - present = true)
        if ( $this->setting_to_bool( $s['lightbox_auto_progress'] ?? true ) ) {
            $attrs['data-fg-lb-auto-progress'] = '1';
            $delay = absint( $s['lightbox_auto_progress_delay'] ?? 5 );
            if ( $delay !== 5 ) {
                $attrs['data-fg-lb-auto-delay'] = (string) $delay;
            }

            // Progress indicator style (bar by default - omit attribute when bar).
            // Accepted values: "bar" (default, omitted) | "spinner" | "none".
            $progress_style = is_string( $s['lightbox_auto_progress_style'] ?? null ) ? (string) $s['lightbox_auto_progress_style'] : 'bar';
            if ( $progress_style !== 'bar' ) {
                $attrs['data-fg-lb-progress-style'] = $progress_style;
            }

            // Progress bar location (bottom by default - omit attribute when bottom)
            if ( $progress_style === 'bar' ) {
                $bar_loc = is_string( $s['lightbox_auto_progress_bar_location'] ?? null ) ? (string) $s['lightbox_auto_progress_bar_location'] : 'bottom';
                if ( $bar_loc !== 'bottom' ) {
                    $attrs['data-fg-lb-progress-bar-loc'] = $bar_loc;
                }
            }

            // Progress indicator colour - emitted for all themes when style ≠ none.
            if ( $progress_style !== 'none' ) {
                $progress_color_default = 'rgba(60, 70, 240, 1)'; // --fg-colors-blue
                $attrs['data-fg-lb-progress-color'] = $theme === 'custom'
                    ? $this->safe_color( $s['lightbox_progress_color'] ?? null, $progress_color_default )
                    : $progress_color_default;
            }

            // Pause-on: token_select stored as array (e.g. ['image_hover', 'click']).
            $pause_on_raw = $s['lightbox_auto_progress_pause_on'] ?? [ 'image_hover' ];
            if ( is_array( $pause_on_raw ) && ! empty( $pause_on_raw ) ) {
                $pause_on_clean = array_intersect( array_map( 'strval', $pause_on_raw ), [ 'image_hover', 'thumbnail_hover' ] );
                if ( ! empty( $pause_on_clean ) ) {
                    $attrs['data-fg-lb-progress-pause-on'] = implode( ' ', $pause_on_clean );
                }
            }

            // Stop on interaction (false by default - only emit when true)
            if ( $this->setting_to_bool( $s['lightbox_auto_progress_stop_on_interaction'] ?? true ) ) {
                $attrs['data-fg-lb-progress-stop'] = '';
            }

            // Show play/pause controls (false by default - only emit when true)
            if ( $this->setting_to_bool( $s['lightbox_auto_progress_show_controls'] ?? false ) ) {
                $attrs['data-fg-lb-progress-controls'] = '';
            }
        }

        // Fit media (boolean - present = true)
        if ( $this->setting_to_bool( $s['lightbox_fit_media'] ?? true ) ) {
            $attrs['data-fg-lb-fit-media'] = '1';
        }

        // Mobile layout
        $mob = is_string( $s['lightbox_mobile_layout'] ?? null ) ? (string) $s['lightbox_mobile_layout'] : 'mobile_optimized';
        if ( $mob !== 'mobile_optimized' ) {
            $attrs['data-fg-lb-mobile-layout'] = $mob;
        }

        // Arrows (boolean - present = true; arrows are ON by default so only write when ON)
        if ( $this->setting_to_bool( $s['lightbox_show_arrows'] ?? true ) ) {
            $attrs['data-fg-lb-show-arrows'] = '1';

            // Embed the SVG pair directly so JS never has to look them up from
            // window.FotoGridsIcons (which loads async and is admin-only).
            $arrow_icon_key = is_string( $s['lightbox_arrow_icon'] ?? null ) ? $s['lightbox_arrow_icon'] : 'chevron';
            $icons          = self::arrow_icons();
            $arrow_pair     = $icons[ $arrow_icon_key ] ?? $icons['chevron'];
            $attrs['data-fg-lb-arrow-prev'] = $arrow_pair['prev'];
            $attrs['data-fg-lb-arrow-next'] = $arrow_pair['next'];

            $arrow_size = absint( $s['lightbox_arrow_size'] ?? 40 );
            if ( $arrow_size !== 40 ) {
                $attrs['data-fg-lb-arrow-size'] = (string) $arrow_size;
            }

        }

        // Dots (boolean - present = true; dots are OFF by default so only write when ON)
        if ( $this->setting_to_bool( $s['lightbox_show_dots'] ?? false ) ) {
            $attrs['data-fg-lb-show-dots'] = '1';

            $dot_style = is_string( $s['lightbox_dot_style'] ?? null ) ? (string) $s['lightbox_dot_style'] : 'fill';
            if ( $dot_style !== 'fill' ) {
                $attrs['data-fg-lb-dot-style'] = $dot_style;
            }

            $dot_size = absint( $s['lightbox_dot_size'] ?? 12 );
            if ( $dot_size !== 12 ) {
                $attrs['data-fg-lb-dot-size'] = (string) $dot_size;
            }

            $dot_color = $this->safe_color( $s['lightbox_dot_color'] ?? null, '#ffffff' );
            if ( $dot_color !== '#ffffff' ) {
                $attrs['data-fg-lb-dot-color'] = $dot_color;
            }

            $dot_active_color = $this->safe_color( $s['lightbox_active_dot_color'] ?? null, '#007cba' );
            if ( $dot_active_color !== '#007cba' ) {
                $attrs['data-fg-lb-dot-active-color'] = $dot_active_color;
            }

            // dots spacing - stored as { value, unit } object or plain string
            $spacing_raw = $s['lightbox_dots_spacing'] ?? null;
            $spacing     = $this->normalize_unit_value( $spacing_raw, 'px' );
            if ( $spacing !== '' && $spacing !== '8px' ) {
                $attrs['data-fg-lb-dots-spacing'] = $spacing;
            }
        }

        // Counter (false by default - only emit when enabled)
        if ( $this->setting_to_bool( $s['lightbox_show_counter'] ?? false ) ) {
            $attrs['data-fg-lb-show-counter'] = '';
        }

        $blur = absint( $s['lightbox_overlay_blur'] ?? 8 );
        if ( $blur !== 8 ) {
            $attrs['data-fg-lb-overlay-blur'] = (string) $blur;
        }

        $preload_slides = absint( $s['lightbox_preload_slides'] ?? 2 );
        if ( $preload_slides !== 2 ) {
            $attrs['data-fg-lb-preload-slides'] = (string) $preload_slides;
        }

        // Info panel visibility
        $info_panel = is_string( $s['lightbox_info_panel'] ?? null ) ? (string) $s['lightbox_info_panel'] : 'always';
        if ( $info_panel !== 'always' ) {
            $attrs['data-fg-lb-info-panel'] = $info_panel;
        }

        // Info panel location (only relevant when panel is shown)
        if ( $info_panel !== 'never' ) {
            $info_location = is_string( $s['lightbox_info_panel_location'] ?? null ) ? (string) $s['lightbox_info_panel_location'] : 'right';
            if ( $info_location !== 'right' ) {
                $attrs['data-fg-lb-info-location'] = $info_location;
            }
        }

        // Backdrop close (true by default - only emit attribute when disabled)
        if ( ! $this->setting_to_bool( $s['lightbox_backdrop_close'] ?? true ) ) {
            $attrs['data-fg-lb-no-backdrop-close'] = '';
        }

        // Loop (true by default - only emit attribute when disabled)
        if ( ! $this->setting_to_bool( $s['lightbox_loop'] ?? true ) ) {
            $attrs['data-fg-lb-no-loop'] = '';
        }

        // Hide arrows at ends (false by default - only emit when enabled)
        if ( $this->setting_to_bool( $s['lightbox_hide_arrows_at_ends'] ?? false ) ) {
            $attrs['data-fg-lb-hide-arrows-at-ends'] = '';
        }

        // Fullscreen button (false by default - only emit when enabled)
        if ( $this->setting_to_bool( $s['lightbox_fullscreen'] ?? true ) ) {
            $attrs['data-fg-lb-fullscreen'] = '';
        }

        // Tooltips - enabled by default; emit absence-marker only when disabled
        if ( ! $this->setting_to_bool( $s['lightbox_show_tooltips'] ?? true ) ) {
            $attrs['data-fg-lb-no-tooltips'] = '';
        }

        // Zoom
        if ( $this->setting_to_bool( $s['lightbox_zoom'] ?? true ) ) {
            $attrs['data-fg-lb-zoom'] = '';

            $trigger = $s['lightbox_zoom_trigger'] ?? 'double_click';
            $allowed = array( 'double_click', 'click', 'wheel_pinch' );
            $attrs['data-fg-lb-zoom-trigger'] = in_array( $trigger, $allowed, true ) ? $trigger : 'double_click';

            if ( $this->setting_to_bool( $s['lightbox_zoom_icons'] ?? false ) ) {
                $attrs['data-fg-lb-zoom-icons'] = '';
            }

            if ( $this->setting_to_bool( $s['lightbox_zoom_beyond_original'] ?? true ) ) {
                $attrs['data-fg-lb-zoom-beyond'] = '';
            }
        }

        // Thumbnail strip
        $thumb_loc = is_string( $s['lightbox_thumbnail_strip_location'] ?? null ) ? (string) $s['lightbox_thumbnail_strip_location'] : 'bottom';
        // Always write thumbnail-location so JS knows whether to build the strip.
        $attrs['data-fg-lb-thumbnail-location'] = $thumb_loc;

        if ( $thumb_loc !== 'none' ) {
            $thumb_size = is_string( $s['lightbox_thumbnail_size'] ?? null ) ? (string) $s['lightbox_thumbnail_size'] : 'normal';
            if ( $thumb_size !== 'normal' ) {
                $attrs['data-fg-lb-thumbnail-size'] = $thumb_size;
            }

            // Thumbnail spacing (5 by default - omit when default)
            $thumb_spacing = absint( $s['lightbox_thumbnail_spacing'] ?? 5 );
            if ( $thumb_spacing !== 5 ) {
                $attrs['data-fg-lb-thumb-spacing'] = (string) $thumb_spacing;
            }

            // Thumbnail drag (true by default - emit attribute when disabled)
            if ( ! $this->setting_to_bool( $s['lightbox_thumbnail_drag'] ?? true ) ) {
                $attrs['data-fg-lb-no-thumb-drag'] = '';
            }

            // Thumbnail swipe (true by default - emit attribute when disabled)
            if ( ! $this->setting_to_bool( $s['lightbox_thumbnail_swipe'] ?? true ) ) {
                $attrs['data-fg-lb-no-thumb-swipe'] = '';
            }
        }

        // Info panel blocks - token_select stored as array.
        // Always emit so JS always has an explicit ordered list to render.
        if ( $info_panel !== 'never' ) {
            $info_blocks_raw   = $s['lightbox_info_blocks'] ?? self::DEFAULT_INFO_BLOCKS;
            $info_blocks_raw   = is_array( $info_blocks_raw ) ? $info_blocks_raw : [];
            $info_blocks_clean = array_values( array_filter( array_map( 'strval', $info_blocks_raw ) ) );
            if ( ! empty( $info_blocks_clean ) ) {
                $attrs['data-fg-lb-info-blocks'] = implode( ' ', $info_blocks_clean );
            }

            // Credit source - only relevant when credit block is enabled.
            if ( in_array( 'credit', $info_blocks_clean, true ) ) {
                $credit_source = is_string( $s['lightbox_credit_source'] ?? null ) ? (string) $s['lightbox_credit_source'] : 'item_meta';
                if ( $credit_source === 'exif' ) {
                    $attrs['data-fg-lb-credit-source'] = 'exif';
                }
            }

            // EXIF fields - which fields are enabled for display in the EXIF block.
            // Only emitted when the exif block is enabled and display_exif is on.
            if ( in_array( 'exif', $info_blocks_clean, true ) && $this->setting_to_bool( $s['display_exif'] ?? false ) ) {
                $exif_key_map = [
                    'exif_camera'        => 'camera',
                    'exif_aperture'      => 'aperture',
                    'exif_shutter_speed' => 'shutter_speed',
                    'exif_iso'           => 'iso',
                    'exif_lens'          => 'lens',
                    'exif_focal_length'  => 'focal_length',
                    'exif_date_taken'    => 'date_taken',
                    'exif_copyright'     => 'copyright',
                    'exif_orientation'   => 'orientation',
                    'exif_flash'         => 'flash',
                    'exif_white_balance' => 'white_balance',
                    'exif_exposure_mode' => 'exposure_mode',
                ];
                $enabled_fields = [];
                foreach ( $exif_key_map as $setting_key => $field_key ) {
                    if ( $this->setting_to_bool( $s[ $setting_key ] ?? true ) ) {
                        $enabled_fields[] = $field_key;
                    }
                }
                if ( ! empty( $enabled_fields ) ) {
                    $attrs['data-fg-lb-exif-fields'] = implode( ' ', $enabled_fields );
                }
            }
        }

        // ── Image filters ────────────────────────────────────────────────────
        // Thumbnail filter (applies to the lightbox thumbnail strip images).
        if ( $this->setting_to_bool( $s['thumbnail_filter_enabled'] ?? false ) ) {
            $thumb_filter = $this->build_filter_string( $s, 'thumbnail_filter_type', 'thumbnail_filter_amount_' );
            if ( $thumb_filter !== '' ) {
                $attrs['data-fg-lb-thumb-filter'] = $thumb_filter;
            }
            $thumb_filter_hover = $this->build_filter_string( $s, 'thumbnail_filter_type', 'thumbnail_filter_hover_amount_' );
            if ( $thumb_filter_hover !== '' ) {
                $attrs['data-fg-lb-thumb-filter-hover'] = $thumb_filter_hover;
            }
        }

        // Full-image filter (applies to the main lightbox stage image).
        if ( $this->setting_to_bool( $s['full_image_filter_enabled'] ?? false ) ) {
            $full_filter = $this->build_filter_string( $s, 'full_image_filter_type', 'full_image_filter_amount_' );
            if ( $full_filter !== '' ) {
                $attrs['data-fg-lb-full-filter'] = $full_filter;
            }
            $full_filter_hover = $this->build_filter_string( $s, 'full_image_filter_type', 'full_image_filter_hover_amount_' );
            if ( $full_filter_hover !== '' ) {
                $attrs['data-fg-lb-full-filter-hover'] = $full_filter_hover;
            }
        }

        return $attrs;
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    /**
     * Lightbox gallery items should show a pointer cursor.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function html_before( Render_Context $render_context ): string {
        return '';
    }

    public function html_appendix( Render_Context $render_context ): string {
        return '';
    }

    public function html_after( Render_Context $render_context ): string {
        return '';
    }

    /**
     * Declares the lightbox JS and CSS assets.
     *
     * Asset_Resolver base URL: plugin_url/public/render/
     * Paths below are relative from that base.
     *
     *   ../../assets/css/lightbox-styles.css → overlay styles (webpack: lightbox-styles entry)
     *   ../../assets/js/lightbox.js          → overlay JS    (webpack: lightbox entry)
     *
     * Both the JS and SCSS sources now live alongside this file in
     * public/render/lightbox/classic/ and are compiled by webpack from there.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                // Tooltip styles - shared across all frontend surfaces.
                'fotogrids-tooltip' => new Asset_Decl(
                    path:      '../../assets/css/fg-tooltip.css',
                    in_footer: false,
                ),
                // Full overlay stylesheet compiled from lightbox.scss.
                'fotogrids-lightbox' => new Asset_Decl(
                    path:      '../../assets/css/lightbox-styles.css',
                    in_footer: false,
                ),
            ],
            js: [
                // Tooltip module - loaded before lightbox so FgTooltip is available.
                'fotogrids-tooltip' => new Asset_Decl(
                    path:      '../../assets/js/fg-tooltip.js',
                    deps:      [],
                    in_footer: true,
                ),
                'fotogrids-lightbox' => new Asset_Decl(
                    path:      '../../assets/js/lightbox.js',
                    deps:      [ 'fotogrids-tooltip' ],
                    in_footer: true,
                ),
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Returns $value if it looks like a valid CSS colour string, otherwise $default.
     *
     * Accepts:
     *   - 3- and 6-digit hex (#RGB, #RRGGBB)
     *   - 8-digit hex with alpha (#RRGGBBAA)
     *   - rgb() and rgba()
     *   - hsl() and hsla()
     *
     * The color picker (fg-color-picker.js) emits rgba() strings, so hex-only
     * validation would silently discard every user-picked colour.
     *
     * @since   1.0.0
     * @param   mixed  $value   Raw setting value.
     * @param   string $default Fallback colour string.
     * @return  string
     */
    private function safe_color( mixed $value, string $default ): string {
        if ( ! is_string( $value ) ) {
            return $default;
        }
        $v = trim( $value );
        if (
            preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v ) ||
            preg_match( '/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(\s*,\s*[\d.]+)?\s*\)$/', $v ) ||
            preg_match( '/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/', $v )
        ) {
            return $v;
        }
        return $default;
    }

    /**
     * Build a desktop-breakpoint CSS filter string from a multi-select filter
     * type setting and the corresponding per-filter amount settings.
     *
     * Lightbox is always fullscreen, so only the desktop breakpoint value is
     * needed (responsive CSS vars are not scoped inside the lightbox dialog).
     *
     * Example output: "grayscale(50%) blur(3px)"
     * Empty string is returned when no valid filter types are selected.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $s            Full settings array.
     * @param   string               $type_key     Settings key that holds the filter type array
     *                                             (e.g. 'thumbnail_filter_type').
     * @param   string               $amount_prefix Settings key prefix for per-filter amounts
     *                                             (e.g. 'thumbnail_filter_amount_').
     * @return  string  Combined CSS filter string, or '' when nothing is selected.
     */
    private function build_filter_string( array $s, string $type_key, string $amount_prefix ): string {
        $allowed = [
            'grayscale', 'sepia', 'blur', 'brightness', 'contrast',
            'saturate', 'invert', 'opacity', 'hue-rotate',
        ];

        $filter_meta = [
            'grayscale'  => [ 'suffix' => 'grayscale',  'unit' => '%'   ],
            'sepia'      => [ 'suffix' => 'sepia',       'unit' => '%'   ],
            'blur'       => [ 'suffix' => 'blur',        'unit' => 'px'  ],
            'brightness' => [ 'suffix' => 'brightness',  'unit' => '%'   ],
            'contrast'   => [ 'suffix' => 'contrast',    'unit' => '%'   ],
            'saturate'   => [ 'suffix' => 'saturate',    'unit' => '%'   ],
            'invert'     => [ 'suffix' => 'invert',      'unit' => '%'   ],
            'opacity'    => [ 'suffix' => 'opacity',     'unit' => '%'   ],
            'hue-rotate' => [ 'suffix' => 'hue_rotate',  'unit' => 'deg' ],
        ];

        // Decode the token_select value (JSON string, PHP array, or legacy plain string).
        $raw = $s[ $type_key ] ?? [];
        if ( is_string( $raw ) ) {
            $decoded = json_decode( $raw, true );
            $raw     = is_array( $decoded ) ? $decoded : [ $raw ];
        }
        if ( ! is_array( $raw ) ) {
            return '';
        }

        $parts = [];
        foreach ( $raw as $type ) {
            if ( ! is_string( $type ) || ! in_array( $type, $allowed, true ) ) {
                continue;
            }
            $meta   = $filter_meta[ $type ];
            $key    = $amount_prefix . $meta['suffix'];
            $amount = $this->resolve_responsive_value( $s[ $key ] ?? [], 'desktop', $meta['unit'] );
            if ( $amount !== '' ) {
                $parts[] = $type . '(' . $amount . ')';
            }
        }

        return implode( ' ', $parts );
    }
}
