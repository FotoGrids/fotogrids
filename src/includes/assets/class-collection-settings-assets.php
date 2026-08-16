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
 * and the standalone admin settings page. The flag on `enqueue()` lets each
 * surface opt in to the bits it actually wants.
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
	private const RENDER_FUNCTIONS = array(
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
		'renderFontStyle',
		'renderSideBySide',
		'renderToggle',
		'renderConditionalMessage',
		'renderSettingSubTabs',
		'renderBulkModal',
		'renderExternalUrlManager',
		'renderGroup',
		'renderPromo',
		'renderInfoBlock',
		'renderTokenSelect',
		'renderCacheStatus',
		'renderWatermarkStatus',
		'renderImagePicker',
	);

	/**
	 * Render helpers that display Pro badges; they must depend on the shared
	 * tooltip utility so the badge tooltip renders before they paint.
	 *
	 * @var string[]
	 */
	private const USES_PRO_BADGES = array(
		'renderButtonGroup',
		'renderButtonGroupDynamic',
		'renderLayoutGrid',
		'renderHoverEffectsGrid',
		'renderTokenSelect',
	);

	/**
	 * Enqueue every script + stylesheet the settings panel needs.
	 *
	 * @since 1.0.0
	 * @param bool $enqueue_settings_loader Whether to enqueue the settings loader script.
	 */
	public static function enqueue( bool $enqueue_settings_loader = true ): void {
		if ( $enqueue_settings_loader ) {
			wp_enqueue_script(
				'fotogrids-settings-loader',
				FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings/index.js',
				array(),
				FOTOGRIDS_VERSION,
				true
			);
		}

		self::enqueue_fg_tooltip();
		self::enqueue_hover_effect_previews();

		self::enqueue_render_helper_utils();

		foreach ( self::RENDER_FUNCTIONS as $function ) {
			self::enqueue_render_function( $function );
		}

		wp_enqueue_script(
			'fotogrids-collection-settings',
			FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/collection-settings.js',
			array(
				'wp-element',
				'wp-components',
				'wp-i18n',
				'jquery',
				'fotogrids-icons',
				'fotogrids-settings-loader',
				'fotogrids-ui-state-manager',
				'fotogrids-post-type-placeholders',
			),
			FOTOGRIDS_VERSION,
			true
		);
	}

	/**
	 * Enqueues the hover-effect base CSS plus every registered effect's preview
	 * CSS so the hover-effect grid cards animate using the real effect rules.
	 * Preview CSS for Pro teasers ships in Free, so cards animate before Pro is
	 * installed.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	private static function enqueue_hover_effect_previews(): void {
		if ( ! class_exists( \FotoGrids\Render\Internal\Hover_Effect_Registry::class ) ) {
			return;
		}

		wp_enqueue_style(
			'fotogrids-hover-base',
			FOTOGRIDS_PLUGIN_URL . 'public/render/decorators/hover/base.css',
			array(),
			FOTOGRIDS_VERSION
		);

		wp_enqueue_style(
			'fotogrids-hover-preview-chrome',
			FOTOGRIDS_PLUGIN_URL . 'public/render/decorators/hover/preview-chrome.css',
			array( 'fotogrids-hover-base' ),
			FOTOGRIDS_VERSION
		);

		foreach ( \FotoGrids\Render\Internal\Hover_Effect_Registry::all() as $effect ) {
			if ( null === $effect->preview_css_path || '' === $effect->preview_css_path ) {
				continue;
			}

			wp_enqueue_style(
				'fotogrids-hover-preview-' . $effect->id,
				FOTOGRIDS_PLUGIN_URL . $effect->preview_css_path,
				array( 'fotogrids-hover-base' ),
				FOTOGRIDS_VERSION
			);
		}
	}

	/**
	 * fg-tooltip - the shared lightweight tooltip used on the frontend.
	 * Reused inside wp-admin (shortcode metabox copy button, docs strip
	 * links) so tooltip styling matches the public surface. Picks up any
	 * element with [data-fg-tooltip] on DOMContentLoaded.
	 */
	private static function enqueue_fg_tooltip(): void {
		wp_enqueue_style(
			'fotogrids-fg-tooltip',
			FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-tooltip.css',
			array(),
			FOTOGRIDS_VERSION
		);
		wp_enqueue_script(
			'fotogrids-fg-tooltip',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/fg-tooltip.js',
			array(),
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
			array( 'wp-element' ),
			FOTOGRIDS_VERSION,
			true
		);

		// Post-type placeholder helpers - single source of truth for
		// {postType} replacement, used by collection-settings.js (translation
		// pass) and any render helper that reads raw placeholder strings.
		wp_enqueue_script(
			'fotogrids-post-type-placeholders',
			FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/post-type-placeholders.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_script(
			'fotogrids-fg-color-picker',
			FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/utils/fg-color-picker.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);
	}

	/**
	 * Enqueue one render-helper script with its computed dependency list.
	 *
	 * @param string $function The render-helper function name (camelCase).
	 */
	private static function enqueue_render_function( string $function_name ): void {
		$dependencies = array(
			'wp-element',
			'wp-components',
			'wp-i18n',
			'fotogrids-icons',
			'fotogrids-post-type-placeholders',
		);

		// The image picker calls wp.apiFetch to resolve thumbnail URLs and
		// wp.media to open the upload modal.
		if ( 'renderImagePicker' === $function_name ) {
			$dependencies[] = 'wp-api-fetch';
			wp_enqueue_media();
		}

		if ( in_array( $function_name, self::USES_PRO_BADGES, true ) ) {
			$dependencies[] = 'fotogrids-tooltip-utils';
		}

		if ( 'renderColorPicker' === $function_name ) {
			$dependencies[] = 'fotogrids-fg-color-picker';
		}

		if ( in_array( $function_name, array( 'renderRange', 'renderResponsiveRange' ), true ) ) {
			$dependencies[] = 'fotogrids-render-custom-unit-select';
		}

		if ( in_array( $function_name, array( 'renderFontFamily', 'renderFontWeight', 'renderFontStyle' ), true ) ) {
			$dependencies[] = 'fotogrids-render-select';
		}

		wp_enqueue_script(
			'fotogrids-' . strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $function_name ) ),
			FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/render-settings/' . $function_name . '.js',
			$dependencies,
			FOTOGRIDS_VERSION,
			true
		);
	}
}
