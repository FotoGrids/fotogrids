<?php
/**
 * Admin JS CustomEvent name constants (collection save, settings, licensing).
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
 * Admin JS events.
 */
final class Js_Events_Admin {

	/**
	 * Fired on `document` when a collection (gallery or album) is saved via
	 * the admin ajax-save bridge.
	 *
	 * @since 1.0.0
	 * @event-detail (REST response payload)
	 */
	public const COLLECTION_SAVED = 'fotogrids:collection_saved';

	/**
	 * Fired on `document` when a setting is changed in the collection
	 * settings UI (drives the dirty/save indicator).
	 *
	 * @since 1.0.0
	 * @event-detail { key: string, value: unknown }
	 */
	public const SETTING_CHANGED = 'fotogrids:setting_changed';

	/**
	 * Fired on `document` when the gallery save fails.
	 *
	 * @since 1.0.0
	 * @event-detail string  Error message.
	 */
	public const GALLERY_SAVE_ERROR = 'fotogrids:gallery_save_error';

	/**
	 * Fired on `window` when an external tool component is registered via
	 * the tools registry.
	 *
	 * @since 1.0.0
	 * @event-detail { id: string }
	 */
	public const TOOL_COMPONENT_REGISTERED = 'fotogrids:tool-component-registered';

	/**
	 * Fired on `window` when the licensing state changes (license activated,
	 * deactivated, expired). Listeners refresh license-gated UI.
	 *
	 * @since 1.0.0
	 */
	public const LICENSE_CHANGED = 'fotogrids:license_changed';
}
