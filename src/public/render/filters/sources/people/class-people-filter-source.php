<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources\People;

use FotoGrids\Render\Filters\Sources\Metadata_Filter_Source;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * People filter source.
 *
 * Provides one Filter_Option per person assigned to at least one item
 * in the current gallery. Active when `filter_by` contains 'people'.
 *
 * Mirrors People_Filter_Decorator which stamps `data-fg-people` on each
 * item.
 *
 * @package FotoGrids\Render\Filters\Sources\People
 * @since   1.0.0
 */
final class People_Filter_Source extends Metadata_Filter_Source {

    public function id(): string {
        return 'fotogrids/filter/people';
    }

    public function item_data_attr_key(): string {
        return 'data-fg-people';
    }

    public function filter_arg_key(): string {
        return 'people';
    }

    protected function filter_by_token(): string {
        return 'people';
    }

    protected function metadata_type(): string {
        return 'person';
    }

    protected function group_label_string(): string {
        return __( 'People', 'fotogrids' );
    }
}
