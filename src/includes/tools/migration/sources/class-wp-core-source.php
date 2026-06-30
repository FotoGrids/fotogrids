<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * WordPress Core Migration Source
 *
 * Reads galleries already living in post content: classic [gallery]
 * shortcodes and core gallery blocks (wp:gallery / wp:image inside a
 * gallery). Each detected gallery becomes one FotoGrids gallery, titled
 * after the post it was found in.
 *
 * A gallery ref encodes the originating post id and an index, so the same
 * post can yield several galleries (e.g. two [gallery] shortcodes):
 *   "post:<post_id>:<index>"
 *
 * @since 1.0.0
 */
class WP_Core_Source extends Abstract_Source {

	/**
	 * Post types scanned for galleries.
	 *
	 * @var array<int, string>
	 */
	private const SCANNED_POST_TYPES = array( 'post', 'page' );

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_id(): string {
		return 'wp-core';
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_label(): string {
		return __( 'WordPress galleries', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_description(): string {
		return __( 'Classic [gallery] shortcodes and core gallery blocks already in your posts and pages.', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_icon(): string {
		return 'image';
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_group(): string {
		return 'wordpress'; // phpcs:ignore WordPress.WP.CapitalPDangit.MisspelledInText -- lowercase group slug, matched against the React picker's group id.
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function is_available(): bool {
		return true;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Core galleries are always potentially present.
	 *
	 * @since 1.0.0
	 */
	public function is_detected(): bool {
		return true;
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function scan(): array {
		$preview = array();

		foreach ( $this->get_candidate_posts() as $post ) {
			foreach ( $this->extract_galleries( $post->post_content ) as $index => $attachment_ids ) {
				if ( empty( $attachment_ids ) ) {
					continue;
				}

				$preview[] = array(
					'ref'           => 'post:' . $post->ID . ':' . $index,
					'title'         => $this->gallery_title( $post, $index ),
					'item_count'    => count( $attachment_ids ),
					'thumbnail_url' => $this->first_thumbnail( $attachment_ids ),
					'origin'        => sprintf(
						/* translators: %s: source post or page title */
						__( 'From: %s', 'fotogrids' ),
						get_the_title( $post ) ?: __( '(no title)', 'fotogrids' )
					),
					'origin_url'    => get_edit_post_link( $post->ID, 'raw' ),
				);
			}
		}

		return $preview;
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function import( array $refs, string $conflict ): array {
		$imported  = 0;
		$skipped   = 0;
		$galleries = array();
		$messages  = array();

		$by_post = $this->group_refs_by_post( $refs );

		foreach ( $by_post as $post_id => $indices ) {
			$post = get_post( $post_id );
			if ( ! $post ) {
				++$skipped;
				continue;
			}

			$galleries_in_post = $this->extract_galleries( $post->post_content );

			foreach ( $indices as $index ) {
				if ( ! isset( $galleries_in_post[ $index ] ) ) {
					++$skipped;
					continue;
				}

				$attachment_ids = $galleries_in_post[ $index ];
				if ( empty( $attachment_ids ) ) {
					++$skipped;
					continue;
				}

				$result = Gallery_Writer::create_from_attachments(
					$this->gallery_title( $post, $index ),
					$attachment_ids
				);

				if ( is_wp_error( $result ) ) {
					++$skipped;
					$messages[] = $result->get_error_message();
					continue;
				}

				$galleries[] = $result;
				++$imported;
			}
		}

		return array(
			'imported'  => $imported,
			'skipped'   => $skipped,
			'galleries' => $galleries,
			'messages'  => $messages,
		);
	}

	/**
	 * Published posts/pages whose content contains a gallery shortcode or
	 * block.
	 *
	 * @since 1.0.0
	 * @return array<int, \WP_Post>
	 */
	private function get_candidate_posts(): array {
		$query = new \WP_Query(
			array(
				'post_type'              => self::SCANNED_POST_TYPES,
				'post_status'            => 'publish',
				'posts_per_page'         => -1,
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				's'                      => '[gallery',
			)
		);

		$posts = $query->posts;

		$block_query = new \WP_Query(
			array(
				'post_type'              => self::SCANNED_POST_TYPES,
				'post_status'            => 'publish',
				'posts_per_page'         => -1,
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				's'                      => 'wp:gallery',
			)
		);

		foreach ( $block_query->posts as $post ) {
			$posts[ $post->ID ] = $post;
		}

		$unique = array();
		foreach ( $posts as $post ) {
			$unique[ $post->ID ] = $post;
		}

		return array_values( $unique );
	}

	/**
	 * Extract every gallery's attachment id list from a post's content.
	 *
	 * Returns one entry per detected gallery, in document order. Classic
	 * shortcodes are read first, then gallery blocks.
	 *
	 * @since 1.0.0
	 * @param string $content Raw post content.
	 * @return array<int, array<int, int>>
	 */
	private function extract_galleries( string $content ): array {
		$galleries = array();

		foreach ( $this->extract_shortcode_galleries( $content ) as $ids ) {
			$galleries[] = $ids;
		}

		foreach ( $this->extract_block_galleries( $content ) as $ids ) {
			$galleries[] = $ids;
		}

		return $galleries;
	}

	/**
	 * Attachment id lists from classic [gallery] shortcodes.
	 *
	 * @since 1.0.0
	 * @param string $content Raw post content.
	 * @return array<int, array<int, int>>
	 */
	private function extract_shortcode_galleries( string $content ): array {
		$out = array();

		if ( false === strpos( $content, '[gallery' ) ) {
			return $out;
		}

		if ( ! preg_match_all( '/\[gallery\b[^\]]*\]/i', $content, $matches ) ) {
			return $out;
		}

		foreach ( $matches[0] as $shortcode ) {
			$attrs = shortcode_parse_atts( trim( $shortcode, '[]' ) );
			$ids   = array();

			if ( ! empty( $attrs['ids'] ) ) {
				$ids = array_map( 'absint', array_filter( explode( ',', (string) $attrs['ids'] ) ) );

				if ( isset( $attrs['orderby'] ) && 'rand' !== $attrs['orderby'] ) {
					sort( $ids );
				}
			}

			$out[] = array_values( array_unique( $ids ) );
		}

		return $out;
	}

	/**
	 * Attachment id lists from core gallery blocks.
	 *
	 * Reads the block's `ids` attribute when present; otherwise falls back to
	 * the `id` attributes of nested image blocks.
	 *
	 * @since 1.0.0
	 * @param string $content Raw post content.
	 * @return array<int, array<int, int>>
	 */
	private function extract_block_galleries( string $content ): array {
		$out = array();

		if ( false === strpos( $content, 'wp:gallery' ) || ! function_exists( 'parse_blocks' ) ) {
			return $out;
		}

		foreach ( parse_blocks( $content ) as $block ) {
			if ( 'core/gallery' !== ( $block['blockName'] ?? '' ) ) {
				continue;
			}

			$ids = array();

			if ( ! empty( $block['attrs']['ids'] ) && is_array( $block['attrs']['ids'] ) ) {
				$ids = array_map( 'absint', $block['attrs']['ids'] );
			} else {
				foreach ( $block['innerBlocks'] ?? array() as $inner ) {
					if ( 'core/image' === ( $inner['blockName'] ?? '' ) && ! empty( $inner['attrs']['id'] ) ) {
						$ids[] = absint( $inner['attrs']['id'] );
					}
				}
			}

			$ids = array_values( array_filter( array_unique( $ids ) ) );

			if ( ! empty( $ids ) ) {
				$out[] = $ids;
			}
		}

		return $out;
	}

	/**
	 * Proposed gallery title for a detected gallery.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post  Source post.
	 * @param int      $index Zero-based gallery index within the post.
	 * @return string
	 */
	private function gallery_title( \WP_Post $post, int $index ): string {
		$base = get_the_title( $post );
		if ( '' === $base ) {
			$base = __( 'Imported gallery', 'fotogrids' );
		}

		if ( 0 === $index ) {
			return $base;
		}

		/* translators: 1: source post title, 2: gallery number within the post */
		return sprintf( __( '%1$s (gallery %2$d)', 'fotogrids' ), $base, $index + 1 );
	}

	/**
	 * URL of the first attachment's thumbnail, or null.
	 *
	 * @since 1.0.0
	 * @param array<int, int> $attachment_ids Attachment ids.
	 * @return string|null
	 */
	private function first_thumbnail( array $attachment_ids ): ?string {
		$first = (int) reset( $attachment_ids );
		if ( ! $first ) {
			return null;
		}

		$src = wp_get_attachment_image_url( $first, 'thumbnail' );

		return $src ?: null;
	}

	/**
	 * Group import refs by post id, collecting the gallery indices for each.
	 *
	 * @since 1.0.0
	 * @param array<int, string> $refs Gallery refs ("post:<id>:<index>").
	 * @return array<int, array<int, int>>
	 */
	private function group_refs_by_post( array $refs ): array {
		$grouped = array();

		foreach ( $refs as $ref ) {
			$parts = explode( ':', (string) $ref );
			if ( 3 !== count( $parts ) || 'post' !== $parts[0] ) {
				continue;
			}

			$post_id = (int) $parts[1];
			$index   = (int) $parts[2];

			$grouped[ $post_id ][] = $index;
		}

		return $grouped;
	}
}
