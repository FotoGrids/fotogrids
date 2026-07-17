<?php
namespace FotoGrids\REST\Items;

use FotoGrids\Hooks\Actions_Item;
use FotoGrids\Galleries\Embed_Store;
use FotoGrids\Galleries\Gallery_Repository;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Embed Data Handler
 *
 * Handles REST API endpoints for video embed items:
 *  - resolve-embed  - fetches oEmbed metadata from YouTube / Vimeo
 *  - embed          - creates / updates / deletes an embed
 *
 * Embeds are stored as fotogrids_embed posts via Embed_Store; their post IDs
 * live in the owning gallery's item list alongside attachment IDs. item_type
 * is 'video_youtube' or 'video_vimeo'.
 *
 * @since 1.1.0
 */
class Embed_Data {

	/**
	 * Supported platforms and their oEmbed endpoint templates.
	 *
	 * @var array<string, string>
	 */
	private static $oembed_endpoints = array(
		'video_youtube' => 'https://www.youtube.com/oembed?url=%s&format=json',
		'video_vimeo'   => 'https://vimeo.com/api/oembed.json?url=%s',
	);

	/**
	 * Resolve an embed URL to its oEmbed metadata.
	 *
	 * Fetches title and thumbnail from the platform's public oEmbed endpoint
	 * (no API key required for either YouTube or Vimeo). Falls back to a
	 * client-constructible YouTube thumbnail URL on HTTP failure so the modal
	 * can always show something.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function resolve_embed( $request ) {
		$url    = esc_url_raw( $request->get_param( 'url' ) );
		$source = sanitize_key( $request->get_param( 'source' ) ); // Either video_youtube or video_vimeo.

		if ( empty( $url ) ) {
			return new \WP_Error(
				'embed_url_missing',
				__( 'A video URL is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
			return new \WP_Error(
				'embed_source_invalid',
				__( 'Unsupported embed source.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$video_id = self::extract_video_id( $url, $source );

		if ( empty( $video_id ) ) {
			return new \WP_Error(
				'embed_url_invalid',
				__( 'Could not extract a video ID from the provided URL.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}

		[ $title, $thumbnail_url ] = self::fetch_oembed_meta( $url, $source );

		// YouTube fallback thumbnail - constructible without any API call.
		if ( empty( $thumbnail_url ) && 'video_youtube' === $source ) {
			$thumbnail_url = 'https://img.youtube.com/vi/' . $video_id . '/hqdefault.jpg';
		}

		return rest_ensure_response(
			array(
				'video_id'      => $video_id,
				'title'         => $title,
				'thumbnail_url' => $thumbnail_url,
				'source'        => $source,
			)
		);
	}

	/**
	 * Create an embed item in a gallery.
	 *
	 * Creates a fotogrids_embed post (via Embed_Store) and appends its post ID
	 * to the gallery's item list. item_type is the platform identifier.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function create_embed( $request ) {
		global $wpdb;

		$gallery_id = absint( $request->get_param( 'gallery_id' ) );
		$source     = sanitize_key( $request->get_param( 'source' ) );
		$url        = esc_url_raw( $request->get_param( 'url' ) );
		$caption    = sanitize_text_field( $request->get_param( 'caption' ) );

		// Embed-specific settings passed through as-is (already validated by
		// arg schemas in register-items-routes.php).
		$embed_settings = $request->get_param( 'embed_settings' );
		if ( ! is_array( $embed_settings ) ) {
			$embed_settings = array();
		}

		if ( ! $gallery_id ) {
			return new \WP_Error(
				'embed_gallery_missing',
				__( 'A gallery ID is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$gallery = get_post( $gallery_id );
		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return new \WP_Error(
				'embed_gallery_not_found',
				__( 'Gallery not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
			return new \WP_Error(
				'embed_source_invalid',
				__( 'Unsupported embed source.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( empty( $url ) ) {
			return new \WP_Error(
				'embed_url_missing',
				__( 'A video URL is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$video_id = self::extract_video_id( $url, $source );
		if ( empty( $video_id ) ) {
			return new \WP_Error(
				'embed_url_invalid',
				__( 'Could not extract a video ID from the provided URL.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}

		// Resolve a thumbnail for the embed so the grid and frontend poster
		// chain have something to show immediately (before any custom poster is
		// set). Uses the platform oEmbed endpoint, with a constructible YouTube
		// fallback. This is the embed-tier link in the poster resolution chain.
		$thumbnail_url = self::resolve_thumbnail( $url, $video_id, $source );
		$poster        = self::sanitize_poster( $request->get_param( 'poster' ) );

		$embed_id = Embed_Store::create(
			array(
				'item_type'     => $source,
				'video_id'      => $video_id,
				'url'           => $url,
				'caption'       => $caption,
				'thumbnail_url' => $thumbnail_url,
				'settings'      => self::sanitize_embed_settings( $embed_settings, $source ),
				'poster_id'     => (int) ( $poster['poster_id'] ?? 0 ),
				'poster_url'    => (string) ( $poster['poster_url'] ?? '' ),
			)
		);

		if ( ! $embed_id ) {
			return new \WP_Error(
				'embed_db_error',
				__( 'Failed to save the video embed. Please try again.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		// Add the embed post to the end of the gallery's item list so it
		// orders and sorts alongside attachments.
		Gallery_Repository::append_item_id( $gallery_id, $embed_id );

		/**
		 * Fires after a video embed item has been created.
		 *
		 * @since 1.1.0
		 * @param int    $embed_id   The new embed post ID.
		 * @param int    $gallery_id The gallery it belongs to.
		 * @param string $source     The platform identifier (video_youtube|video_vimeo).
		 */
		do_action( Actions_Item::ADDED, $embed_id, $gallery_id, $source );

		$stored = Embed_Store::get( $embed_id );

		return rest_ensure_response(
			array(
				'id'            => $embed_id,
				'gallery_id'    => $gallery_id,
				'item_type'     => $source,
				'caption'       => $caption,
				'thumbnail_url' => $thumbnail_url,
				'custom_data'   => self::embed_to_custom_data( $stored ),
			)
		);
	}

	/**
	 * Flatten a stored embed record into the custom_data-shaped array the
	 * admin JS still expects (embed_url/video_id/thumbnail_url + settings +
	 * poster keys), preserving the response contract from the row era.
	 *
	 * @since 1.1.0
	 * @param array<string, mixed>|null $stored Embed_Store::get() result.
	 * @return array<string, mixed>
	 */
	private static function embed_to_custom_data( ?array $stored ): array {
		if ( null === $stored ) {
			return array();
		}
		$out = array_merge(
			array(
				'embed_url'     => $stored['url'] ?? '',
				'video_id'      => $stored['video_id'] ?? '',
				'thumbnail_url' => $stored['thumbnail_url'] ?? '',
			),
			is_array( $stored['settings'] ?? null ) ? $stored['settings'] : array()
		);
		if ( ! empty( $stored['poster_id'] ) ) {
			$out['poster_id'] = (int) $stored['poster_id'];
		}
		if ( ! empty( $stored['poster_url'] ) ) {
			$out['poster_url'] = (string) $stored['poster_url'];
		}
		return $out;
	}

	/**
	 * Update an existing virtual embed item.
	 *
	 * Re-resolves the video ID and thumbnail from the (possibly changed) URL,
	 * re-sanitises the embed settings, and updates the caption. Only operates
	 * on fotogrids_embed posts.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function update_embed( $request ) {
		$item_id = absint( $request->get_param( 'id' ) );
		$source  = sanitize_key( $request->get_param( 'source' ) );
		$url     = esc_url_raw( $request->get_param( 'url' ) );
		$caption = sanitize_text_field( $request->get_param( 'caption' ) );

		$embed_settings = $request->get_param( 'embed_settings' );
		if ( ! is_array( $embed_settings ) ) {
			$embed_settings = array();
		}

		if ( ! $item_id ) {
			return new \WP_Error(
				'embed_id_missing',
				__( 'An embed item ID is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
			return new \WP_Error(
				'embed_source_invalid',
				__( 'Unsupported embed source.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( empty( $url ) ) {
			return new \WP_Error(
				'embed_url_missing',
				__( 'A video URL is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$existing = Embed_Store::get( $item_id );
		if ( null === $existing ) {
			return new \WP_Error(
				'embed_not_found',
				__( 'Video embed not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$video_id = self::extract_video_id( $url, $source );
		if ( empty( $video_id ) ) {
			return new \WP_Error(
				'embed_url_invalid',
				__( 'Could not extract a video ID from the provided URL.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}

		$thumbnail_url = self::resolve_thumbnail( $url, $video_id, $source );

		$data = array(
			'item_type'     => $source,
			'video_id'      => $video_id,
			'url'           => $url,
			'caption'       => $caption,
			'thumbnail_url' => $thumbnail_url,
			'settings'      => self::sanitize_embed_settings( $embed_settings, $source ),
		);

		// Poster: an explicit `poster` param in the request wins (including
		// clearing it); otherwise leave the existing poster untouched by not
		// passing poster keys to the store.
		$poster_param = $request->get_param( 'poster' );
		if ( null !== $poster_param ) {
			$poster             = self::sanitize_poster( $poster_param );
			$data['poster_id']  = (int) ( $poster['poster_id'] ?? 0 );
			$data['poster_url'] = (string) ( $poster['poster_url'] ?? '' );
		}

		if ( ! Embed_Store::update( $item_id, $data ) ) {
			return new \WP_Error(
				'embed_update_failed',
				__( 'Failed to update the video embed. Please try again.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		$stored = Embed_Store::get( $item_id );

		return rest_ensure_response(
			array(
				'id'            => $item_id,
				'item_type'     => $source,
				'caption'       => $caption,
				'thumbnail_url' => $thumbnail_url,
				'custom_data'   => self::embed_to_custom_data( $stored ),
			)
		);
	}

	/**
	 * Delete an embed item by its fotogrids_embed post ID.
	 *
	 * Removes the embed from its owning gallery's item list, then deletes the
	 * post. Only operates on fotogrids_embed posts.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function delete_embed( $request ) {
		$item_id = absint( $request->get_param( 'id' ) );
		if ( ! $item_id ) {
			return new \WP_Error(
				'embed_id_missing',
				__( 'An embed item ID is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$existing = Embed_Store::get( $item_id );
		if ( null === $existing ) {
			return new \WP_Error(
				'embed_not_found',
				__( 'Video embed not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$gallery_id = Gallery_Repository::find_gallery_for_embed( $item_id );

		// Remove from the owning gallery's item list, then delete the post.
		if ( $gallery_id > 0 ) {
			Gallery_Repository::remove_item_id( $gallery_id, $item_id );
		}

		if ( ! Embed_Store::delete( $item_id ) ) {
			return new \WP_Error(
				'embed_delete_failed',
				__( 'Failed to remove the video embed. Please try again.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		do_action( Actions_Item::REMOVED, $item_id, $gallery_id, (string) $existing['item_type'] );

		return rest_ensure_response(
			array(
				'id'      => $item_id,
				'deleted' => true,
			)
		);
	}

	/**
	 * Fetch title + thumbnail from a platform oEmbed endpoint.
	 *
	 * No API key is required for either YouTube or Vimeo. Returns empty
	 * strings on any HTTP or parse failure so callers can apply their own
	 * fallbacks.
	 *
	 * @since 1.1.0
	 * @param string $url    The embed URL.
	 * @param string $source Platform identifier (video_youtube|video_vimeo).
	 * @return array{0: string, 1: string} [ $title, $thumbnail_url ]
	 */
	private static function fetch_oembed_meta( $url, $source ) {
		if ( ! isset( self::$oembed_endpoints[ $source ] ) ) {
			return array( '', '' );
		}

		$oembed_url      = sprintf( self::$oembed_endpoints[ $source ], rawurlencode( $url ) );
		$oembed_response = wp_remote_get(
			$oembed_url,
			array(
				'timeout'    => 8,
				'user-agent' => 'FotoGrids/' . FOTOGRIDS_VERSION . '; ' . get_bloginfo( 'url' ),
			)
		);

		$title         = '';
		$thumbnail_url = '';

		if ( ! is_wp_error( $oembed_response ) && 200 === wp_remote_retrieve_response_code( $oembed_response ) ) {
			$body = json_decode( wp_remote_retrieve_body( $oembed_response ), true );
			if ( is_array( $body ) ) {
				$title         = isset( $body['title'] ) ? sanitize_text_field( $body['title'] ) : '';
				$thumbnail_url = isset( $body['thumbnail_url'] ) ? esc_url_raw( $body['thumbnail_url'] ) : '';
			}
		}

		return array( $title, $thumbnail_url );
	}

	/**
	 * Resolve a thumbnail URL for an embed at create time.
	 *
	 * Tries the platform oEmbed thumbnail first, then falls back to the
	 * constructible YouTube thumbnail. Returns an empty string for Vimeo when
	 * oEmbed is unreachable (no constructible fallback exists). This is the
	 * embed-tier link in the frontend poster resolution chain; a custom poster
	 * set later takes precedence over whatever is stored here.
	 *
	 * @since 1.1.0
	 * @param string $url      The embed URL.
	 * @param string $video_id The extracted video ID.
	 * @param string $source   Platform identifier (video_youtube|video_vimeo).
	 * @return string Thumbnail URL, or empty string when none is resolvable.
	 */
	private static function resolve_thumbnail( $url, $video_id, $source ) {
		[ , $thumbnail_url ] = self::fetch_oembed_meta( $url, $source );

		if ( empty( $thumbnail_url ) && 'video_youtube' === $source ) {
			$thumbnail_url = 'https://img.youtube.com/vi/' . $video_id . '/hqdefault.jpg';
		}

		return $thumbnail_url;
	}

	/**
	 * Extract the video ID from a YouTube or Vimeo URL.
	 *
	 * @since 1.1.0
	 * @param string $url    The embed URL.
	 * @param string $source Platform identifier.
	 * @return string  Video ID, or empty string on failure.
	 */
	public static function extract_video_id( $url, $source ) {
		if ( 'video_youtube' === $source ) {
			// Handles: youtu.be/ID, youtube.com/watch?v=ID,
			//          youtube.com/embed/ID, youtube.com/shorts/ID
			if ( preg_match(
				'/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/',
				$url,
				$matches
			) ) {
				return $matches[1];
			}
			return '';
		}

		if ( 'video_vimeo' === $source ) {
			// Handles: vimeo.com/ID, vimeo.com/video/ID
			if ( preg_match(
				'/vimeo\.com\/(?:video\/)?(\d+)/',
				$url,
				$matches
			) ) {
				return $matches[1];
			}
			return '';
		}

		return '';
	}

	/**
	 * Sanitize and normalise embed settings by platform.
	 *
	 * Only allows known boolean and string keys through; strips anything else.
	 *
	 * @since 1.1.0
	 * @param array  $raw    Raw settings from the request.
	 * @param string $source Platform identifier.
	 * @return array  Sanitized settings array.
	 */
	private static function sanitize_embed_settings( $raw, $source ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		$bool_keys = array(
			'autoplay',
			'mute',
			'loop',
			'controls',
			'captions',
			'privacy_mode',
			'suggested_videos',
			'intro_title',
			'intro_portrait',
			'intro_byline',
		);

		$int_keys = array( 'start_time', 'end_time' );

		$string_keys = array( 'controls_color' );

		$out = array();

		foreach ( $bool_keys as $key ) {
			if ( isset( $raw[ $key ] ) ) {
				$out[ $key ] = (bool) $raw[ $key ];
			}
		}

		foreach ( $int_keys as $key ) {
			if ( isset( $raw[ $key ] ) ) {
				$value = absint( $raw[ $key ] );
				if ( $value > 0 ) {
					$out[ $key ] = $value;
				}
			}
		}

		foreach ( $string_keys as $key ) {
			if ( isset( $raw[ $key ] ) && is_string( $raw[ $key ] ) ) {
				$value = sanitize_text_field( $raw[ $key ] );
				if ( preg_match( '/^#[0-9a-fA-F]{3,6}$/', $value ) ) {
					$out[ $key ] = $value;
				}
			}
		}

		return $out;
	}

	/**
	 * Sanitize a custom poster payload into custom_data keys.
	 *
	 * Returns poster_id and/or poster_url only when set; an empty / zero
	 * poster returns an empty array so any previous poster is dropped by the
	 * caller's merge.
	 *
	 * @since 1.1.0
	 * @param mixed $raw The `poster` request param.
	 * @return array<string, mixed> Poster keys to merge into custom_data.
	 */
	private static function sanitize_poster( $raw ) {
		if ( ! is_array( $raw ) ) {
			return array();
		}

		$out = array();

		if ( isset( $raw['poster_id'] ) ) {
			$poster_id = absint( $raw['poster_id'] );
			if ( $poster_id > 0 ) {
				$out['poster_id'] = $poster_id;
			}
		}

		if ( isset( $raw['poster_url'] ) ) {
			$poster_url = esc_url_raw( (string) $raw['poster_url'] );
			if ( '' !== $poster_url ) {
				$out['poster_url'] = $poster_url;
			}
		}

		return $out;
	}
}
