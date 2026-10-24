<?php
/**
 * Crop-position file suffix for FotoGrids image editors.
 *
 * @package FotoGrids\Image_Editors
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Image_Editors;

use FotoGrids\Image_Size_Manager;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Appends the crop position to the file name of an off-centre FotoGrids sub-size.
 *
 * @since 1.3.0
 */
trait Crop_Suffix {

	/**
	 * Crop position appended to the file name of the sub-size being made.
	 *
	 * @var string
	 */
	private $fotogrids_crop_suffix = '';

	/**
	 * Create an image sub-size and return its data.
	 *
	 * @since  1.3.0
	 * @param  array<string, mixed> $size_data Width, height and crop of the sub-size.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function make_subsize( $size_data ) {
		$this->fotogrids_crop_suffix = is_array( $size_data ) ? Image_Size_Manager::subsize_file_suffix( $size_data ) : '';

		try {
			return parent::make_subsize( $size_data );
		} finally {
			$this->fotogrids_crop_suffix = '';
		}
	}

	/**
	 * Suffix for the file name of the image at its current size.
	 *
	 * @since  1.3.0
	 * @return string|false
	 */
	public function get_suffix() {
		$suffix = parent::get_suffix();

		if ( false === $suffix || '' === $this->fotogrids_crop_suffix ) {
			return $suffix;
		}

		return $suffix . '-' . $this->fotogrids_crop_suffix;
	}
}
