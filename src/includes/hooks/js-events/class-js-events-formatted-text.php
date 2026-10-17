<?php
/**
 * Formatted-text JS CustomEvent name constants.
 *
 * @package FotoGrids\Hooks
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Formatted-text JS events.
 */
final class Js_Events_Formatted_Text {

	/**
	 * Fired on the element a caption or description was rendered into, after
	 * the browser inserts it. Bubbles.
	 *
	 * @since 1.3.0
	 * @event-detail { element: HTMLElement, profile: string, surface: string,
	 *                 field: string, itemId: string, galleryEl: HTMLElement|null }
	 */
	public const RENDERED = 'fotogrids:formatted_text:rendered';

	/**
	 * Fired on the admin text editor when the user changes its value. It
	 * bubbles, so listeners on `document` receive it.
	 *
	 * @since 1.3.0
	 * @event-detail { profile: string, field: string, value: string }
	 */
	public const EDITOR_CHANGE = 'fotogrids:admin:text_editor:change';
}
