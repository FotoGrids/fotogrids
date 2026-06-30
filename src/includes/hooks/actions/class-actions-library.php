<?php
/**
 * Metadata-library (tags / people / locations) action hooks.
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
 * Library action hooks.
 */
final class Actions_Library {

	/**
	 * Fires after a library entity (tag/person/location) is created.
	 *
	 * @since 1.0.0
	 * @param string $type Metadata type slug.
	 * @param int    $id   New entity ID.
	 */
	public const CREATED = 'fotogrids/actions/library/created';

	/**
	 * Fires after a library entity is updated.
	 *
	 * @since 1.0.0
	 * @param string $type Metadata type slug.
	 * @param int    $id   Entity ID.
	 */
	public const UPDATED = 'fotogrids/actions/library/updated';

	/**
	 * Fires after a library entity is deleted.
	 *
	 * @since 1.0.0
	 * @param string $type Metadata type slug.
	 * @param int    $id   Entity ID that was deleted.
	 */
	public const DELETED = 'fotogrids/actions/library/deleted';

	/**
	 * Fires after library entities are merged.
	 *
	 * @since 1.0.0
	 * @param string $type       Metadata type slug.
	 * @param int    $target_id  Surviving entity ID.
	 * @param int[]  $source_ids Source IDs that were merged into the target.
	 */
	public const MERGED = 'fotogrids/actions/library/merged';
}
