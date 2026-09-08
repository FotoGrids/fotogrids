<?php
/**
 * Routing for galleries and albums that share one permalink base.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.2.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Settings\View_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Serves both collection types from a single URL base.
 *
 * WordPress keys rewrite rules by their regex, so two post types registered
 * at one base collapse into a single rule and the loser becomes unreachable.
 * When the configured bases match, both types drop their own rewrite and this
 * class owns the route instead: one rule, one query var, and a lookup that
 * decides which type a slug belongs to.
 *
 * A slug held by both types resolves to the gallery. The album stays
 * reachable through its own segment and through its ID.
 *
 * @since 1.2.0
 */
class Shared_Base {

	/**
	 * Query var carrying the unresolved slug.
	 *
	 * @var string
	 */
	const QUERY_VAR = 'fotogrids_collection';

	/**
	 * Collection types in resolution order; the first match wins.
	 *
	 * @var string[]
	 */
	private const POST_TYPES = array( 'fotogrids_gallery', 'fotogrids_album' );

	/**
	 * Register the shared route.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'query_vars', array( __CLASS__, 'register_query_var' ) );
		add_filter( 'request', array( __CLASS__, 'resolve_request' ) );
		add_filter( 'post_type_link', array( __CLASS__, 'permalink' ), 10, 2 );
		// Ahead of the version-gated flush on the same hook at 100.
		add_action( 'init', array( __CLASS__, 'register_rule' ), 90 );
	}

	/**
	 * Whether both collection types resolve to the same base.
	 *
	 * @since 1.2.0
	 * @return bool
	 */
	public static function is_active(): bool {
		$settings = View_Settings_Store::get();

		$gallery = View_Settings_Store::base_path( $settings['base_prefix'], $settings['base_gallery_segment'] );
		$album   = View_Settings_Store::base_path( $settings['base_prefix'], $settings['base_album_segment'] );

		return $gallery === $album;
	}

	/**
	 * The shared base, with no surrounding slashes. Empty means site root.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	public static function base(): string {
		$settings = View_Settings_Store::get();

		return View_Settings_Store::base_path( $settings['base_prefix'], $settings['base_gallery_segment'] );
	}

	/**
	 * Collection types in resolution order.
	 *
	 * @since 1.2.0
	 * @return string[]
	 */
	public static function post_types(): array {
		return self::POST_TYPES;
	}

	/**
	 * Add the rule that catches every slug under the shared base.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function register_rule(): void {
		if ( ! self::is_active() ) {
			return;
		}

		$base   = self::base();
		$prefix = '' !== $base ? $base . '/' : '';

		add_rewrite_rule(
			'^' . $prefix . '([^/]+)/?$',
			'index.php?' . self::QUERY_VAR . '=$matches[1]',
			'top'
		);
	}

	/**
	 * Make the shared query var public.
	 *
	 * @since 1.2.0
	 * @param string[] $vars Registered query vars.
	 * @return string[]
	 */
	public static function register_query_var( array $vars ): array {
		$vars[] = self::QUERY_VAR;

		return $vars;
	}

	/**
	 * Turn the shared query var into a post type and slug.
	 *
	 * A slug that belongs to neither type is handed back to WordPress as a
	 * page path, so an ordinary page under the same base still opens. This
	 * matters most at the site root, where the shared rule would otherwise
	 * capture every top-level address.
	 *
	 * @since 1.2.0
	 * @param array<string,mixed> $vars Parsed query vars.
	 * @return array<string,mixed>
	 */
	public static function resolve_request( array $vars ): array {
		if ( empty( $vars[ self::QUERY_VAR ] ) ) {
			return $vars;
		}

		$slug = sanitize_title( (string) $vars[ self::QUERY_VAR ] );
		unset( $vars[ self::QUERY_VAR ] );

		if ( '' === $slug ) {
			return $vars;
		}

		$post_type = self::type_for_slug( $slug );

		if ( null === $post_type ) {
			$base = self::base();

			$vars['pagename'] = '' !== $base ? $base . '/' . $slug : $slug;

			return $vars;
		}

		$vars['post_type'] = $post_type;
		$vars['name']      = $slug;

		return $vars;
	}

	/**
	 * Build the pretty permalink both types share.
	 *
	 * @since 1.2.0
	 * @param string   $link Permalink WordPress resolved.
	 * @param \WP_Post $post Post being linked.
	 * @return string
	 */
	public static function permalink( string $link, $post ): string {
		if ( ! $post instanceof \WP_Post
			|| ! in_array( $post->post_type, self::POST_TYPES, true )
			|| '' === $post->post_name
			|| '' === (string) get_option( 'permalink_structure' )
			|| ! self::is_active() ) {
			return $link;
		}

		$base = self::base();
		$path = '' !== $base ? $base . '/' . $post->post_name : $post->post_name;

		return home_url( user_trailingslashit( $path ) );
	}

	/**
	 * The collection type a published slug belongs to.
	 *
	 * @since 1.2.0
	 * @param string $slug Post slug.
	 * @return string|null
	 */
	public static function type_for_slug( string $slug ): ?string {
		foreach ( self::POST_TYPES as $post_type ) {
			$found = get_posts(
				array(
					'name'             => $slug,
					'post_type'        => $post_type,
					'post_status'      => 'publish',
					'numberposts'      => 1,
					'fields'           => 'ids',
					'suppress_filters' => false,
				)
			);

			if ( ! empty( $found ) ) {
				return $post_type;
			}
		}

		return null;
	}
}
