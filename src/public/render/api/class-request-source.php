<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Supported render request sources.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Request_Source {
	const SHORTCODE        = 'shortcode';
	const BLOCK            = 'block';
	const ELEMENTOR        = 'elementor';
	const DIVI             = 'divi';
	const PREVIEW_SAVED    = 'preview_saved';
	const PREVIEW_UNSAVED  = 'preview_unsaved';
	const ALBUM_AJAX       = 'album_ajax';
	const TEMPLATE_PREVIEW = 'template_preview';

	/**
	 * All valid request-source values.
	 *
	 * @since 1.0.0
	 * @var array<int,string>
	 */
	const ALL = array(
		self::SHORTCODE,
		self::BLOCK,
		self::ELEMENTOR,
		self::DIVI,
		self::PREVIEW_SAVED,
		self::PREVIEW_UNSAVED,
		self::ALBUM_AJAX,
		self::TEMPLATE_PREVIEW,
	);

	/**
	 * Whether the given value is a valid request source.
	 *
	 * @since 1.0.0
	 * @param mixed $value Candidate value.
	 * @return bool
	 */
	public static function is_valid( $value ): bool {
		return in_array( $value, self::ALL, true );
	}
}
