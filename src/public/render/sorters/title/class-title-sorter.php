<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Title;

use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;
use FotoGrids\Render\Sorters\Abstract_Db_Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Title sorter - orders items alphabetically by attachment post_title.
 *
 * Sub-setting read from the render context:
 *   title_sort_direction  'asc' (A-Z) | 'desc' (Z-A)
 *
 * Uses a single batch SELECT against wp_posts; no N+1.
 *
 * @package FotoGrids\Render\Sorters\Title
 * @since   1.0.0
 */
final class Title_Sorter extends Abstract_Db_Sorter implements Sorter {

	public function id(): string {
		return 'fotogrids/sort/title';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	/**
	 * Active when default_sort_order is 'title' on a public render.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		return ( $render_context->settings['default_sort_order'] ?? '' ) === 'title';
	}

	/**
	 * Sort case-insensitively by post_title, A-Z or Z-A.
	 *
	 * @since  1.0.0
	 */
	public function sort( array $item_ids, Render_Context $render_context ): array {
		if ( count( $item_ids ) <= 1 ) {
			return $item_ids;
		}

		$direction = is_string( $render_context->settings['title_sort_direction'] ?? null )
			? $render_context->settings['title_sort_direction']
			: 'asc';

		$row_map = $this->batch_fetch( $item_ids );
		if ( empty( $row_map ) ) {
			return $item_ids;
		}

		[ $sortable, $unsortable ] = $this->split_sortable( $item_ids, $row_map );

		usort(
			$sortable,
			static function ( int $a, int $b ) use ( $row_map, $direction ): int {
				$cmp = strcasecmp( $row_map[ $a ]['post_title'], $row_map[ $b ]['post_title'] );
				return 'asc' === $direction ? $cmp : -$cmp;
			}
		);

		return array_values( array_merge( $sortable, $unsortable ) );
	}
}
