<?php
/**
 * Formatted-text filter hooks.
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
 * Filter hooks for formatted captions and descriptions.
 *
 * Results are validated after every filter: a returned schema is checked
 * against a fixed floor, and changed output is sanitized again.
 */
final class Filters_Formatted_Text {

	/**
	 * Formatting rules for a profile: allowed elements and attributes,
	 * URL protocols, and which elements become line breaks or are dropped
	 * with their content. Applies to server output, browser output, the
	 * item editor and saves.
	 *
	 * @since 1.3.0
	 * @param array  $schema  Profile definition (elements, protocols, breakBefore, dropWithContent).
	 * @param string $profile Profile name, e.g. 'item_text'.
	 */
	public const SCHEMA = 'fotogrids/formatted_text/schema';

	/**
	 * Formatting mode for one surface of one gallery: 'basic' or 'plain'.
	 *
	 * @since 1.3.0
	 * @param string $mode    Mode from the Gallery Items settings.
	 * @param array  $context Keys: profile, surface, gallery_id.
	 */
	public const MODE = 'fotogrids/formatted_text/mode';

	/**
	 * Link behaviour for links that carry no target or rel of their own.
	 *
	 * @since 1.3.0
	 * @param array $policy  Keys: new_tab (bool), rel (string[]).
	 * @param array $context Keys: profile, surface, gallery_id.
	 */
	public const LINK_POLICY = 'fotogrids/formatted_text/link_policy';

	/**
	 * Server-rendered formatted HTML for one field.
	 *
	 * @since 1.3.0
	 * @param string $html    Formatted HTML.
	 * @param string $raw     Stored value.
	 * @param array  $context Keys: profile, surface, field, item_id, gallery_id, mode.
	 */
	public const OUTPUT = 'fotogrids/formatted_text/output';

	/**
	 * Plain-text form of a stored value, used for share text, meta tags,
	 * titles and accessible labels.
	 *
	 * @since 1.3.0
	 * @param string $text    Plain text with "\n" line breaks.
	 * @param string $raw     Stored value.
	 * @param array  $context Keys: profile, use, item_id.
	 */
	public const PLAIN_TEXT = 'fotogrids/formatted_text/plain_text';

	/**
	 * Value about to be stored by a FotoGrids save.
	 *
	 * @since 1.3.0
	 * @param string $value   Value after the save rules.
	 * @param string $raw     Submitted value.
	 * @param array  $context Keys: profile, field, item_id, user_id, can_format, source.
	 */
	public const SANITIZE_FOR_SAVE = 'fotogrids/formatted_text/sanitize_for_save';
}
