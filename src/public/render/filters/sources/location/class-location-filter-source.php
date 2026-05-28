<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources\Location;

use FotoGrids\Render\Filters\Sources\Metadata_Filter_Source;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Location filter source.
 *
 * Provides one Filter_Option per location assigned to at least one item
 * in the current gallery. Active when `filter_by` contains 'location'.
 *
 * Mirrors Location_Filter_Decorator which stamps `data-fg-location` on
 * each item.
 *
 * @package FotoGrids\Render\Filters\Sources\Location
 * @since   1.0.0
 */
final class Location_Filter_Source extends Metadata_Filter_Source {

    public function id(): string {
        return 'fotogrids/filter/location';
    }

    public function item_data_attr_key(): string {
        return 'data-fg-location';
    }

    public function filter_arg_key(): string {
        return 'location';
    }

    protected function filter_by_token(): string {
        return 'location';
    }

    protected function metadata_type(): string {
        return 'location';
    }

    protected function group_label_string(): string {
        return __( 'Location', 'fotogrids' );
    }
}
