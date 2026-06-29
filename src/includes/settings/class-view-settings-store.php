<?php
/**
 * Global view page appearance settings store.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_View;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads and writes the site-wide view page appearance configuration.
 *
 * One configuration styles every gallery and album view page. Stored as a
 * single option, following the Plugin_Settings_Store pattern.
 *
 * @since 1.0.0
 */
final class View_Settings_Store {

	const OPTION = 'fotogrids_view_settings';

	/**
	 * Default values for every view page appearance setting.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		$defaults = array(
			// Site-wide layout mode for view pages. 'integrated' (default)
			// lets the active theme render the page (header/footer/sidebar),
			// injecting the gallery via the_content. 'standalone' renders the
			// theme-less shell that this module ships.
			'layout_mode'                    => 'integrated',

			// Standalone-only appearance. Only consulted when
			// layout_mode === 'standalone'.
			'accent_color'                   => '#3c46f0',
			'theme'                          => 'light',
			'max_width'                      => 1200,
			'show_header'                    => true,
			'show_footer'                    => true,

			// Integrated-mode toggles. Only consulted when
			// layout_mode === 'integrated'. Each has a paired
			// fotogrids/view/integrated/* filter for runtime override.
			'integrated_show_title_block'    => false,
			'integrated_hide_featured_image' => true,
			'integrated_allow_comments'      => false,
			'integrated_include_in_archives' => false,
			'integrated_post_navigation'     => false,
		);

		/**
		 * Filter the default view page appearance settings.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $defaults
		 */
		return apply_filters( Filters_View::APPEARANCE_DEFAULTS, $defaults );
	}

	/**
	 * Stored view page settings merged over the defaults.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	public static function get(): array {
		$defaults = self::defaults();
		$stored   = get_option( self::OPTION, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$settings = wp_parse_args( $stored, $defaults );

		/**
		 * Filter the resolved global view page appearance settings.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $settings
		 */
		return apply_filters( Filters_View::APPEARANCE, $settings );
	}

	/**
	 * Sanitise a raw view page settings map.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw input (REST params or POST).
	 * @return array<string, mixed>
	 */
	public static function sanitize( $value ): array {
		$defaults = self::defaults();
		$input    = is_array( $value ) ? $value : array();

		$theme = sanitize_key( $input['theme'] ?? $defaults['theme'] );
		if ( ! in_array( $theme, array( 'light', 'dark' ), true ) ) {
			$theme = $defaults['theme'];
		}

		$max_width = isset( $input['max_width'] ) ? absint( $input['max_width'] ) : $defaults['max_width'];
		if ( $max_width < 320 ) {
			$max_width = 320;
		} elseif ( $max_width > 3000 ) {
			$max_width = 3000;
		}

		$accent = sanitize_text_field( $input['accent_color'] ?? $defaults['accent_color'] );
		if ( ! preg_match( '/^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6,8})|rgba?\([0-9.,\s]+\))$/', $accent ) ) {
			$accent = $defaults['accent_color'];
		}

		$layout_mode = sanitize_key( $input['layout_mode'] ?? $defaults['layout_mode'] );
		if ( ! in_array( $layout_mode, array( 'integrated', 'standalone' ), true ) ) {
			$layout_mode = $defaults['layout_mode'];
		}

		$sanitized = array(
			'layout_mode'                    => $layout_mode,

			'accent_color'                   => $accent,
			'theme'                          => $theme,
			'max_width'                      => $max_width,
			'show_header'                    => self::truthy( $input['show_header'] ?? $defaults['show_header'] ),
			'show_footer'                    => self::truthy( $input['show_footer'] ?? $defaults['show_footer'] ),

			'integrated_show_title_block'    => self::truthy( $input['integrated_show_title_block'] ?? $defaults['integrated_show_title_block'] ),
			'integrated_hide_featured_image' => self::truthy( $input['integrated_hide_featured_image'] ?? $defaults['integrated_hide_featured_image'] ),
			'integrated_allow_comments'      => self::truthy( $input['integrated_allow_comments'] ?? $defaults['integrated_allow_comments'] ),
			'integrated_include_in_archives' => self::truthy( $input['integrated_include_in_archives'] ?? $defaults['integrated_include_in_archives'] ),
			'integrated_post_navigation'     => self::truthy( $input['integrated_post_navigation'] ?? $defaults['integrated_post_navigation'] ),
		);

		/**
		 * Filter the sanitised view page appearance settings. Pro adds
		 * sanitisation for its own keys here.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $sanitized
		 * @param array<string,mixed> $input
		 */
		return apply_filters( Filters_View::APPEARANCE_SANITIZE, $sanitized, $input );
	}

	/**
	 * Sanitise and persist view page settings.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw input.
	 * @return array<string, mixed> The stored, merged settings.
	 */
	public static function save( $value ): array {
		update_option( self::OPTION, self::sanitize( $value ) );
		return self::get();
	}

	/**
	 * Coerce any truthy form posted by the UI into a strict bool.
	 *
	 * @since 1.0.0
	 * @param mixed $value
	 * @return bool
	 */
	public static function truthy( $value ): bool {
		return true === $value
			|| 1 === $value
			|| '1' === $value
			|| 'true' === $value
			|| 'on' === $value;
	}
}
