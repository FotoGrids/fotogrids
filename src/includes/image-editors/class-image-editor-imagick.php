<?php
/**
 * WordPress Imagick image editor with crop-position file names.
 *
 * @package FotoGrids\Image_Editors
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Image_Editors;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Core's Imagick editor, naming off-centre FotoGrids crop files by their crop position.
 *
 * @since 1.3.0
 */
class Image_Editor_Imagick extends \WP_Image_Editor_Imagick {
	use Crop_Suffix;
}
