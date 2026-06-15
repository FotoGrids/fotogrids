<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable layout configuration values.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Layout {

	public string $layout_id;
	public string $columns_mode;
	public array $responsive_columns;
	public array $responsive_spacing;
	public array $columns_auto_range;
	public string $item_aspect_ratio;
	public string $item_object_fit;

	/**
	 * @param array<string, int> $responsive_columns Breakpoint columns map.
	 * @param array<string, array{value: int|float, unit: string}> $responsive_spacing Breakpoint spacing map.
	 * @param array<string, mixed> $columns_auto_range Auto column configuration map.
	 * @param string $item_aspect_ratio Resolved CSS aspect-ratio value (e.g. "4 / 3"). Empty string falls through to CSS default.
	 * @param string $item_object_fit   CSS object-fit value ("cover" | "contain"). Empty string falls through to CSS default.
	 */
	public function __construct(
		string $layout_id,
		string $columns_mode,
		array $responsive_columns,
		array $responsive_spacing,
		array $columns_auto_range,
		string $item_aspect_ratio = '',
		string $item_object_fit = ''
	) {
		$this->layout_id = $layout_id;
		$this->columns_mode = $columns_mode;
		$this->responsive_columns = $responsive_columns;
		$this->responsive_spacing = $responsive_spacing;
		$this->columns_auto_range = $columns_auto_range;
		$this->item_aspect_ratio = $item_aspect_ratio;
		$this->item_object_fit = $item_object_fit;
	}
}
