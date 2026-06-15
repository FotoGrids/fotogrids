<?php
/**
 * Domain-enumeration filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Data filter hooks.
 */
final class Filters_Data {

	/**
	 * Available metadata types beyond the built-in tag/person/location.
	 *
	 * @since 1.0.0
	 * @param string[] $default_types List of metadata type slugs.
	 */
	public const METADATA_TYPES = 'fotogrids/data/metadata/types';
}
