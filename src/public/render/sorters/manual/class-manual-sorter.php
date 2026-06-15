<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Manual;

use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Manual sorter - preserves the drag-arranged order exactly.
 *
 * This is the default/fallback sorter. It returns the ID list untouched.
 * It is intentionally never active for preview renders so the admin always
 * sees the manual order they arranged, without needing this module to run.
 *
 * @package FotoGrids\Render\Sorters\Manual
 * @since   1.0.0
 */
final class Manual_Sorter implements Sorter {

	public function id(): string {
		return 'fotogrids/sort/manual';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Active when default_sort_order is 'manual' (or absent) on a public render.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		$order = $render_context->settings['default_sort_order'] ?? 'manual';
		return ! is_string( $order ) || 'manual' === $order;
	}

	/**
	 * No-op: returns IDs unchanged.
	 *
	 * @since  1.0.0
	 */
	public function sort( array $item_ids, Render_Context $render_context ): array {
		return $item_ids;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}
}
