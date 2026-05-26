<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Immutable behavior configuration values.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Behavior {

    /**
     * @since   1.0.0
     * @param   string      $click_behavior Click interaction mode.
     * @param   string      $pagination_type Pagination type.
     * @param   string      $pagination_method Pagination method.
     * @param   string|null $hover_effect Hover effect ID.
     * @return  void
     */
    public function __construct(
        public readonly string $click_behavior,
        public readonly string $pagination_type,
        public readonly string $pagination_method,
        public readonly ?string $hover_effect,
    ) {}
}
