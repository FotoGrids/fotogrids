<?php
/**
 * Elementor control: FotoGrids album picker.
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
 * Picks one FotoGrids album for an Elementor widget. Sibling to
 * {@see Gallery_Picker}.
 *
 * @since 1.0.0
 */
class Album_Picker extends Base_Collection_Picker {

    public const TYPE = 'fotogrids_album_picker';

    public function get_type(): string {
        return self::TYPE;
    }

    protected function get_kind(): string {
        return 'album';
    }
}
