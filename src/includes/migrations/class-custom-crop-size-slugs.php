<?php
/**
 * Re-filing of cropped custom image sizes under slugs that carry their alignment.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Image_Size_Manager;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Rebuilds the custom size registry entries of every collection that uses a
 * cropped custom size, so an off-centre crop is registered under its own slug.
 *
 * @since 1.3.0
 */
final class Custom_Crop_Size_Slugs implements Migration {

	/**
	 * Identifier recorded once the migration has run.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string {
		return '0006-custom-crop-size-slugs';
	}

	/**
	 * Re-sync the registry for each collection listed against a cropped custom size.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void {
		$collection_ids = array();

		foreach ( Image_Size_Manager::get_custom_sizes( true ) as $config ) {
			if ( ! is_array( $config ) || empty( $config['crop'] ) || ! is_array( $config['gallery_ids'] ?? null ) ) {
				continue;
			}

			foreach ( $config['gallery_ids'] as $collection_id ) {
				$collection_ids[ (int) $collection_id ] = true;
			}
		}

		unset( $collection_ids[0] );

		foreach ( array_keys( $collection_ids ) as $collection_id ) {
			Image_Size_Manager::sync_collection_sizes( $collection_id );
		}
	}
}
