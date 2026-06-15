<?php
/**
 * Lightbox filter hooks.
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
 * Lightbox filter hooks.
 */
final class Filters_Lightbox {

	/**
	 * The slide list resolved for a lightbox open.
	 *
	 * @since 1.0.0
	 * @param array $slides   Resolved slide payloads.
	 * @param int[] $ids      Attachment IDs.
	 * @param array $settings Collection settings.
	 */
	public const SLIDES = 'fotogrids/lightbox/slides';
}
