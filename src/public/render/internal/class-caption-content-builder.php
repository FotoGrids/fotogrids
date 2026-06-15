<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Item_View;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves the title and description strings for a thumbnail caption.
 *
 * Reads caption_hide_title, caption_hide_description, caption_title_source,
 * caption_description_source, caption_limit_title_length, and
 * caption_limit_description_length from gallery settings and maps them to the
 * correct fields on an Item_View.  Returns a Caption_Content value object
 * whose title and description are empty strings when the corresponding hide
 * toggle is on.
 *
 * Source values (both title and description share the same option set):
 *   item_title       → Item_View::title       (attachment post_title)
 *   item_caption     → Item_View::caption     (attachment post_excerpt)
 *   item_alt         → Item_View::alt         (attachment _wp_attachment_image_alt)
 *   item_description → Item_View::description (attachment post_content)
 *
 * Length limit modes:
 *   no         → no truncation applied here.
 *   characters → mb_substr to the desktop max-characters value + '…' suffix.
 *   lines      → string left intact; CSS -webkit-line-clamp handles clipping.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Caption_Content_Builder {

	/**
	 * Resolves caption title and description for one item.
	 *
	 * @since  1.0.0
	 * @param  Item_View            $item_view Item data.
	 * @param  array<string, mixed> $settings  Gallery render settings.
	 * @return Caption_Content
	 */
	public function resolve( Item_View $item_view, array $settings ): Caption_Content {
		$hide_title       = (bool) ( $settings['caption_hide_title'] ?? false );
		$hide_description = (bool) ( $settings['caption_hide_description'] ?? false );

		$title_text = '';
		if ( ! $hide_title ) {
			$source     = $this->scalar_source( $settings['caption_title_source'] ?? null, 'item_title' );
			$title_text = $this->pick_field( $item_view, $source );

			$limit_mode = $this->scalar_limit( $settings['caption_limit_title_length'] ?? null );
			if ( 'characters' === $limit_mode && '' !== $title_text ) {
				$max        = $this->responsive_int( $settings['caption_max_title_characters'] ?? null, 200 );
				$title_text = $this->truncate( $title_text, $max );
			}
		}

		$description_text = '';
		if ( ! $hide_description ) {
			$source           = $this->scalar_source( $settings['caption_description_source'] ?? null, 'item_caption' );
			$description_text = $this->pick_field( $item_view, $source );

			$limit_mode = $this->scalar_limit( $settings['caption_limit_description_length'] ?? null );
			if ( 'characters' === $limit_mode && '' !== $description_text ) {
				$max              = $this->responsive_int( $settings['caption_max_desc_characters'] ?? null, 200 );
				$description_text = $this->truncate( $description_text, $max );
			}
		}

		return new Caption_Content( $title_text, $description_text );
	}

	/**
	 * Reads a field from the item by source key.
	 *
	 * @since  1.0.0
	 * @param  Item_View $item_view Item data.
	 * @param  string    $source    Source key.
	 * @return string
	 */
	private function pick_field( Item_View $item_view, string $source ): string {
		switch ( $source ) {
			case 'item_title':
				return $item_view->title;
			case 'item_caption':
				return $item_view->caption;
			case 'item_alt':
				return $item_view->alt;
			case 'item_description':
				return $item_view->description;
			default:
				return '';
		}
	}

	/**
	 * Normalises the source setting to a scalar string.
	 *
	 * The admin stores button-group values as single-element arrays
	 * (e.g. ['item_title']).  Accept both forms so preview and public
	 * renders behave identically.
	 *
	 * @since  1.0.0
	 * @param  mixed  $raw     Raw setting value.
	 * @param  string $default Fallback when value is absent or unrecognised.
	 * @return string
	 */
	private function scalar_source( mixed $raw, string $default_value ): string {
		if ( is_array( $raw ) ) {
			$raw = $raw[0] ?? null;
		}

		$allowed = array( 'item_title', 'item_caption', 'item_alt', 'item_description' );

		return ( is_string( $raw ) && in_array( $raw, $allowed, true ) ) ? $raw : $default_value;
	}

	/**
	 * Normalises a limit-mode setting to a scalar string.
	 *
	 * Accepts plain strings and single-element arrays from the admin.
	 * Returns 'no', 'characters', or 'lines'; falls back to 'no'.
	 *
	 * @since  1.0.0
	 * @param  mixed $raw Raw setting value.
	 * @return string
	 */
	private function scalar_limit( mixed $raw ): string {
		if ( is_array( $raw ) ) {
			$raw = $raw[0] ?? null;
		}

		$allowed = array( 'no', 'characters', 'lines' );

		return ( is_string( $raw ) && in_array( $raw, $allowed, true ) ) ? $raw : 'no';
	}

	/**
	 * Reads the desktop value from a responsive integer setting.
	 *
	 * Character-limit truncation happens server-side where there is no viewport,
	 * so only the desktop value is used.  The setting shape is either a plain
	 * integer or a breakpoint-keyed array of integers.
	 *
	 * @since  1.0.0
	 * @param  mixed $raw     Raw setting value.
	 * @param  int   $default Fallback when value is absent.
	 * @return int
	 */
	private function responsive_int( mixed $raw, int $default_value ): int {
		if ( is_array( $raw ) ) {
			$raw = $raw['desktop'] ?? ( reset( $raw ) ?: null );
		}

		return is_numeric( $raw ) && (int) $raw > 0 ? (int) $raw : $default_value;
	}

	/**
	 * Truncates a string to at most $max characters, appending '…'.
	 *
	 * Uses mb_substr so multibyte characters (e.g. Japanese, Arabic) are
	 * counted correctly.  The ellipsis character itself is NOT counted against
	 * the limit - $max is the number of content characters kept.
	 *
	 * @since  1.0.0
	 * @param  string $text Raw text.
	 * @param  int    $max  Maximum number of characters to retain.
	 * @return string
	 */
	private function truncate( string $text, int $max ): string {
		if ( mb_strlen( $text ) <= $max ) {
			return $text;
		}

		return mb_substr( $text, 0, $max ) . '…';
	}
}
