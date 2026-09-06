<?php
/**
 * Fallback resolution for view page URLs built on a superseded base.
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
 * Redirects view page URLs WordPress could not resolve itself.
 *
 * Two kinds of address are recovered: one built on the default permalink base
 * after the site has moved to a custom one, and one whose trailing segment is
 * a collection ID rather than a slug. Both redirect to the collection's
 * current permalink.
 *
 * Resolution runs only on requests WordPress has already answered with a 404,
 * so it can never shadow a page, a post or another plugin's route.
 *
 * @since 1.2.0
 */
class Base_Fallback_Redirect {

	/**
	 * Register the fallback handler.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_redirect' ) );
	}

	/**
	 * Redirect a recoverable view page URL to its current permalink.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function maybe_redirect(): void {
		if ( ! is_404() ) {
			return;
		}

		$post = self::resolve( self::request_path() );

		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		$permalink = get_permalink( $post );

		if ( ! is_string( $permalink ) || '' === $permalink ) {
			return;
		}

		$target    = untrailingslashit( (string) wp_parse_url( $permalink, PHP_URL_PATH ) );
		$requested = untrailingslashit( self::request_uri_path() );

		if ( '' !== $target && $target === $requested ) {
			return;
		}

		wp_safe_redirect( $permalink, 301 );
		exit;
	}

	/**
	 * Resolve a request path to the collection it addresses.
	 *
	 * @since 1.2.0
	 * @param string $path Request path relative to the site root.
	 * @return \WP_Post|null
	 */
	private static function resolve( string $path ): ?\WP_Post {
		if ( '' === $path ) {
			return null;
		}

		foreach ( self::known_bases() as $base => $post_type ) {
			$prefix = $base . '/';

			if ( 0 !== strpos( $path, $prefix ) ) {
				continue;
			}

			$identifier = substr( $path, strlen( $prefix ) );

			if ( '' === $identifier || false !== strpos( $identifier, '/' ) ) {
				continue;
			}

			$post = self::find( $identifier, $post_type );

			if ( $post instanceof \WP_Post ) {
				return $post;
			}
		}

		return null;
	}

	/**
	 * Bases a view page URL may legitimately have been built on.
	 *
	 * @since 1.2.0
	 * @return array<string,string> Base path mapped to its post type.
	 */
	private static function known_bases(): array {
		$default_prefix = View_Settings_Store::DEFAULT_BASE_PREFIX;

		$bases = array(
			$default_prefix . '/' . View_Settings_Store::DEFAULT_GALLERY_SEGMENT => 'fotogrids_gallery',
			$default_prefix . '/' . View_Settings_Store::DEFAULT_ALBUM_SEGMENT   => 'fotogrids_album',
		);

		$bases[ Router::base_slug( 'fotogrids_gallery' ) ] = 'fotogrids_gallery';
		$bases[ Router::base_slug( 'fotogrids_album' ) ]   = 'fotogrids_album';

		unset( $bases[''] );

		return $bases;
	}

	/**
	 * Look a collection up by ID or by slug.
	 *
	 * @since 1.2.0
	 * @param string $identifier Trailing URL segment.
	 * @param string $post_type  Collection post type.
	 * @return \WP_Post|null
	 */
	private static function find( string $identifier, string $post_type ): ?\WP_Post {
		if ( ctype_digit( $identifier ) ) {
			$post = get_post( (int) $identifier );

			if ( $post instanceof \WP_Post
				&& $post->post_type === $post_type
				&& 'publish' === $post->post_status ) {
				return $post;
			}

			return null;
		}

		$posts = get_posts(
			array(
				'name'             => $identifier,
				'post_type'        => $post_type,
				'post_status'      => 'publish',
				'numberposts'      => 1,
				'suppress_filters' => false,
			)
		);

		return $posts ? $posts[0] : null;
	}

	/**
	 * The resolved request path, without surrounding slashes or query string.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	private static function request_path(): string {
		$wp = $GLOBALS['wp'] ?? null;

		if ( ! $wp instanceof \WP || ! is_string( $wp->request ) ) {
			return '';
		}

		return trim( $wp->request, '/' );
	}

	/**
	 * The raw requested URI path, used to guard against a redirect loop.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	private static function request_uri_path(): string {
		$uri = isset( $_SERVER['REQUEST_URI'] )
			? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) )
			: '';

		return (string) wp_parse_url( $uri, PHP_URL_PATH );
	}
}
