<?php
/**
 * Which info-panel blocks and EXIF fields a gallery's Lightbox shows.
 *
 * @package FotoGrids\Render\Lightbox\Shared
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Shared;

use FotoGrids\Exif\Exif_Extractor;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves a gallery's settings into the info blocks and EXIF fields its
 * Lightbox displays.
 *
 * The rendered Lightbox markup and every REST route that returns Lightbox data
 * read the same answer from here.
 *
 * @since 1.2.0
 */
final class Lightbox_Info_Scope {

	use Setting_Helpers;

	/**
	 * Info blocks shown when a gallery has no `lightbox_info_blocks` setting.
	 *
	 * @since 1.2.0
	 * @var array<int, string>
	 */
	public const DEFAULT_BLOCKS = array( 'title', 'caption', 'description', 'file_info', 'exif', 'share', 'credit', 'tags', 'people', 'location' );

	/**
	 * Resolved gallery settings.
	 *
	 * @var array<string, mixed>
	 */
	private $settings;

	/**
	 * Gallery ID, passed to the EXIF field filter.
	 *
	 * @var int
	 */
	private $gallery_id;

	/**
	 * @since 1.2.0
	 * @param array<string, mixed> $settings   Resolved gallery settings.
	 * @param int                  $gallery_id Gallery ID.
	 */
	public function __construct( array $settings, int $gallery_id ) {
		$this->settings   = $settings;
		$this->gallery_id = $gallery_id;
	}

	/**
	 * Whether the info panel is enabled.
	 *
	 * @since  1.2.0
	 * @return bool
	 */
	public function panel_enabled(): bool {
		return $this->setting_to_bool( $this->settings['lightbox_info_panel_enabled'] ?? true );
	}

	/**
	 * Info blocks the panel shows, in order. Empty when the panel is off.
	 *
	 * @since  1.2.0
	 * @return array<int, string>
	 */
	public function blocks(): array {
		if ( ! $this->panel_enabled() ) {
			return array();
		}

		$raw = $this->settings['lightbox_info_blocks'] ?? self::DEFAULT_BLOCKS;
		$raw = is_array( $raw ) ? $raw : array();

		return array_values( array_filter( array_map( 'strval', $raw ) ) );
	}

	/**
	 * Whether the panel shows a block.
	 *
	 * @since  1.2.0
	 * @param  string $block Block ID, e.g. 'exif' or 'location'.
	 * @return bool
	 */
	public function shows( string $block ): bool {
		return in_array( $block, $this->blocks(), true );
	}

	/**
	 * EXIF field keys the EXIF block displays, in order.
	 *
	 * Empty unless the panel shows the EXIF block and `display_exif` is on.
	 *
	 * @since  1.2.0
	 * @return array<int, string>
	 */
	public function exif_fields(): array {
		if ( ! $this->shows( 'exif' ) || ! $this->setting_to_bool( $this->settings['display_exif'] ?? false ) ) {
			return array();
		}

		return Exif_Extractor::enabled_fields_for_settings( $this->settings, $this->gallery_id );
	}
}
