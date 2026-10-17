<?php
/**
 * Enqueues collection stylesheets in the document head on classic themes.
 *
 * @package FotoGrids
 */

namespace FotoGrids;

use FotoGrids\Hooks\Filters_Page_Builders;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Finds the galleries and albums a page embeds - in its content, its
 * builder layout and the active widget areas - and enqueues their
 * stylesheets on `wp_enqueue_scripts`, so they print in the head ahead of
 * theme and Additional CSS instead of where the collection renders.
 *
 * @since 1.3.0
 */
final class Head_Styles {

	/**
	 * Hooks the head pass ahead of the theme's own stylesheets, the order block themes print.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 1 );
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
		if ( wp_is_block_theme() ) {
			return;
		}

		$embeds = self::widget_embeds();

		$post = is_singular() ? get_queried_object() : null;
		if ( $post instanceof \WP_Post && ! post_password_required( $post ) ) {
			$embeds = array_merge( $embeds, self::content_embeds( (string) $post->post_content, $post ) );
			if ( Post_Types::GALLERY === $post->post_type ) {
				$embeds[] = array(
					'type'      => 'gallery',
					'atts'      => array( 'id' => $post->ID ),
					'view_page' => true,
				);
			} elseif ( Post_Types::ALBUM === $post->post_type ) {
				$embeds[] = array(
					'type' => 'album',
					'atts' => array( 'id' => $post->ID ),
				);
			}
		}

		$seen = array();
		foreach ( $embeds as $embed ) {
			if ( ! is_array( $embed ) || empty( $embed['atts'] ) || ! is_array( $embed['atts'] ) ) {
				continue;
			}
			$key = wp_json_encode( $embed );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;

			if ( 'gallery' === ( $embed['type'] ?? '' ) ) {
				Public_Render::enqueue_gallery_styles( $embed['atts'], ! empty( $embed['view_page'] ) );
			} elseif ( 'album' === ( $embed['type'] ?? '' ) ) {
				Public_Render::enqueue_album_styles( $embed['atts'] );
			}
		}
	}

	/**
	 * Returns the FotoGrids shortcodes in a piece of content as embeds.
	 *
	 * @since 1.3.0
	 * @param string $content Content to scan.
	 * @return array<int, array{type: string, atts: array}>
	 */
	public static function shortcode_embeds( string $content ): array {
		if ( false === strpos( $content, '[fotogrids_' ) ) {
			return array();
		}

		$pattern = '/' . get_shortcode_regex( array( 'fotogrids_gallery', 'fotogrids_album' ) ) . '/';
		if ( ! preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
			return array();
		}

		$embeds = array();
		foreach ( $matches as $match ) {
			// [[fotogrids_gallery]] is an escaped shortcode and prints as text.
			if ( '[' === $match[1] && ']' === $match[6] ) {
				continue;
			}
			$atts     = shortcode_parse_atts( $match[3] );
			$embeds[] = array(
				'type' => 'fotogrids_gallery' === $match[2] ? 'gallery' : 'album',
				'atts' => is_array( $atts ) ? $atts : array(),
			);
		}

		return $embeds;
	}

	/**
	 * Returns the embeds in post or widget content, including builder ones.
	 *
	 * @since 1.3.0
	 * @param string        $content Content to scan.
	 * @param \WP_Post|null $post    Post the content belongs to.
	 * @return array<int, array{type: string, atts: array}>
	 */
	private static function content_embeds( string $content, ?\WP_Post $post ): array {
		return (array) apply_filters( Filters_Page_Builders::EMBEDS, self::shortcode_embeds( $content ), $content, $post );
	}

	/**
	 * Returns the embeds in the widgets of every active widget area.
	 *
	 * @since 1.3.0
	 * @return array<int, array{type: string, atts: array}>
	 */
	private static function widget_embeds(): array {
		$embeds = array();

		foreach ( wp_get_sidebars_widgets() as $sidebar_id => $widget_ids ) {
			if ( 'wp_inactive_widgets' === $sidebar_id || ! is_array( $widget_ids ) || ! is_active_sidebar( $sidebar_id ) ) {
				continue;
			}

			foreach ( $widget_ids as $widget_id ) {
				if ( ! preg_match( '/^(.+)-(\d+)$/', (string) $widget_id, $parts ) ) {
					continue;
				}
				$instances = get_option( 'widget_' . $parts[1] );
				$instance  = is_array( $instances ) ? ( $instances[ (int) $parts[2] ] ?? null ) : null;
				if ( ! is_array( $instance ) ) {
					continue;
				}

				$content = (string) ( $instance['content'] ?? $instance['text'] ?? '' );
				if ( '' !== $content ) {
					$embeds = array_merge( $embeds, self::content_embeds( $content, null ) );
				}
			}
		}

		return $embeds;
	}
}
