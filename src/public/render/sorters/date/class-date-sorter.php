<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Date;

use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;
use FotoGrids\Render\Sorters\Abstract_Db_Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Date sorter - orders items by attachment date.
 *
 * Sub-settings read from the render context:
 *   date_sort_type      'date_created' (post_date) | 'date_updated' (post_modified)
 *   date_sort_direction 'desc' (newest first) | 'asc' (oldest first)
 *
 * Uses a single batch SELECT against wp_posts; no N+1.
 *
 * @package FotoGrids\Render\Sorters\Date
 * @since   1.0.0
 */
final class Date_Sorter extends Abstract_Db_Sorter implements Sorter {

	public function id(): string {
		return 'fotogrids/sort/date';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	/**
	 * Active when default_sort_order is 'date' on a public render.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		return ( $render_context->settings['default_sort_order'] ?? '' ) === 'date';
	}

	/**
	 * Sort by post_date or post_modified, ascending or descending.
	 *
	 * @since  1.0.0
	 */
	public function sort( array $item_ids, Render_Context $render_context ): array {
		if ( count( $item_ids ) <= 1 ) {
			return $item_ids;
		}

		$settings  = $render_context->settings;
		$date_type = is_string( $settings['date_sort_type'] ?? null )
			? $settings['date_sort_type']
			: 'date_created';
		$direction = is_string( $settings['date_sort_direction'] ?? null )
			? $settings['date_sort_direction']
			: 'desc';
		$date_col  = 'date_updated' === $date_type ? 'post_modified' : 'post_date';

		$row_map = $this->batch_fetch( $item_ids );
		if ( empty( $row_map ) ) {
			return $item_ids;
		}

		[ $sortable, $unsortable ] = $this->split_sortable( $item_ids, $row_map );

		usort(
			$sortable,
			static function ( int $a, int $b ) use ( $row_map, $date_col, $direction ): int {
				$cmp = strcmp( $row_map[ $a ][ $date_col ], $row_map[ $b ][ $date_col ] );
				return 'asc' === $direction ? $cmp : -$cmp;
			}
		);

		return array_values( array_merge( $sortable, $unsortable ) );
	}
}
