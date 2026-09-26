<?php
/**
 * Display title for galleries and albums, with a placeholder for empty titles.
 *
 * @package FotoGrids
 * @since   1.1.4
 */

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves the title shown for a gallery or album.
 *
 * An empty stored title stays empty; wherever the title is displayed it is
 * replaced by a placeholder built from the post ID ("Gallery #123").
 *
 * @since 1.1.4
 */
class Collection_Title {

	/**
	 * Post types the placeholder applies to.
	 *
	 * @var string[]
	 */
	const POST_TYPES = array( 'fotogrids_gallery', 'fotogrids_album' );

	/**
	 * Register the title filters.
	 *
	 * @since  1.1.4
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'the_title', array( __CLASS__, 'filter_title' ), 10, 2 );
		add_filter( 'single_post_title', array( __CLASS__, 'filter_title' ), 10, 2 );
		add_filter( 'enter_title_here', array( __CLASS__, 'filter_title_field_placeholder' ), 10, 2 );
	}

	/**
	 * Whether a gallery or album has no title of its own.
	 *
	 * @since  1.1.4
	 * @param  int|object $post Gallery or album post, or its ID.
	 * @return bool
	 */
	public static function is_untitled( $post ): bool {
		$post = get_post( is_object( $post ) ? (int) $post->ID : (int) $post );

		return $post instanceof \WP_Post && '' === trim( (string) $post->post_title );
	}

	/**
	 * Placeholder label for a gallery or album, e.g. "Gallery #123".
	 *
	 * @since  1.1.4
	 * @param  int|object $post Gallery or album post, or its ID.
	 * @return string
	 */
	public static function placeholder( $post ): string {
		$post = get_post( is_object( $post ) ? (int) $post->ID : (int) $post );
		if ( ! $post instanceof \WP_Post ) {
			return '';
		}

		if ( 'fotogrids_album' === $post->post_type ) {
			/* translators: %d: album ID. */
			return sprintf( __( 'Album #%d', 'fotogrids' ), (int) $post->ID );
		}

		/* translators: %d: gallery ID. */
		return sprintf( __( 'Gallery #%d', 'fotogrids' ), (int) $post->ID );
	}

	/**
	 * The stored title, or the placeholder when the title is empty.
	 *
	 * @since  1.1.4
	 * @param  int|object $post Gallery or album post, or its ID.
	 * @return string
	 */
	public static function label( $post ): string {
		$post = get_post( is_object( $post ) ? (int) $post->ID : (int) $post );
		if ( ! $post instanceof \WP_Post ) {
			return '';
		}

		return self::is_untitled( $post ) ? self::placeholder( $post ) : (string) $post->post_title;
	}

	/**
	 * Replace an empty gallery or album title on `the_title` and `single_post_title`.
	 *
	 * @since  1.1.4
	 * @param  string           $title Title being displayed.
	 * @param  int|\WP_Post|null $post  Post ID or object.
	 * @return string
	 */
	public static function filter_title( $title, $post = null ) {
		if ( '' !== trim( (string) $title ) || empty( $post ) ) {
			return $title;
		}

		$post = get_post( $post );
		if ( ! $post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return $title;
		}

		return self::placeholder( $post );
	}

	/**
	 * Show the placeholder in the empty title field of the gallery and album edit screens.
	 *
	 * @since  1.1.4
	 * @param  string   $text Default placeholder text.
	 * @param  \WP_Post $post Post being edited.
	 * @return string
	 */
	public static function filter_title_field_placeholder( $text, $post ) {
		if ( ! $post instanceof \WP_Post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return $text;
		}

		return self::placeholder( $post );
	}
}
