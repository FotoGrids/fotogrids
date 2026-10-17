<?php
/**
 * Published-collection capability fallback for gallery and album authors.
 *
 * @package FotoGrids\Permissions
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Lets an author edit and delete their own published gallery or album with
 * the type's edit or delete capability when their role lacks the
 * published-state one.
 *
 * @since 1.3.0
 */
final class Published_Collection_Caps {

	/**
	 * Meta capability => [ published-state capability key, fallback capability key ].
	 *
	 * @var array<string, string[]>
	 */
	private const MAP = array(
		'edit_post'   => array( 'edit_published_posts', 'edit_posts' ),
		'delete_post' => array( 'delete_published_posts', 'delete_posts' ),
	);

	/**
	 * Register the filter.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'map_meta_cap', array( __CLASS__, 'map_meta_cap' ), 10, 4 );
	}

	/**
	 * Swap the published-state capability for the type's edit or delete
	 * capability on the user's own collection, when the user does not hold it.
	 *
	 * @since  1.3.0
	 * @param  string[] $caps    Primitive capabilities required.
	 * @param  string   $cap     Capability being checked.
	 * @param  int      $user_id User ID.
	 * @param  array    $args    Arguments; $args[0] is the post ID.
	 * @return string[]
	 */
	public static function map_meta_cap( $caps, $cap, $user_id, $args ) {
		if ( ! isset( self::MAP[ $cap ] ) || empty( $args[0] ) ) {
			return $caps;
		}

		$post = get_post( (int) $args[0] );
		if ( ! $post || ! in_array( $post->post_type, \FotoGrids\Post_Types::COLLECTION_TYPES, true ) || (int) $post->post_author !== (int) $user_id ) {
			return $caps;
		}

		$post_type = get_post_type_object( $post->post_type );
		if ( ! $post_type ) {
			return $caps;
		}

		list( $published_key, $fallback_key ) = self::MAP[ $cap ];
		$published                            = $post_type->cap->$published_key;
		$index                                = array_search( $published, $caps, true );
		if ( false === $index ) {
			return $caps;
		}

		$user = get_userdata( (int) $user_id );
		if ( ! $user || ! empty( $user->allcaps[ $published ] ) ) {
			return $caps;
		}

		$caps[ $index ] = $post_type->cap->$fallback_key;

		return $caps;
	}
}
