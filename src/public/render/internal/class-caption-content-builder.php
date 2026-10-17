<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Formatted_Text\Formatted_Text;
use FotoGrids\Formatted_Text\Formatter;
use FotoGrids\Formatted_Text\Schema;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves the title and description for a thumbnail caption.
 *
 * Reads caption_hide_title, caption_hide_description, caption_title_source,
 * caption_description_source, caption_limit_title_length, and
 * caption_limit_description_length from gallery settings and maps them to the
 * correct fields on an Item_View.
 *
 * Source values (both title and description share the same option set):
 *   item_title       → Item_View::title       (attachment post_title)
 *   item_caption     → Item_View::caption     (attachment post_excerpt)
 *   item_alt         → Item_View::alt         (attachment _wp_attachment_image_alt)
 *   item_description → Item_View::description (attachment post_content)
 *
 * The title is always plain text on one line. The description is formatted
 * when its source is the caption or the description, and plain text when it
 * is the title or the alt.
 *
 * Length limit modes:
 *   no         → no truncation applied here.
 *   characters → cut after the desktop max-characters value of visible text + '…'.
 *   lines      → text left intact; CSS -webkit-line-clamp handles clipping.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Caption_Content_Builder {

	/**
	 * Description sources shown with their formatting.
	 *
	 * @since 1.3.0
	 */
	const FORMATTED_SOURCES = array( 'item_caption', 'item_description' );

	/**
	 * Resolves the plain-text caption title and description for one item.
	 *
	 * @since  1.0.0
	 * @param  Item_View            $item_view Item data.
	 * @param  array<string, mixed> $settings  Gallery render settings.
	 * @return Caption_Content
	 */
	public function resolve( Item_View $item_view, array $settings ): Caption_Content {
		$settings = $this->effective_settings( $settings );

		$title = '';
		if ( ! (bool) ( $settings['caption_hide_title'] ?? false ) ) {
			$title = $this->plain_title( $item_view, $settings );
		}

		$description = '';
		if ( ! (bool) ( $settings['caption_hide_description'] ?? false ) ) {
			$source      = $this->scalar_source( $settings['caption_description_source'] ?? null, 'item_caption' );
			$description = Formatter::to_text(
				Formatter::parse(
					$this->pick_field( $item_view, $source ),
					Schema::profile(),
					array(
						'mode'       => 'plain',
						'max_length' => $this->max_length( $settings, 'description' ),
					)
				)['nodes']
			);
		}

		return new Caption_Content( $title, $description );
	}

	/**
	 * Resolves the caption for display, with the description as safe HTML.
	 *
	 * @since  1.3.0
	 * @param  Item_View      $item_view      Item data.
	 * @param  Render_Context $render_context Render context.
	 * @return Caption_Content
	 */
	public function resolve_display( Item_View $item_view, Render_Context $render_context ): Caption_Content {
		$settings = $this->effective_settings( $render_context->settings );
		$content  = $this->resolve( $item_view, $render_context->settings );

		if ( '' === $content->description ) {
			return $content;
		}

		$source     = $this->scalar_source( $settings['caption_description_source'] ?? null, 'item_caption' );
		$raw        = $this->pick_field( $item_view, $source );
		$max_length = $this->max_length( $settings, 'description' );

		if ( in_array( $source, self::FORMATTED_SOURCES, true ) ) {
			$is_album = Collection_Kind::ALBUM === $render_context->meta->collection_kind;
			$html     = Formatted_Text::html(
				$raw,
				array(
					'surface'    => $is_album ? 'album_tile' : 'thumbnail',
					'field'      => 'item_caption' === $source ? 'caption' : 'description',
					'item_id'    => $item_view->id,
					'gallery_id' => $is_album ? $item_view->id : $render_context->meta->gallery_id,
					'links'      => false,
					'max_length' => $max_length,
				)
			);
		} else {
			$html = Formatter::to_html(
				Formatter::parse(
					$raw,
					Schema::profile(),
					array(
						'mode'       => 'plain',
						'max_length' => $max_length,
					)
				)['nodes'],
				false,
				true
			);
		}

		return new Caption_Content( $content->title, $content->description, $html );
	}

	/**
	 * Applies layout rules that override stored caption settings.
	 *
	 * @since  1.3.0
	 * @param  array<string, mixed> $settings Gallery render settings.
	 * @return array<string, mixed>
	 */
	private function effective_settings( array $settings ): array {
		// Image Viewer hides these settings in the admin; stored values must not apply.
		$layout = is_string( $settings['layout'] ?? null ) ? $settings['layout'] : '';
		if ( 'image-viewer' === $layout ) {
			$settings['caption_hide_description']   = true;
			$settings['caption_limit_title_length'] = 'no';
		}
		return $settings;
	}

	/**
	 * Resolves the title as one line of plain text, truncated when limited.
	 *
	 * @since  1.3.0
	 * @param  Item_View            $item_view Item data.
	 * @param  array<string, mixed> $settings  Effective settings.
	 * @return string
	 */
	private function plain_title( Item_View $item_view, array $settings ): string {
		$source = $this->scalar_source( $settings['caption_title_source'] ?? null, 'item_title' );
		$text   = Formatter::to_text(
			Formatter::parse( $this->pick_field( $item_view, $source ), Schema::profile(), array( 'mode' => 'plain' ) )['nodes']
		);
		$text   = trim( (string) preg_replace( '/[\t ]*\n[\t ]*/', ' ', $text ) );

		$max = $this->max_length( $settings, 'title' );
		return $max > 0 ? $this->truncate( $text, $max ) : $text;
	}

	/**
	 * Returns the character limit for the title or description, or 0.
	 *
	 * @since  1.3.0
	 * @param  array<string, mixed> $settings Effective settings.
	 * @param  string               $slot     'title' or 'description'.
	 * @return int
	 */
	private function max_length( array $settings, string $slot ): int {
		$mode_key = 'title' === $slot ? 'caption_limit_title_length' : 'caption_limit_description_length';
		$max_key  = 'title' === $slot ? 'caption_max_title_characters' : 'caption_max_desc_characters';
		if ( 'characters' !== $this->scalar_limit( $settings[ $mode_key ] ?? null ) ) {
			return 0;
		}
		return $this->responsive_int( $settings[ $max_key ] ?? null, 200 );
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
	 * @param  string $default_value Fallback when value is absent or unrecognised.
	 * @return string
	 */
	private function scalar_source( $raw, string $default_value ): string {
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
	private function scalar_limit( $raw ): string {
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
	 * @param  int   $default_value Fallback when value is absent.
	 * @return int
	 */
	private function responsive_int( $raw, int $default_value ): int {
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
