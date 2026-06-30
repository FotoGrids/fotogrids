<?php
/**
 * FotoGrids runtime JS CustomEvent name constants.
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
 * Runtime JS events.
 */
final class Js_Events_Runtime {

	/**
	 * Fired once on `document` when the FotoGrids runtime has finished
	 * initial DOM scanning.
	 *
	 * @since 1.0.0
	 */
	public const READY = 'fotogrids:ready';

	/**
	 * Fired on `document` when a `.fotogrids-gallery` element appears in the
	 * DOM after initial boot (password unlock, album AJAX, third-party).
	 *
	 * @since 1.0.0
	 * @event-detail { galleryEl: HTMLElement }
	 */
	public const GALLERY_INSERTED = 'fotogrids:gallery_inserted';

	/**
	 * Fired on `document` after a gallery has been wired up by all subscribers.
	 *
	 * @since 1.0.0
	 * @event-detail { galleryEl: HTMLElement }
	 */
	public const GALLERY_INITIALIZED = 'fotogrids:gallery_initialized';

	/**
	 * Asks all active layouts to re-measure and re-paint.
	 *
	 * @since 1.0.0
	 */
	public const REFRESH = 'fotogrids:refresh';
}
