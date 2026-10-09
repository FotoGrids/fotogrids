<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Shared;

use FotoGrids\Hooks\Filters_Lightbox;
use FotoGrids\Image_Size_Manager;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Hydrates an attachment ID into a slide dict for the lightbox.
 *
 * The lightbox runs in pure JS once the slide data is in hand - no
 * server round-trip per pane. This class is the single place where an
 * attachment's WP metadata + FotoGrids item meta + EXIF + tag joins
 * resolve into the flat dict the lightbox JS expects.
 *
 * Reused by:
 *   - POST /fotogrids/v1/gallery/lightbox/slides (batch hydration on
 *     navigate-into-uncached-range).
 *
 * @package FotoGrids\Render\Lightbox\Shared
 * @since   1.0.0
 */
final class Lightbox_Slide_Builder {

	/**
	 * Build slide dicts for an ordered list of attachment IDs.
	 *
	 * Batches the WP queries (one for posts, one for item_meta, one for
	 * tag joins) so a 20-slide payload is 3 SQL queries + meta lookups.
	 *
	 * @since 1.0.0
	 * @param array<int, int>      $attachment_ids
	 * @param array<string, mixed> $settings       Resolved gallery settings.
	 * @param int                  $gallery_id     Gallery the slides belong to.
	 * @return array<int, array<string, mixed>> Slide dicts in input order.
	 */
	public static function build_many( array $attachment_ids, array $settings, int $gallery_id ): array {
		$ids = array_values( array_unique( array_map( 'intval', $attachment_ids ) ) );
		$ids = array_filter( $ids, static fn( $id ) => $id > 0 );
		if ( empty( $ids ) ) {
			return array();
		}

		[ $thumb_size_slug, $full_size_slug ] = Image_Size_Manager::resolve_setting_slugs( $settings );
		$link_meta                            = self::batch_load_link_meta( $ids );
		$tag_map                              = self::batch_load_tag_slugs( $ids, 'tag' );

		// Pro-tier metadata - present only if subscriber Pro filter
		// sources are active; harmless to query in Free since the table
		// exists. The lightbox UI gates display via settings.
		$people_map   = self::batch_load_tag_slugs( $ids, 'person' );
		$location_map = self::batch_load_tag_slugs( $ids, 'location' );

		$exif_fields = ( new Lightbox_Info_Scope( $settings, $gallery_id ) )->exif_fields();

		$slides = array();
		foreach ( $ids as $aid ) {
			$post = get_post( $aid );
			if ( ! $post ) {
				continue;
			}

			// Embed posts produce a video slide built from their stored data.
			if ( \FotoGrids\Galleries\Embed_Store::POST_TYPE === $post->post_type ) {
				$embed_slide = self::build_embed_slide( $aid, $full_size_slug );
				if ( null !== $embed_slide ) {
					$slides[] = $embed_slide;
				}
				continue;
			}

			if ( 'attachment' !== $post->post_type ) {
				continue;
			}

			$thumb_resolved = Image_Size_Manager::resolve_size( $aid, $thumb_size_slug, 'thumbnail' );
			$full_resolved  = Image_Size_Manager::resolve_size( $aid, $full_size_slug, 'full' );

			$caption_title = (string) $post->post_excerpt;
			$description   = (string) $post->post_content;

			$slide = array(
				'id'           => $aid,
				'thumb_url'    => (string) ( wp_get_attachment_image_url( $aid, $thumb_resolved ) ?: '' ),
				'full_url'     => (string) ( wp_get_attachment_image_url( $aid, $full_resolved ) ?: '' ),
				'alt'          => (string) get_post_meta( $aid, '_wp_attachment_image_alt', true ),
				'title'        => (string) $post->post_title,
				'caption'      => $caption_title,
				'description'  => $description,
				'tags'         => array_values( $tag_map[ $aid ] ?? array() ),
				'people'       => array_values( $people_map[ $aid ] ?? array() ),
				'location'     => array_values( $location_map[ $aid ] ?? array() ),
				'external_url' => (string) ( $link_meta[ $aid ]['external_url'] ?? '' ),
				'link_target'  => (string) ( $link_meta[ $aid ]['link_target'] ?? 'global' ),
			);

			// Media Library videos carry no image src; supply video fields so
			// the lightbox renders a player. The poster (custom or native)
			// becomes the slide thumb/full image.
			if ( \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE
				=== \FotoGrids\Render\Video\Video_Item_Helpers::type_for_attachment( $aid ) ) {
				$custom_data             = self::load_custom_data( $aid );
				$poster                  = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
					\FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE,
					$aid,
					$custom_data,
					$full_resolved
				);
				$slide['item_type']      = \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE;
				$slide['video_src']      = (string) ( wp_get_attachment_url( $aid ) ?: '' );
				$slide['embed_provider'] = '';
				$slide['embed_id']       = '';
				$slide['embed_settings'] = \FotoGrids\Render\Video\Video_Item_Helpers::playback_settings( $custom_data );
				$slide['thumb_url']      = $poster;
				$slide['full_url']       = $poster;
			}

			if ( ! isset( $slide['item_type'] ) ) {
				$full_src = wp_get_attachment_image_src( $aid, $full_resolved );
				$mobile   = is_array( $full_src )
					? Image_Size_Manager::mobile_companion( $aid, (int) ( $full_src[1] ?? 0 ) )
					: null;

				$slide['full_mobile_url'] = null !== $mobile ? $mobile['url'] : '';
			}

			if ( ! empty( $exif_fields ) ) {
				$slide['exif'] = \FotoGrids\Exif\Exif_Extractor::extract( $aid, $exif_fields );
			}

			$slides[] = $slide;
		}

		/**
		 * Filter the slide list. Pro extensions can append fields to
		 * each slide here (e.g. GPS coords, view-page URL, custom
		 * metadata).
		 *
		 * @since 1.0.0
		 * @param array<int, array<string, mixed>> $slides
		 * @param array<int, int>                  $attachment_ids
		 * @param array<string, mixed>             $settings
		 */
		return (array) apply_filters( Filters_Lightbox::SLIDES, $slides, $ids, $settings );
	}

	/**
	 * Build a lightbox slide dict for an embed post.
	 *
	 * @since 1.1.0
	 * @param int    $embed_id        The fotogrids_embed post ID.
	 * @param string $full_size_slug  Resolved WP size slug for the poster.
	 * @return array<string, mixed>|null
	 */
	private static function build_embed_slide( int $embed_id, string $full_size_slug ): ?array {
		$embed = \FotoGrids\Galleries\Embed_Store::get( $embed_id );
		if ( null === $embed ) {
			return null;
		}

		$item_type = (string) $embed['item_type'];
		$caption   = (string) $embed['caption'];
		$poster    = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
			$item_type,
			0,
			array(
				'thumbnail_url' => (string) $embed['thumbnail_url'],
				'poster_id'     => (int) $embed['poster_id'],
				'poster_url'    => (string) $embed['poster_url'],
			),
			$full_size_slug
		);

		return array(
			'id'             => $embed_id,
			'thumb_url'      => $poster,
			'full_url'       => $poster,
			'alt'            => $caption,
			'title'          => $caption,
			'caption'        => $caption,
			'description'    => '',
			'tags'           => array(),
			'people'         => array(),
			'location'       => array(),
			'external_url'   => '',
			'link_target'    => 'global',
			'item_type'      => $item_type,
			'video_src'      => '',
			'embed_provider' => \FotoGrids\Render\Video\Video_Item_Helpers::provider_for_type( $item_type ),
			'embed_id'       => (string) $embed['video_id'],
			'embed_settings' => is_array( $embed['settings'] ?? null ) ? $embed['settings'] : array(),
		);
	}

	/**
	 * Read and decode custom_data for one attachment's global item row.
	 *
	 * @since 1.1.0
	 * @param int $aid Attachment ID.
	 * @return array<string, mixed>
	 */
	private static function load_custom_data( int $aid ): array {
		$row = \FotoGrids\Galleries\Item_Meta::get( $aid );
		if ( null === $row || empty( $row['custom_data'] ) ) {
			return array();
		}

		$decoded = json_decode( (string) $row['custom_data'], true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Batch-load external_url + link_target from each item's Item_Meta row.
	 *
	 * @param array<int, int> $ids
	 * @return array<int, array{external_url: string, link_target: string}>
	 */
	private static function batch_load_link_meta( array $ids ): array {
		$out = array();
		foreach ( \FotoGrids\Galleries\Item_Meta::get_many( $ids ) as $aid => $row ) {
			$out[ $aid ] = array(
				'external_url' => (string) ( $row['external_url'] ?? '' ),
				'link_target'  => (string) ( $row['link_target'] ?? 'global' ),
			);
		}
		return $out;
	}

	/**
	 * Batch-load tag/person/location slugs (single type per call) from
	 * fotogrids_item_metadata + fotogrids_tags.
	 *
	 * @param array<int, int> $ids
	 * @param string          $type 'tag' | 'person' | 'location'
	 * @return array<int, array<int, string>>
	 */
	private static function batch_load_tag_slugs( array $ids, string $type ): array {
		if ( empty( $ids ) ) {
			return array();
		}
		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders is a generated list of %d tokens.
		$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom table; no core API or object cache applies.
			$wpdb->prepare(
				"SELECT im.attachment_id, t.slug
                 FROM %i im
                 INNER JOIN %i t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)
                 ORDER BY t.name ASC",
				$wpdb->prefix . 'fotogrids_item_metadata',
				$wpdb->prefix . 'fotogrids_tags',
				$type,
				$type,
				...$ids
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$out = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$aid           = (int) $row['attachment_id'];
				$out[ $aid ][] = (string) $row['slug'];
			}
		}
		return $out;
	}
}
