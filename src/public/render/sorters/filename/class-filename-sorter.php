<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Filename;

use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;
use FotoGrids\Render\Sorters\Abstract_Db_Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Filename sorter - orders items A-Z by the attachment's filename.
 *
 * The filename is extracted from the attachment's guid (the stored file URL).
 * Comparison is case-insensitive. There is no direction setting for filename
 * in sorting.json - only A-Z is supported at the Free tier.
 *
 * Uses a single batch SELECT against wp_posts; no N+1.
 *
 * @package FotoGrids\Render\Sorters\Filename
 * @since   1.0.0
 */
final class Filename_Sorter extends Abstract_Db_Sorter implements Sorter {

	public function id(): string {
		return 'fotogrids/sort/filename';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	/**
	 * Active when default_sort_order is 'filename' on a public render.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		return ( $render_context->settings['default_sort_order'] ?? '' ) === 'filename';
	}

	/**
	 * Sort case-insensitively by the basename of each attachment's guid.
	 *
	 * @since  1.0.0
	 */
	public function sort( array $item_ids, Render_Context $render_context ): array {
		if ( count( $item_ids ) <= 1 ) {
			return $item_ids;
		}

		$row_map = $this->batch_fetch( $item_ids );
		if ( empty( $row_map ) ) {
			return $item_ids;
		}

		[ $sortable, $unsortable ] = $this->split_sortable( $item_ids, $row_map );

		// Precompute a sort key per item: an attachment sorts by its filename
		// (guid basename); an embed has no filename, so it sorts by its video
		// ID instead.
		$keys = array();
		foreach ( $sortable as $id ) {
			$row = $row_map[ $id ];
			if ( ( $row['post_type'] ?? '' ) === \FotoGrids\Galleries\Embed_Store::POST_TYPE ) {
				$embed       = \FotoGrids\Galleries\Embed_Store::get( $id );
				$keys[ $id ] = $embed ? (string) $embed['video_id'] : '';
			} else {
				$keys[ $id ] = basename( (string) $row['guid'] );
			}
		}

		usort(
			$sortable,
			static function ( int $a, int $b ) use ( $keys ): int {
				return strcasecmp( $keys[ $a ], $keys[ $b ] );
			}
		);

		return array_values( array_merge( $sortable, $unsortable ) );
	}
}
