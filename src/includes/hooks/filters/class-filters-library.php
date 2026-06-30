<?php
/**
 * Metadata-library REST filter hooks.
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
 * Library filter hooks.
 */
final class Filters_Library {

	/**
	 * Entity types exposed by the library REST endpoint.
	 *
	 * @since 1.0.0
	 * @param string[] $defaults Default entity type slugs.
	 */
	public const ENTITY_TYPES = 'fotogrids/library/entity_types';
}
