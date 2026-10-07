<?php
/**
 * Build throwaway collections for a spec that needs one of its own.
 *
 * Run through WP-CLI, one operation per invocation:
 *
 *   wp eval-file collection.php op=render items=4,5,6 settings='{"layout":"masonry"}'
 *   wp eval-file collection.php op=settings id=41 settings='{"layout":"grid"}'
 *   wp eval-file collection.php op=render items=4 author=fg-author
 *   wp eval-file collection.php op=album galleries=41 title='Scoped album'
 *   wp eval-file collection.php op=page gallery=13
 *   wp eval-file collection.php op=page gallery=41 atts='template="masonry"'
 *   wp eval-file collection.php op=page album=42 atts='template="grid"'
 *   wp eval-file collection.php op=purge
 *
 * Every post carries FG_COLLECTION_MARKER, so `op=purge` removes the lot.
 * tests/e2e/support/collections.ts is the interface specs use.
 *
 * @package FotoGrids
 */

use FotoGrids\Collection_Defaults;
use FotoGrids\FotoGrids_Cache;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Settings\Setting_Value_Codec;

/** Marks a post as this script's to delete; distinct from the seeder's. */
const FG_COLLECTION_MARKER = '_fg_scoped';

/**
 * Read `name=value` arguments, whatever order WP-CLI passes them in.
 *
 * @param array  $args    Positional arguments from WP-CLI.
 * @param string $name    Argument name.
 * @param string $default Returned when the argument is absent.
 * @return string
 */
function fg_col_arg( array $args, string $name, string $default = '' ): string {
	foreach ( $args as $arg ) {
		if ( 0 === strpos( $arg, $name . '=' ) ) {
			return substr( $arg, strlen( $name ) + 1 );
		}
	}

	return $default;
}

/**
 * Write settings to a collection and drop its render cache.
 *
 * Each setting is one post-meta row, so this persists key by key through the
 * same codec the save pipeline uses - which is what makes a value written here
 * read back identically to one saved through the UI.
 *
 * The cache flush is not optional: the render cache is keyed on the gallery,
 * not on its settings, so without it the next render replays the HTML built
 * before the change and a render assertion reads a stale layout.
 *
 * @param int   $gallery_id Gallery to write to.
 * @param array $settings   Catalog key to value.
 * @return void
 * @throws Exception When a key is not in the catalog.
 */
function fg_col_settings( int $gallery_id, array $settings ): void {
	$defaults = Collection_Defaults::resolve_gallery();

	foreach ( $settings as $key => $value ) {
		if ( ! array_key_exists( $key, $defaults ) ) {
			throw new Exception( "Unknown setting key '{$key}'" );
		}

		Setting_Value_Codec::persist(
			$gallery_id,
			'fotogrids_' . $key,
			Setting_Value_Codec::normalize_incoming(
				$value,
				$defaults[ $key ],
				Setting_Value_Codec::catalog_field_type( $key )
			),
			$defaults[ $key ],
			Setting_Value_Codec::catalog_field_type( $key )
		);
	}

	FotoGrids_Cache::flush_for_gallery( $gallery_id );
}

/**
 * Resolve an author login to its user id; 0 leaves the post unowned.
 *
 * @param string $login User login, or '' for none.
 * @return int
 */
function fg_col_author( string $login ): int {
	if ( '' === $login ) {
		return 0;
	}

	$user = get_user_by( 'login', $login );

	if ( ! $user ) {
		WP_CLI::error( 'no such user: ' . $login );
	}

	return (int) $user->ID;
}

/**
 * A post whose content renders one collection through its shortcode.
 *
 * @param int    $collection_id Gallery or album to embed.
 * @param string $atts          Extra shortcode attributes, written verbatim.
 * @param string $tag           Shortcode tag.
 * @return int
 */
function fg_col_render_page( int $collection_id, string $atts = '', string $tag = 'fotogrids_gallery' ): int {
	$atts    = '' === $atts ? '' : ' ' . $atts;
	$kind    = 'fotogrids_album' === $tag ? 'album' : 'gallery';
	$page_id = wp_insert_post(
		array(
			'post_type'    => 'post',
			'post_title'   => 'Renders ' . $kind . ' ' . $collection_id,
			'post_status'  => 'publish',
			'post_content' => '[' . $tag . ' id="' . $collection_id . '"' . $atts . ']',
		),
		true
	);

	if ( is_wp_error( $page_id ) ) {
		WP_CLI::error( $page_id->get_error_message() );
	}

	update_post_meta( $page_id, FG_COLLECTION_MARKER, 1 );

	return $page_id;
}

$op = fg_col_arg( $args, 'op' );

if ( 'render' === $op ) {
	$gallery_id = wp_insert_post(
		array(
			'post_type'   => 'fotogrids_gallery',
			'post_title'  => fg_col_arg( $args, 'title', 'Scoped gallery' ),
			'post_status' => fg_col_arg( $args, 'status', 'publish' ),
			'post_author' => fg_col_author( fg_col_arg( $args, 'author' ) ),
		),
		true
	);

	if ( is_wp_error( $gallery_id ) ) {
		WP_CLI::error( $gallery_id->get_error_message() );
	}

	update_post_meta( $gallery_id, FG_COLLECTION_MARKER, 1 );

	$items = array_filter( array_map( 'intval', explode( ',', fg_col_arg( $args, 'items' ) ) ) );
	if ( $items ) {
		Gallery_Repository::set_item_ids( $gallery_id, $items );
	}

	$settings = json_decode( fg_col_arg( $args, 'settings', '{}' ), true );
	if ( is_array( $settings ) && $settings ) {
		fg_col_settings( $gallery_id, $settings );
	}

	WP_CLI::log(
		(string) wp_json_encode(
			array(
				'id'  => $gallery_id,
				'url' => get_permalink( fg_col_render_page( $gallery_id ) ),
			)
		)
	);
	return;
}

if ( 'album' === $op ) {
	$album_id = wp_insert_post(
		array(
			'post_type'   => 'fotogrids_album',
			'post_title'  => fg_col_arg( $args, 'title', 'Scoped album' ),
			'post_status' => 'publish',
		),
		true
	);

	if ( is_wp_error( $album_id ) ) {
		WP_CLI::error( $album_id->get_error_message() );
	}

	update_post_meta( $album_id, FG_COLLECTION_MARKER, 1 );

	$galleries = array_filter( array_map( 'intval', explode( ',', fg_col_arg( $args, 'galleries' ) ) ) );
	foreach ( $galleries as $position => $gallery_id ) {
		\FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, (int) $album_id, (int) $position );
	}

	$settings = json_decode( fg_col_arg( $args, 'settings', '{}' ), true );
	if ( is_array( $settings ) && $settings ) {
		fg_col_settings( (int) $album_id, $settings );
	}

	WP_CLI::log( (string) wp_json_encode( array( 'id' => (int) $album_id ) ) );
	return;
}

if ( 'page' === $op ) {
	// A rendering page for a collection that already exists. The page is
	// scoped; the collection is untouched.
	$album_id = (int) fg_col_arg( $args, 'album' );
	$id       = $album_id ? $album_id : (int) fg_col_arg( $args, 'gallery' );
	$tag      = $album_id ? 'fotogrids_album' : 'fotogrids_gallery';

	WP_CLI::log(
		(string) wp_json_encode(
			array(
				'id'  => $id,
				'url' => get_permalink( fg_col_render_page( $id, fg_col_arg( $args, 'atts' ), $tag ) ),
			)
		)
	);
	return;
}

if ( 'settings' === $op ) {
	$settings = json_decode( fg_col_arg( $args, 'settings', '{}' ), true );
	fg_col_settings( (int) fg_col_arg( $args, 'id' ), is_array( $settings ) ? $settings : array() );
	return;
}

if ( 'purge' === $op ) {
	$owned = get_posts(
		array(
			'post_type'        => array( 'post', 'fotogrids_gallery', 'fotogrids_album' ),
			'post_status'      => 'any',
			'posts_per_page'   => -1,
			'fields'           => 'ids',
			'suppress_filters' => true,
			'meta_query'       => array(
				array(
					'key'     => FG_COLLECTION_MARKER,
					'compare' => 'EXISTS',
				),
			),
		)
	);

	foreach ( $owned as $post_id ) {
		wp_delete_post( $post_id, true );
	}

	WP_CLI::log( (string) count( $owned ) );
	return;
}

WP_CLI::error( "Unknown op '{$op}'. Expected render, settings or purge." );
