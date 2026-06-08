<?php
/**
 * Enqueue plumbing for the per-collection settings UI inside wp-admin.
 *
 * @package FotoGrids\Assets
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Assets;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Enqueues every script + stylesheet that the in-admin gallery / album
 * settings panel needs to render.
 *
 * Two surfaces call this: the gallery/album metabox on the post-edit screen,
 * and the standalone admin settings page. The two flags on `enqueue()` let
 * each surface opt in to the bits it actually wants (the metabox does want
 * the CodeMirror editor; the settings page does not).
 *
 * @since 1.0.0
 */
final class Collection_Settings_Assets {

    /**
     * Names of the render-helper modules that ship under
     * `assets/admin/plain/render-settings/*.js`. Each one becomes a registered
     * script with a derived handle (`fotogrids-render-foo`).
     *
     * @var string[]
     */
    private const RENDER_FUNCTIONS = [
        'renderCustomUnitSelect',
        'renderResponsiveRange',
        'renderLayoutGrid',
        'renderHoverEffectsGrid',
        'renderButtonGroup',
        'renderButtonGroupDynamic',
        'renderAlignmentGrid',
        'renderImageSize',
        'renderColorPicker',
        'renderPasswordInput',
        'renderRange',
        'renderTextInput',
        'renderSelect',
        'renderFontFamily',
        'renderFontWeight',
        'renderSideBySide',
        'renderToggle',
        'renderConditionalMessage',
        'renderSettingSubTabs',
        'renderBulkModal',
        'renderExternalUrlManager',
        'renderGroup',
        'renderCodeArea',
        'renderPromo',
        'renderInfoBlock',
        'renderTokenSelect',
        'renderCacheStatus',
        'renderWatermarkStatus',
        'renderImagePicker',
    ];

    /**
     * Render helpers that display Pro badges; they must depend on the shared
     * tooltip utility so the badge tooltip renders before they paint.
     *
     * @var string[]
     */
    private const USES_PRO_BADGES = [
        'renderButtonGroup',
        'renderButtonGroupDynamic',
        'renderLayoutGrid',
        'renderHoverEffectsGrid',
        'renderTokenSelect',
    ];

    /**
     * Enqueue every script + stylesheet the settings panel needs.
     *
     * @since 1.0.0
     * @param bool $enqueue_settings_loader Whether to enqueue the settings loader script.
     * @param bool $enqueue_codemirror      Whether to enqueue codemirror-init.
     */
    public static function enqueue( bool $enqueue_settings_loader = true, bool $enqueue_codemirror = false ): void {
        if ( $enqueue_settings_loader ) {
            wp_enqueue_script(
                'fotogrids-settings-loader',
                FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings/index.js',
                [],
                FOTOGRIDS_VERSION,
                true
            );
        }

        self::enqueue_fg_tooltip();

        if ( $enqueue_codemirror ) {
            wp_enqueue_script(
                'fotogrids-codemirror-init',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/codemirror-init.js',
                [],
                FOTOGRIDS_VERSION,
                true
            );
        }

        self::enqueue_render_helper_utils();

        foreach ( self::RENDER_FUNCTIONS as $function ) {
            self::enqueue_render_function( $function );
        }

        wp_enqueue_script(
            'fotogrids-collection-settings',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings.js',
            [
                'wp-element',
                'wp-components',
                'wp-i18n',
                'jquery',
                'fotogrids-icons',
                'fotogrids-settings-loader',
                'fotogrids-ui-state-manager',
                'fotogrids-post-type-placeholders',
            ],
            FOTOGRIDS_VERSION,
            true
        );
    }

    /**
     * fg-tooltip — the shared lightweight tooltip used on the frontend.
     * Reused inside wp-admin (shortcode metabox copy button, docs strip
     * links) so tooltip styling matches the public surface. Picks up any
     * element with [data-fg-tooltip] on DOMContentLoaded.
     */
    private static function enqueue_fg_tooltip(): void {
        wp_enqueue_style(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-tooltip.css',
            [],
            FOTOGRIDS_VERSION
        );
        wp_enqueue_script(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/fg-tooltip.js',
            [],
            FOTOGRIDS_VERSION,
            true
        );
    }

    /**
     * Standalone helpers under `render-settings/utils/`. Must load before any
     * render-* script (and before collection-settings itself).
     */
    private static function enqueue_render_helper_utils(): void {
        // Tooltip utilities - must load before any Pro-badge render helper.
        wp_enqueue_script(
            'fotogrids-tooltip-utils',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/tooltip-utils.js',
            [ 'wp-element' ],
            FOTOGRIDS_VERSION,
            true
        );

        // Post-type placeholder helpers — single source of truth for
        // {postType} replacement, used by collection-settings.js (translation
        // pass) and any render helper that reads raw placeholder strings
        // (e.g. renderCodeArea hints).
        wp_enqueue_script(
            'fotogrids-post-type-placeholders',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/post-type-placeholders.js',
            [],
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-fg-color-picker',
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/fg-color-picker.js',
            [],
            FOTOGRIDS_VERSION,
            true
        );
    }

    /**
     * Enqueue one render-helper script with its computed dependency list.
     *
     * @param string $function The render-helper function name (camelCase).
     */
    private static function enqueue_render_function( string $function ): void {
        $dependencies = [
            'wp-element',
            'wp-components',
            'wp-i18n',
            'fotogrids-icons',
            'fotogrids-post-type-placeholders',
        ];

        // The image picker calls wp.apiFetch to resolve thumbnail URLs and
        // wp.media to open the upload modal.
        if ( $function === 'renderImagePicker' ) {
            $dependencies[] = 'wp-api-fetch';
            wp_enqueue_media();
        }

        if ( in_array( $function, self::USES_PRO_BADGES, true ) ) {
            $dependencies[] = 'fotogrids-tooltip-utils';
        }

        if ( $function === 'renderCodeArea' ) {
            $dependencies[] = 'fotogrids-codemirror-init';
        }

        if ( $function === 'renderColorPicker' ) {
            $dependencies[] = 'fotogrids-fg-color-picker';
        }

        if ( in_array( $function, [ 'renderRange', 'renderResponsiveRange' ], true ) ) {
            $dependencies[] = 'fotogrids-render-custom-unit-select';
        }

        if ( in_array( $function, [ 'renderFontFamily', 'renderFontWeight' ], true ) ) {
            $dependencies[] = 'fotogrids-render-select';
        }

        wp_enqueue_script(
            'fotogrids-' . strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $function ) ),
            FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/' . $function . '.js',
            $dependencies,
            FOTOGRIDS_VERSION,
            true
        );
    }
}
