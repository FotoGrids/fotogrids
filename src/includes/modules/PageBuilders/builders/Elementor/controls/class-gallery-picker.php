<?php
/**
 * Elementor control: FotoGrids gallery picker.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Picks one published-or-otherwise FotoGrids gallery for an Elementor
 * widget.
 *
 * The Elementor control type slug is `fotogrids_gallery_picker`;
 * widgets reference it as `Controls_Manager::FOTOGRIDS_GALLERY_PICKER`
 * via the constant defined by
 * {@see \FotoGrids\Modules\PageBuilders\Builders\Elementor\Module}.
 *
 * @since 1.0.0
 */
class Gallery_Picker extends Base_Collection_Picker {

	public const TYPE = 'fotogrids_gallery_picker';

	public function get_type(): string {
		return self::TYPE;
	}

	protected function get_kind(): string {
		return 'gallery';
	}
}
