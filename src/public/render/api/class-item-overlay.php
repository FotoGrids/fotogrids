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

	public string $html;
	public string $position_class;
	public array $extra_classes;

	/**
	 * @param array<int, string> $extra_classes Additional classes for overlay node.
	 */
	public function __construct(
		string $html,
		string $position_class,
		array $extra_classes = array()
	) {
		$this->html = $html;
		$this->position_class = $position_class;
		$this->extra_classes = $extra_classes;
	}
}
