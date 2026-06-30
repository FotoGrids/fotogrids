<?php
/**
 * Sharing-settings filter hooks.
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
 * Sharing filter hooks.
 */
final class Filters_Sharing {

	/**
	 * Default sharing settings.
	 *
	 * @since 1.0.0
	 * @param array $defaults Default settings array.
	 */
	public const DEFAULTS = 'fotogrids/sharing/defaults';

	/**
	 * Resolved sharing settings (defaults + saved options).
	 *
	 * @since 1.0.0
	 * @param array $settings Resolved settings.
	 */
	public const SETTINGS = 'fotogrids/sharing/settings';

	/**
	 * Sanitised sharing settings input.
	 *
	 * @since 1.0.0
	 * @param array $sanitized Sanitised input.
	 * @param array $input     Raw input.
	 */
	public const SANITIZE = 'fotogrids/sharing/sanitize';

	/**
	 * Resolved sharing settings for a given collection (per-collection
	 * override pipeline).
	 *
	 * @since 1.0.0
	 * @param array $resolved      Resolved settings.
	 * @param int   $collection_id Collection ID.
	 */
	public const RESOLVED = 'fotogrids/sharing/resolved';
}
