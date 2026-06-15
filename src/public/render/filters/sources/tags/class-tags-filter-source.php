<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources\Tags;

use FotoGrids\Render\Filters\Sources\Metadata_Filter_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Tags filter source.
 *
 * Provides one Filter_Option per tag assigned to at least one item in
 * the current gallery. Active when `filter_by` contains 'tags'.
 *
 * Mirrors Tags_Filter_Decorator which stamps `data-fg-tags` on each item.
 *
 * @package FotoGrids\Render\Filters\Sources\Tags
 * @since   1.0.0
 */
final class Tags_Filter_Source extends Metadata_Filter_Source {

	public function id(): string {
		return 'fotogrids/filter/tags';
	}

	public function item_data_attr_key(): string {
		return 'data-fg-tags';
	}

	public function filter_arg_key(): string {
		return 'tags';
	}

	protected function filter_by_token(): string {
		return 'tags';
	}

	protected function metadata_type(): string {
		return 'tag';
	}

	protected function group_label_string(): string {
		return __( 'Tags', 'fotogrids' );
	}
}
