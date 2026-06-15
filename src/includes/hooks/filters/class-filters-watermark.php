<?php
/**
 * Watermark-settings filter hooks.
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
 * Watermark filter hooks.
 */
final class Filters_Watermark {

	/**
	 * Default watermark settings.
	 *
	 * @since 1.0.0
	 * @param array $defaults Default settings array.
	 */
	public const DEFAULTS = 'fotogrids/watermark/defaults';

	/**
	 * Resolved watermark settings (defaults + saved options).
	 *
	 * @since 1.0.0
	 * @param array $settings Resolved settings.
	 */
	public const SETTINGS = 'fotogrids/watermark/settings';

	/**
	 * Sanitised watermark settings input.
	 *
	 * @since 1.0.0
	 * @param array $sanitized Sanitised input.
	 * @param array $input     Raw input.
	 */
	public const SANITIZE = 'fotogrids/watermark/sanitize';

	/**
	 * Resolved watermark settings for a given collection (per-collection
	 * override pipeline).
	 *
	 * @since 1.0.0
	 * @param array $resolved      Resolved settings.
	 * @param int   $collection_id Collection ID.
	 */
	public const RESOLVED = 'fotogrids/watermark/resolved';
}
