<?php
/**
 * Wires watermark generation into the WordPress media + gallery lifecycle.
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

use FotoGrids\Hooks\Actions_Item;
use FotoGrids\Settings\Watermark_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Generates watermark variants at the right moments and cleans them up.
 *
 * Two generation triggers (both fire only when watermarking is enabled
 * site-wide):
 *
 *   1. On `wp_generate_attachment_metadata` - covers new uploads and any
 *      metadata regeneration, once WordPress has produced the sub-sizes.
 *   2. On a gallery gaining an item - covers older images, uploaded before
 *      watermarking was on, that are newly added to a gallery and still lack
 *      current variants.
 *
 * Variants are kept on disk regardless of per-gallery opt-out; opt-out is
 * enforced at render time, not generation time, so toggling it never needs a
 * regenerate. Variant files are removed when their attachment is deleted.
 *
 * @since 1.0.0
 */
final class Watermark_Hooks {

	/**
	 * Register all hooks.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'wp_generate_attachment_metadata', array( __CLASS__, 'on_metadata_generated' ), 999, 2 );
		add_action( Actions_Item::ADDED, array( __CLASS__, 'on_item_added' ), 10, 2 );
		add_action( 'delete_attachment', array( __CLASS__, 'on_attachment_deleted' ), 10, 1 );
	}

	/**
	 * Generate variants after WordPress builds an attachment's sub-sizes.
	 *
	 * This is a filter on the metadata; it must return the metadata unchanged.
	 * Generation is a side effect and only runs when watermarking is enabled
	 * site-wide.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $metadata      Attachment metadata.
	 * @param int                  $attachment_id Attachment ID.
	 * @return array<string, mixed> The unchanged metadata.
	 */
	public static function on_metadata_generated( $metadata, $attachment_id ) {
		if ( self::watermarking_enabled() ) {
			Watermark_Generator::generate_for_attachment( (int) $attachment_id );
		}

		return $metadata;
	}

	/**
	 * Generate variants when an image is added to a gallery, if it still lacks
	 * current ones.
	 *
	 * @since 1.0.0
	 * @param int $attachment_id Attachment added.
	 * @param int $gallery_id    Gallery it was added to.
	 * @return void
	 */
	public static function on_item_added( $attachment_id, $gallery_id ): void {
		unset( $gallery_id );

		if ( ! self::watermarking_enabled() ) {
			return;
		}

		$attachment_id = (int) $attachment_id;

		if ( Watermark_Generator::variant_state( $attachment_id ) === 'current' ) {
			return;
		}

		Watermark_Generator::generate_for_attachment( $attachment_id );
	}

	/**
	 * Remove an attachment's watermark variants when it is deleted.
	 *
	 * @since 1.0.0
	 * @param int $attachment_id Attachment being deleted.
	 * @return void
	 */
	public static function on_attachment_deleted( $attachment_id ): void {
		Watermark_Generator::delete_for_attachment( (int) $attachment_id );
	}

	/**
	 * Whether the site-wide watermark is enabled.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	private static function watermarking_enabled(): bool {
		$settings = Watermark_Settings_Store::get();

		return ! empty( $settings['enable_watermark'] );
	}
}
