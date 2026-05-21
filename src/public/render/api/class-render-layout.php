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

    /**
     * @param array<string, int> $responsive_columns Breakpoint columns map.
     * @param array<string, array{value: int|float, unit: string}> $responsive_spacing Breakpoint spacing map.
     * @param array<string, mixed> $columns_auto_range Auto column configuration map.
     */
    public function __construct(
        public readonly string $layout_id,
        public readonly Columns_Mode $columns_mode,
        public readonly array $responsive_columns,
        public readonly array $responsive_spacing,
        public readonly array $columns_auto_range,
    ) {}
}
