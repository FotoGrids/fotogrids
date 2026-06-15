<?php
/**
 * Admin Modal JS CustomEvent name constants.
 *
 * The full Modal contract lives in
 * `Plugin/src/assets/admin/src/components/shared/Modal/README.md`.
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
 * Admin Modal JS events.
 */
final class Js_Events_Admin_Modal {

	/**
	 * Fired when an Modal opens.
	 *
	 * @since 1.0.0
	 * @event-detail { id, type, size }
	 */
	public const OPENED = 'fotogrids:admin:modal:opened';

	/**
	 * Fired when an Modal closes.
	 *
	 * @since 1.0.0
	 * @event-detail { id, type, reason }
	 */
	public const CLOSED = 'fotogrids:admin:modal:closed';

	/**
	 * Fired when an Modal's confirm button is activated.
	 *
	 * @since 1.0.0
	 * @event-detail { id, type, variant }
	 */
	public const CONFIRMED = 'fotogrids:admin:modal:confirmed';

	/**
	 * Fired when an Modal's active tab changes (opt-in).
	 *
	 * @since 1.0.0
	 * @event-detail { modalId, fromTab, toTab }
	 */
	public const TAB_CHANGED = 'fotogrids:admin:modal:tab-changed';
}
