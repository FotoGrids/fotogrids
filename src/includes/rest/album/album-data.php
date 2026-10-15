<?php
namespace FotoGrids\REST\Album;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * REST handlers for album data.
 *
 * @since 1.0.0
 */
class Album_Data {

	/**
	 * Sets or clears the album's featured gallery.
	 *
	 * Body: { gallery_id: int|null }; an empty value clears it. A set gallery
	 * must be a child of this album.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function set_featured_gallery( $request ) {
		$album_id = (int) $request['id'];

		$album = get_post( $album_id );
		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return new \WP_Error(
				'fotogrids_album_not_found',
				__( 'Album not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$gallery_param = $request->get_param( 'gallery_id' );
		$clearing      = ( null === $gallery_param || '' === $gallery_param || (int) 0 === $gallery_param );

		if ( $clearing ) {
			delete_post_meta( $album_id, 'fotogrids_featured_gallery' );
			return rest_ensure_response(
				array(
					'album_id'   => $album_id,
					'gallery_id' => null,
					'cleared'    => true,
				)
			);
		}

		$gallery_id = (int) $gallery_param;
		$gallery    = get_post( $gallery_id );
		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return new \WP_Error(
				'fotogrids_invalid_gallery',
				__( 'Featured gallery must be a gallery.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$children  = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $album_id );
		$child_ids = array();
		foreach ( (array) $children as $child ) {
			$gid = is_object( $child ) ? (int) ( $child->ID ?? $child->id ?? 0 ) : (int) $child;
			if ( $gid > 0 ) {
				$child_ids[] = $gid;
			}
		}
		if ( ! in_array( $gallery_id, $child_ids, true ) ) {
			return new \WP_Error(
				'fotogrids_gallery_not_in_album',
				__( 'Gallery is not part of this album.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		update_post_meta( $album_id, 'fotogrids_featured_gallery', $gallery_id );

		return rest_ensure_response(
			array(
				'album_id'   => $album_id,
				'gallery_id' => $gallery_id,
				'cleared'    => false,
			)
		);
	}

	/**
	 * Returns an album with the galleries the current user can view, in album
	 * order, and increments its view count.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request.
	 * @return \WP_REST_Response|\WP_Error Album data or error.
	 */
	public static function get_album( $request ) {
		$album_id = (int) $request['id'];

		$access = Album_Permissions::authorize_album_view( $album_id );
		if ( true !== $access ) {
			return $access;
		}

		$album = get_post( $album_id );

		$meta = array(
			'layout'           => get_post_meta( $album_id, 'fotogrids_layout', true ) ?: 'grid',
			'featured_gallery' => (int) get_post_meta( $album_id, 'fotogrids_featured_gallery', true ) ?: null,
		);

		$galleries = \FotoGrids\Gallery_Album_Relations::get_visible_galleries_for_album(
			$album_id,
			array( 'include_meta' => false )
		);

		$gallery_data = array();
		foreach ( $galleries as $gallery ) {
			$gallery_id     = (int) $gallery->ID;
			$thumb          = \FotoGrids\Galleries\Cover_Resolver::url_for_collection( $gallery_id, 'medium' );
			$gallery_data[] = array(
				'id'          => $gallery_id,
				'title'       => $gallery->post_title,
				'description' => $gallery->post_content,
				'thumbnail'   => '' !== $thumb ? $thumb : null,
				'item_count'  => self::get_gallery_item_count( $gallery_id ),
			);
		}

		\FotoGrids\Statistics::increment( 'album', $album_id, 'views' );

		return rest_ensure_response(
			array(
				'id'          => $album->ID,
				'title'       => $album->post_title,
				'description' => $album->post_content,
				'meta'        => $meta,
				'galleries'   => $gallery_data,
				'shortcode'   => '[fotogrids_album id="' . $album_id . '"]',
			)
		);
	}

	/**
	 * Unlocks a password-protected album and returns its rendered HTML.
	 *
	 * @since 1.3.0
	 * @param \WP_REST_Request $request The REST API request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function unlock_album( $request ) {
		$album_id  = (int) $request['id'];
		$submitted = (string) ( $request->get_param( 'password' ) ?? '' );

		$album = get_post( $album_id );
		if ( ! $album || 'fotogrids_album' !== $album->post_type ) {
			return new \WP_Error(
				'album_not_found',
				__( 'Album not found', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$readable = 'publish' === $album->post_status
			|| ( 'private' === $album->post_status && current_user_can( 'read_post', $album_id ) );
		if ( ! $readable ) {
			return new \WP_Error(
				'album_not_published',
				__( 'Album is not published', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		$settings = \FotoGrids\Albums\Album_Repository::get_settings( $album_id );
		$stored   = (string) $settings['_password_encrypted'];

		if ( empty( $settings['password_protect'] ) || ! \FotoGrids\Password_Crypto::verify( $submitted, $stored ) ) {
			return new \WP_Error(
				'fotogrids_invalid_password',
				__( 'Incorrect password.', 'fotogrids' ),
				array( 'status' => 401 )
			);
		}

		$cookie_key    = 'fotogrids_unlocked_' . $album_id;
		$cookie_value  = \FotoGrids\REST\Gallery\Gallery_Data::make_unlock_cookie_value( $album_id, $stored );
		$remember      = ! empty( $settings['password_remember'] );
		$remember_days = max( 1, min( 365, (int) ( $settings['password_remember_days'] ?? 7 ) ) );

		if ( $remember ) {
			setcookie(
				$cookie_key,
				$cookie_value,
				array(
					'expires'  => time() + ( $remember_days * DAY_IN_SECONDS ),
					'path'     => COOKIEPATH,
					'domain'   => COOKIE_DOMAIN,
					'secure'   => is_ssl(),
					'httponly' => true,
					'samesite' => 'Lax',
				)
			);
		}

		// Lets the render below see the unlock.
		$_COOKIE[ $cookie_key ] = $cookie_value;

		$html     = \FotoGrids\Public_Render::render_album_embed(
			array( 'id' => $album_id ),
			(string) $request->get_param( 'instance_id' )
		);
		$resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
		$inline   = \FotoGrids\Public_Render::last_render_result();

		return rest_ensure_response(
			array(
				'success'     => true,
				'html'        => $html,
				'css'         => $resolver->get_css_asset_urls(),
				'js'          => $resolver->get_js_asset_data(),
				'fonts'       => \FotoGrids\Render\Api\Font_Resolver::instance()->get_collected_fonts_url(),
				'remember'    => $remember,
				'unlockToken' => $remember ? '' : \FotoGrids\REST\Gallery\Gallery_Data::make_unlock_token( $album_id, $stored ),
				'inlineCss'   => null !== $inline ? $inline->inline_css : '',
				'inlineJs'    => null !== $inline ? $inline->inline_js : '',
				'jsonLd'      => null !== $inline ? $inline->json_ld : '',
			)
		);
	}

	/**
	 * Returns all published, draft and private albums for admin use.
	 *
	 * @param \WP_REST_Request $request The REST API request.
	 * @return \WP_REST_Response Array of albums.
	 */
	public static function get_albums_list( $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		$args = array(
			'post_type'      => 'fotogrids_album',
			'post_status'    => array( 'publish', 'draft', 'private' ),
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		);

		$query  = new \WP_Query( $args );
		$albums = array();

		foreach ( $query->posts as $album ) {
			$albums[] = array(
				'id'     => $album->ID,
				'title'  => $album->post_title,
				'status' => $album->post_status,
			);
		}

		return rest_ensure_response( $albums );
	}

	/**
	 * Returns a gallery's item count.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery ID.
	 * @return int Item count.
	 */
	private static function get_gallery_item_count( $gallery_id ) {
		return \FotoGrids\Galleries\Gallery_Repository::get_item_count( (int) $gallery_id );
	}
}
