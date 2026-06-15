<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Overlay fragments rendered on item media.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Item_Overlay {

	/**
	 * @param array<int, string> $extra_classes Additional classes for overlay node.
	 */
	public function __construct(
		public readonly string $html,
		public readonly string $position_class,
		public readonly array $extra_classes = array(),
	) {}
}
