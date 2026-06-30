<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Shared;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared Lightbox colour resolver.
 *
 * Single source of truth for the lightbox colour palette. Resolves the
 * per-theme (dark / light / custom) colour set into the canonical
 * data-fg-lb-* attribute map that the lightbox JS reads to build its CSS
 * variable block.
 *
 * Used by:
 *   - Classic Lightbox (Lightbox\Classic\Lightbox) - the full overlay.
 *   - LightboxGrid (Lightbox\Grid\Lightbox_Grid) - reuses the toolbar /
 *     backdrop colours so its chrome matches the gallery's lightbox theme.
 *
 * Only the always-present colour keys live here. Colours that depend on a
 * non-colour setting (info-block background/divider - gated on
 * info_blocks_style; image shadow - gated on img_shadow_enabled) stay in
 * the classic Lightbox because they are coupled to other behaviour.
 *
 * @package FotoGrids\Render\Lightbox\Shared
 * @since   1.0.0
 */
final class Lightbox_Colors {

	/**
	 * Dark theme colour defaults. All values are rgba() - no hex literals.
	 *
	 * @var array<string, string>
	 */
	private const DARK_DEFAULTS = array(
		'bg'                        => 'rgba(0, 0, 0, 0.92)',
		'toolbar_bg'                => 'rgba(0, 0, 0, 0.35)',
		'toolbar_btn_bg'            => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border'        => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_color'         => 'rgba(255, 255, 255, 0.7)',
		'toolbar_btn_bg_hover'      => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border_hover'  => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_hover'         => 'rgba(255, 255, 255, 1)',
		'toolbar_btn_bg_active'     => 'rgba(255, 255, 255, 0.15)',
		'toolbar_btn_border_active' => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_active_color'  => 'rgba(255, 255, 255, 1)',
		'toolbar_btn_bg_focus'      => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border_focus'  => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_focus_color'   => 'rgba(255, 255, 255, 1)',
		'arrow_bg'                  => 'rgba(0, 0, 0, 0.45)',
		'arrow_border'              => 'rgba(0, 0, 0, 0)',
		'arrow_color'               => 'rgba(255, 255, 255, 1)',
		'arrow_bg_hover'            => 'rgba(0, 0, 0, 0.75)',
		'arrow_border_hover'        => 'rgba(0, 0, 0, 0)',
		'arrow_hover_color'         => 'rgba(255, 255, 255, 1)',
		'arrow_bg_active'           => 'rgba(0, 0, 0, 0.75)',
		'arrow_border_active'       => 'rgba(0, 0, 0, 0)',
		'arrow_active_color'        => 'rgba(255, 255, 255, 1)',
		'arrow_bg_focus'            => 'rgba(0, 0, 0, 0.75)',
		'arrow_border_focus'        => 'rgba(0, 0, 0, 0)',
		'arrow_focus_color'         => 'rgba(255, 255, 255, 1)',
		'bullet_bg'                 => 'rgba(0, 0, 0, 0)',
		'bullet_border'             => 'rgba(255, 255, 255, 0.7)',
		'bullet_hover_bg'           => 'rgba(255, 255, 255, 0.3)',
		'bullet_hover_border'       => 'rgba(255, 255, 255, 0.8)',
		'bullet_active_bg'          => 'rgba(60, 70, 240, 1)',
		'bullet_active_border'      => 'rgba(60, 70, 240, 1)',
		'bullet_focus_bg'           => 'rgba(60, 70, 240, 1)',
		'bullet_focus_border'       => 'rgba(60, 70, 240, 1)',
		'thumbs_bg'                 => 'rgba(0, 0, 0, 0.7)',
		'thumb_border'              => 'rgba(0, 0, 0, 0)',
		'thumb_hover_border'        => 'rgba(255, 255, 255, 0.45)',
		'thumb_active'              => 'rgba(60, 70, 240, 1)',
		'thumb_focus_border'        => 'rgba(60, 70, 240, 1)',
		'info_bg'                   => 'rgba(0, 0, 0, 0.25)',
		'info_block_bg'             => 'rgba(255, 255, 255, 0.06)',
		'info_block_divider'        => 'rgba(255, 255, 255, 0.12)',
		'info_text'                 => 'rgba(255, 255, 255, 0.85)',
		'info_title'                => 'rgba(255, 255, 255, 1)',
		'spinner_color'             => 'rgba(255, 255, 255, 0.8)',
	);

	/**
	 * Light theme colour defaults.
	 *
	 * @var array<string, string>
	 */
	private const LIGHT_DEFAULTS = array(
		'bg'                        => 'rgba(255, 255, 255, 0.96)',
		'toolbar_bg'                => 'rgba(255, 255, 255, 0.35)',
		'toolbar_btn_bg'            => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border'        => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_color'         => 'rgba(0, 0, 0, 0.6)',
		'toolbar_btn_bg_hover'      => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border_hover'  => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_hover'         => 'rgba(0, 0, 0, 0.9)',
		'toolbar_btn_bg_active'     => 'rgba(0, 0, 0, 0.1)',
		'toolbar_btn_border_active' => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_active_color'  => 'rgba(0, 0, 0, 1)',
		'toolbar_btn_bg_focus'      => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_border_focus'  => 'rgba(0, 0, 0, 0)',
		'toolbar_btn_focus_color'   => 'rgba(0, 0, 0, 1)',
		'arrow_bg'                  => 'rgba(255, 255, 255, 0.75)',
		'arrow_border'              => 'rgba(0, 0, 0, 0)',
		'arrow_color'               => 'rgba(0, 0, 0, 0.8)',
		'arrow_bg_hover'            => 'rgba(255, 255, 255, 1)',
		'arrow_border_hover'        => 'rgba(0, 0, 0, 0)',
		'arrow_hover_color'         => 'rgba(0, 0, 0, 1)',
		'arrow_bg_active'           => 'rgba(255, 255, 255, 1)',
		'arrow_border_active'       => 'rgba(0, 0, 0, 0)',
		'arrow_active_color'        => 'rgba(0, 0, 0, 1)',
		'arrow_bg_focus'            => 'rgba(255, 255, 255, 1)',
		'arrow_border_focus'        => 'rgba(0, 0, 0, 0)',
		'arrow_focus_color'         => 'rgba(0, 0, 0, 1)',
		'bullet_bg'                 => 'rgba(0, 0, 0, 0)',
		'bullet_border'             => 'rgba(0, 0, 0, 0.7)',
		'bullet_hover_bg'           => 'rgba(0, 0, 0, 0.3)',
		'bullet_hover_border'       => 'rgba(0, 0, 0, 0.8)',
		'bullet_active_bg'          => 'rgba(60, 70, 240, 1)',
		'bullet_active_border'      => 'rgba(60, 70, 240, 1)',
		'bullet_focus_bg'           => 'rgba(60, 70, 240, 1)',
		'bullet_focus_border'       => 'rgba(60, 70, 240, 1)',
		'thumbs_bg'                 => 'rgba(0, 0, 0, 0.08)',
		'thumb_border'              => 'rgba(0, 0, 0, 0)',
		'thumb_hover_border'        => 'rgba(0, 0, 0, 0.3)',
		'thumb_active'              => 'rgba(60, 70, 240, 1)',
		'thumb_focus_border'        => 'rgba(60, 70, 240, 1)',
		'info_bg'                   => 'rgba(255, 255, 255, 0.25)',
		'info_block_bg'             => 'rgba(0, 0, 0, 0.04)',
		'info_block_divider'        => 'rgba(0, 0, 0, 0.12)',
		'info_text'                 => 'rgba(0, 0, 0, 0.7)',
		'info_title'                => 'rgba(0, 0, 0, 0.9)',
		'spinner_color'             => 'rgba(0, 0, 0, 0.6)',
	);

	/**
	 * Map of palette key => the custom-theme setting key it reads.
	 *
	 * @var array<string, string>
	 */
	private const CUSTOM_SETTING_KEYS = array(
		'bg'                        => 'lightbox_background_color',
		'toolbar_bg'                => 'lightbox_top_toolbar_background',
		'toolbar_btn_bg'            => 'lightbox_toolbar_btn_bg',
		'toolbar_btn_border'        => 'lightbox_toolbar_btn_border_color',
		'toolbar_btn_color'         => 'lightbox_toolbar_btn_arrow_color',
		'toolbar_btn_bg_hover'      => 'lightbox_toolbar_btn_hover_bg',
		'toolbar_btn_border_hover'  => 'lightbox_toolbar_btn_hover_border_color',
		'toolbar_btn_hover'         => 'lightbox_toolbar_btn_hover_arrow_color',
		'toolbar_btn_bg_active'     => 'lightbox_toolbar_btn_active_bg',
		'toolbar_btn_border_active' => 'lightbox_toolbar_btn_active_border_color',
		'toolbar_btn_active_color'  => 'lightbox_toolbar_btn_active_arrow_color',
		'toolbar_btn_bg_focus'      => 'lightbox_toolbar_btn_focus_bg',
		'toolbar_btn_border_focus'  => 'lightbox_toolbar_btn_focus_border_color',
		'toolbar_btn_focus_color'   => 'lightbox_toolbar_btn_focus_arrow_color',
		'arrow_bg'                  => 'lightbox_navigation_arrow_bg',
		'arrow_border'              => 'lightbox_navigation_arrow_border_color',
		'arrow_color'               => 'lightbox_navigation_arrow_arrow_color',
		'arrow_bg_hover'            => 'lightbox_navigation_arrow_hover_bg',
		'arrow_border_hover'        => 'lightbox_navigation_arrow_hover_border_color',
		'arrow_hover_color'         => 'lightbox_navigation_arrow_hover_arrow_color',
		'arrow_bg_active'           => 'lightbox_navigation_arrow_active_bg',
		'arrow_border_active'       => 'lightbox_navigation_arrow_active_border_color',
		'arrow_active_color'        => 'lightbox_navigation_arrow_active_arrow_color',
		'arrow_bg_focus'            => 'lightbox_navigation_arrow_focus_bg',
		'arrow_border_focus'        => 'lightbox_navigation_arrow_focus_border_color',
		'arrow_focus_color'         => 'lightbox_navigation_arrow_focus_arrow_color',
		'bullet_bg'                 => 'lightbox_bullet_bg',
		'bullet_border'             => 'lightbox_bullet_border_color',
		'bullet_hover_bg'           => 'lightbox_bullet_hover_bg',
		'bullet_hover_border'       => 'lightbox_bullet_hover_border_color',
		'bullet_active_bg'          => 'lightbox_bullet_active_bg',
		'bullet_active_border'      => 'lightbox_bullet_active_border_color',
		'bullet_focus_bg'           => 'lightbox_bullet_focus_bg',
		'bullet_focus_border'       => 'lightbox_bullet_focus_border_color',
		'thumbs_bg'                 => 'lightbox_thumbnails_background',
		'thumb_border'              => 'lightbox_thumbnail_border_color',
		'thumb_hover_border'        => 'lightbox_thumbnail_hover_border_color',
		'thumb_active'              => 'lightbox_thumbnail_active_border_color',
		'thumb_focus_border'        => 'lightbox_thumbnail_focus_border_color',
		'info_bg'                   => 'lightbox_info_panel_background',
		'info_block_bg'             => 'lightbox_info_block_bg',
		'info_block_divider'        => 'lightbox_info_block_divider',
		'info_text'                 => 'lightbox_info_panel_text',
		'info_title'                => 'lightbox_info_panel_title',
		'spinner_color'             => 'lightbox_spinner_color',
	);

	/**
	 * Map of palette key => the data-fg-lb-* attribute name it emits.
	 *
	 * @var array<string, string>
	 */
	private const ATTR_KEYS = array(
		'bg'                        => 'data-fg-lb-bg',
		'toolbar_bg'                => 'data-fg-lb-toolbar-bg',
		'toolbar_btn_bg'            => 'data-fg-lb-toolbar-btn-bg',
		'toolbar_btn_border'        => 'data-fg-lb-toolbar-btn-border',
		'toolbar_btn_color'         => 'data-fg-lb-toolbar-btn-color',
		'toolbar_btn_bg_hover'      => 'data-fg-lb-toolbar-btn-bg-hover',
		'toolbar_btn_border_hover'  => 'data-fg-lb-toolbar-btn-border-hover',
		'toolbar_btn_hover'         => 'data-fg-lb-toolbar-btn-hover',
		'toolbar_btn_bg_active'     => 'data-fg-lb-toolbar-btn-bg-active',
		'toolbar_btn_border_active' => 'data-fg-lb-toolbar-btn-border-active',
		'toolbar_btn_active_color'  => 'data-fg-lb-toolbar-btn-active-color',
		'toolbar_btn_bg_focus'      => 'data-fg-lb-toolbar-btn-bg-focus',
		'toolbar_btn_border_focus'  => 'data-fg-lb-toolbar-btn-border-focus',
		'toolbar_btn_focus_color'   => 'data-fg-lb-toolbar-btn-focus-color',
		'arrow_bg'                  => 'data-fg-lb-arrow-bg',
		'arrow_border'              => 'data-fg-lb-arrow-border',
		'arrow_color'               => 'data-fg-lb-arrow-color',
		'arrow_bg_hover'            => 'data-fg-lb-arrow-bg-hover',
		'arrow_border_hover'        => 'data-fg-lb-arrow-border-hover',
		'arrow_hover_color'         => 'data-fg-lb-arrow-hover-color',
		'arrow_bg_active'           => 'data-fg-lb-arrow-bg-active',
		'arrow_border_active'       => 'data-fg-lb-arrow-border-active',
		'arrow_active_color'        => 'data-fg-lb-arrow-active-color',
		'arrow_bg_focus'            => 'data-fg-lb-arrow-bg-focus',
		'arrow_border_focus'        => 'data-fg-lb-arrow-border-focus',
		'arrow_focus_color'         => 'data-fg-lb-arrow-focus-color',
		'bullet_bg'                 => 'data-fg-lb-bullet-bg',
		'bullet_border'             => 'data-fg-lb-bullet-border',
		'bullet_hover_bg'           => 'data-fg-lb-bullet-hover-bg',
		'bullet_hover_border'       => 'data-fg-lb-bullet-hover-border',
		'bullet_active_bg'          => 'data-fg-lb-bullet-active-bg',
		'bullet_active_border'      => 'data-fg-lb-bullet-active-border',
		'bullet_focus_bg'           => 'data-fg-lb-bullet-focus-bg',
		'bullet_focus_border'       => 'data-fg-lb-bullet-focus-border',
		'thumbs_bg'                 => 'data-fg-lb-thumbs-bg',
		'thumb_border'              => 'data-fg-lb-thumb-border-color',
		'thumb_hover_border'        => 'data-fg-lb-thumb-hover-border-color',
		'thumb_active'              => 'data-fg-lb-thumb-active-color',
		'thumb_focus_border'        => 'data-fg-lb-thumb-focus-border-color',
		'info_bg'                   => 'data-fg-lb-info-bg',
		'info_block_bg'             => 'data-fg-lb-info-block-bg',
		'info_block_divider'        => 'data-fg-lb-info-block-divider',
		'info_text'                 => 'data-fg-lb-info-text',
		'info_title'                => 'data-fg-lb-info-title',
		'spinner_color'             => 'data-fg-lb-spinner-color',
	);

	/**
	 * Resolve the active theme name from settings.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $settings Collection settings.
	 * @return string 'dark' | 'light' | 'custom'.
	 */
	public static function theme( array $settings ): string {
		$theme = is_string( $settings['lightbox_theme'] ?? null ) ? (string) $settings['lightbox_theme'] : 'dark';
		return in_array( $theme, array( 'dark', 'light', 'custom' ), true ) ? $theme : 'dark';
	}

	/**
	 * Resolve the palette (key => colour string) for the active theme.
	 *
	 * Dark/light use the static defaults; custom reads saved settings and
	 * falls back to the dark defaults for any unset value.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $settings Collection settings.
	 * @return array<string, string>
	 */
	public static function palette( array $settings ): array {
		$theme    = self::theme( $settings );
		$defaults = 'light' === $theme ? self::LIGHT_DEFAULTS : self::DARK_DEFAULTS;

		if ( 'custom' !== $theme ) {
			return $defaults;
		}

		$palette = array();
		foreach ( $defaults as $key => $default_value ) {
			$setting_key     = self::CUSTOM_SETTING_KEYS[ $key ] ?? null;
			$palette[ $key ] = null !== $setting_key
				? self::safe_color( $settings[ $setting_key ] ?? null, $default_value )
				: $default_value;
		}
		return $palette;
	}

	/**
	 * Resolve the full data-fg-lb-* colour attribute map.
	 *
	 * Note: the conditional colours (info-block bg/divider, image shadow)
	 * are NOT included here - they depend on non-colour settings and stay
	 * in the classic Lightbox. Callers that only need chrome colours (e.g.
	 * LightboxGrid) can read just the keys they want.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $settings Collection settings.
	 * @return array<string, string> Map of data-fg-lb-* => rgba string.
	 */
	public static function attrs( array $settings ): array {
		$palette = self::palette( $settings );
		$attrs   = array();
		foreach ( self::ATTR_KEYS as $key => $attr_name ) {
			// info_block_bg / info_block_divider are emitted by the classic
			// Lightbox only under specific info-block styles; skip them in
			// the always-on attribute map.
			if ( 'info_block_bg' === $key || 'info_block_divider' === $key ) {
				continue;
			}
			$attrs[ $attr_name ] = $palette[ $key ];
		}
		return $attrs;
	}

	/**
	 * Validate a colour string, returning the default when it is not a
	 * recognised hex / rgb(a) / hsl(a) value.
	 *
	 * @since 1.0.0
	 * @param mixed  $value   Raw setting value.
	 * @param string $default Fallback colour string.
	 * @return string
	 */
	public static function safe_color( $value, string $default_value ): string {
		if ( ! is_string( $value ) ) {
			return $default_value;
		}
		$v = trim( $value );
		if (
			preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v ) ||
			preg_match( '/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(\s*,\s*[\d.]+)?\s*\)$/', $v ) ||
			preg_match( '/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/', $v )
		) {
			return $v;
		}
		return $default_value;
	}
}
