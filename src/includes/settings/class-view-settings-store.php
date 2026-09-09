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

	const DEFAULT_BASE_PREFIX = 'fotogrids';

	const DEFAULT_GALLERY_SEGMENT = 'gallery';

	const DEFAULT_ALBUM_SEGMENT = 'album';

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

			// Permalink base for view page URLs. An empty prefix places the
			// collection segments at the site root.
			'base_prefix'                    => self::DEFAULT_BASE_PREFIX,
			'base_gallery_segment'           => self::DEFAULT_GALLERY_SEGMENT,
			'base_album_segment'             => self::DEFAULT_ALBUM_SEGMENT,

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

		$base = self::sanitize_base( $input );

		$sanitized = array(
			'layout_mode'                    => $layout_mode,

			'base_prefix'                    => $base['base_prefix'],
			'base_gallery_segment'           => $base['base_gallery_segment'],
			'base_album_segment'             => $base['base_album_segment'],

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
	 * Sanitise the three permalink base fields.
	 *
	 * Any of the three may be empty. A key absent from the input keeps its
	 * stored value; a key present and empty is honoured as empty.
	 *
	 * @since 1.2.0
	 * @param array<string,mixed> $input Raw input.
	 * @return array<string,string>
	 */
	private static function sanitize_base( array $input ): array {
		$current = self::get();

		return array(
			'base_prefix'          => self::sanitize_path( (string) ( $input['base_prefix'] ?? $current['base_prefix'] ) ),
			'base_gallery_segment' => self::sanitize_path( (string) ( $input['base_gallery_segment'] ?? $current['base_gallery_segment'] ) ),
			'base_album_segment'   => self::sanitize_path( (string) ( $input['base_album_segment'] ?? $current['base_album_segment'] ) ),
		);
	}

	/**
	 * Join a prefix and a segment into a URL base, skipping empty parts.
	 *
	 * The single place the base is composed; Router reads it too so the
	 * rewrite slug and the validated path can never disagree.
	 *
	 * @since 1.2.0
	 * @param string $prefix  Shared prefix, may be empty.
	 * @param string $segment Collection segment, may be empty.
	 * @return string Base path with no surrounding slashes. Empty means site root.
	 */
	public static function base_path( string $prefix, string $segment ): string {
		return implode( '/', array_filter( array( $prefix, $segment ), 'strlen' ) );
	}

	/**
	 * Check a requested permalink base against the rest of the site.
	 *
	 * An unchanged base always validates, so a collision introduced after the
	 * base was set never blocks an unrelated settings save.
	 *
	 * @since 1.2.0
	 * @param array<string,mixed> $input Raw input.
	 * @return true|\WP_Error
	 */
	public static function validate_base( array $input ) {
		$base   = self::sanitize_base( $input );
		$stored = self::get();

		if ( $base['base_prefix'] === $stored['base_prefix']
			&& $base['base_gallery_segment'] === $stored['base_gallery_segment']
			&& $base['base_album_segment'] === $stored['base_album_segment'] ) {
			return true;
		}

		$paths = array(
			self::base_path( $base['base_prefix'], $base['base_gallery_segment'] ),
			self::base_path( $base['base_prefix'], $base['base_album_segment'] ),
		);

		foreach ( $paths as $path ) {
			// An empty base is the site root, which owns no path to collide with.
			if ( '' === $path ) {
				continue;
			}

			$conflict = self::base_conflict( $path );

			if ( null !== $conflict ) {
				return new \WP_Error(
					'fotogrids_base_conflict',
					sprintf(
						/* translators: 1: requested URL path, 2: what already uses that path. */
						__( '/%1$s/ is already used by %2$s. Pick a different address.', 'fotogrids' ),
						$path,
						$conflict
					),
					array( 'status' => 400 )
				);
			}
		}

		return true;
	}

	/**
	 * Describe whatever already occupies a URL path.
	 *
	 * @since 1.2.0
	 * @param string $path Path relative to the site root, no surrounding slashes.
	 * @return string|null Human-readable owner, or null when the path is free.
	 */
	private static function base_conflict( string $path ): ?string {
		$root = explode( '/', $path )[0];

		if ( in_array( $root, self::reserved_roots(), true ) ) {
			return __( 'WordPress itself', 'fotogrids' );
		}

		$occupant = self::resolved_post_type( $path );

		if ( null !== $occupant ) {
			return $occupant;
		}

		foreach ( get_post_types( array(), 'objects' ) as $post_type ) {
			if ( in_array( $post_type->name, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
				continue;
			}

			if ( is_array( $post_type->rewrite ) && ( $post_type->rewrite['slug'] ?? '' ) === $path ) {
				return $post_type->labels->name ?? $post_type->name;
			}
		}

		foreach ( get_taxonomies( array(), 'objects' ) as $taxonomy ) {
			if ( is_array( $taxonomy->rewrite ) && ( $taxonomy->rewrite['slug'] ?? '' ) === $path ) {
				return $taxonomy->labels->name ?? $taxonomy->name;
			}
		}

		return null;
	}

	/**
	 * Describe the content WordPress already resolves at a path, if any.
	 *
	 * Asking the rewrite rules covers posts, pages and other post types under
	 * whatever permalink structure the site runs, which a page-only lookup
	 * misses.
	 *
	 * @since 1.2.0
	 * @param string $path Path relative to the site root, no surrounding slashes.
	 * @return string|null
	 */
	private static function resolved_post_type( string $path ): ?string {
		$post_id = url_to_postid( home_url( '/' . $path . '/' ) );

		if ( $post_id < 1 ) {
			return null;
		}

		$post = get_post( $post_id );
		$type = $post instanceof \WP_Post ? get_post_type_object( $post->post_type ) : null;

		if ( null === $type || '' === (string) $type->labels->singular_name ) {
			return __( 'existing content', 'fotogrids' );
		}

		return sprintf(
			/* translators: %s: the singular name of a post type, e.g. "page". */
			__( 'an existing %s', 'fotogrids' ),
			strtolower( $type->labels->singular_name )
		);
	}

	/**
	 * URL roots WordPress reserves for itself.
	 *
	 * @since 1.2.0
	 * @return string[]
	 */
	private static function reserved_roots(): array {
		global $wp_rewrite;

		$roots = array(
			'wp-admin',
			'wp-content',
			'wp-includes',
			'wp-json',
			'feed',
			'embed',
			'page',
			'comments',
			'search',
			'attachment',
			'author',
			'trackback',
		);

		if ( $wp_rewrite instanceof \WP_Rewrite ) {
			$roots[] = $wp_rewrite->pagination_base;
			$roots[] = $wp_rewrite->comments_base;
			$roots[] = $wp_rewrite->author_base;
			$roots[] = $wp_rewrite->search_base;
			$roots[] = $wp_rewrite->feed_base;
		}

		return array_values( array_filter( array_unique( $roots ), 'strlen' ) );
	}

	/**
	 * Reduce a raw path to slug-safe segments joined by slashes.
	 *
	 * @since 1.2.0
	 * @param string $raw Raw path.
	 * @return string
	 */
	private static function sanitize_path( string $raw ): string {
		$parts = array_filter( explode( '/', $raw ), 'strlen' );
		$parts = array_map( 'sanitize_title_with_dashes', $parts );

		return implode( '/', array_filter( $parts, 'strlen' ) );
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

		// The rewrite base may have moved; drop the stamp so the routes are
		// rebuilt on the next load rather than at Settings > Permalinks.
		if ( class_exists( '\FotoGrids\Modules\ViewCollections\Router' ) ) {
			\FotoGrids\Modules\ViewCollections\Router::clear_rewrite_flush();
		}

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
