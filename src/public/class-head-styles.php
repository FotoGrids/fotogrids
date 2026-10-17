<?php
/**
 * Enqueues collection stylesheets in the document head on classic themes.
 *
 * @package FotoGrids
 */

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Finds the galleries and albums a singular page embeds and enqueues their
 * stylesheets on `wp_enqueue_scripts`, so they print in the head ahead of
 * theme and Additional CSS instead of inline where the content renders.
 *
 * @since 1.3.0
 */
final class Head_Styles {

	/**
	 * Hooks the head pass.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 20 );
	}

	/**
	 * Enqueues the stylesheets of every collection the queried page embeds.
	 *
	 * Block themes render their content before `wp_head`, so they need no pass.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function enqueue(): void {
		if ( wp_is_block_theme() || ! is_singular() ) {
			return;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post || post_password_required( $post ) ) {
			return;
		}

		$embeds = self::embeds( (string) $post->post_content );
		if ( Post_Types::GALLERY === $post->post_type ) {
			$embeds[] = array( 'gallery', array( 'id' => $post->ID ), true );
		} elseif ( Post_Types::ALBUM === $post->post_type ) {
			$embeds[] = array( 'album', array( 'id' => $post->ID ), false );
		}

		$seen = array();
		foreach ( $embeds as $embed ) {
			$key = wp_json_encode( $embed );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;

			if ( 'gallery' === $embed[0] ) {
				Public_Render::enqueue_gallery_styles( $embed[1], $embed[2] );
			} else {
				Public_Render::enqueue_album_styles( $embed[1] );
			}
		}
	}

	/**
	 * Returns the gallery and album embeds in post content.
	 *
	 * @since 1.3.0
	 * @param string $content Post content.
	 * @return array<int, array{0: string, 1: array, 2: bool}> Type, shortcode attributes, view-page flag.
	 */
	private static function embeds( string $content ): array {
		$embeds = array();

		if ( false !== strpos( $content, '[fotogrids_' ) ) {
			$pattern = '/' . get_shortcode_regex( array( 'fotogrids_gallery', 'fotogrids_album' ) ) . '/';
			if ( preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
				foreach ( $matches as $match ) {
					// [[fotogrids_gallery]] is an escaped shortcode and prints as text.
					if ( '[' === $match[1] && ']' === $match[6] ) {
						continue;
					}
					$atts     = shortcode_parse_atts( $match[3] );
					$embeds[] = array(
						'fotogrids_gallery' === $match[2] ? 'gallery' : 'album',
						is_array( $atts ) ? $atts : array(),
						false,
					);
				}
			}
		}

		if ( false !== strpos( $content, '<!-- wp:fotogrids/' ) ) {
			$embeds = array_merge( $embeds, self::block_embeds( parse_blocks( $content ) ) );
		}

		return $embeds;
	}

	/**
	 * Returns the gallery and album blocks in a parsed block tree.
	 *
	 * @since 1.3.0
	 * @param array<int, array> $blocks Parsed blocks.
	 * @return array<int, array{0: string, 1: array, 2: bool}>
	 */
	private static function block_embeds( array $blocks ): array {
		$embeds = array();

		foreach ( $blocks as $block ) {
			$attrs = $block['attrs'] ?? array();
			if ( 'fotogrids/gallery' === $block['blockName'] && ! empty( $attrs['galleryId'] ) ) {
				$embeds[] = array(
					'gallery',
					array(
						'id'      => absint( $attrs['galleryId'] ),
						'_source' => 'block',
					),
					false,
				);
			} elseif ( 'fotogrids/album' === $block['blockName'] && ! empty( $attrs['albumId'] ) ) {
				$embeds[] = array( 'album', array( 'id' => absint( $attrs['albumId'] ) ), false );
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				$embeds = array_merge( $embeds, self::block_embeds( $block['innerBlocks'] ) );
			}
		}

		return $embeds;
	}
}
