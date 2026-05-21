<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Immutable render context values for module execution.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Context {

    /**
     * @param array<string, mixed> $settings Render settings map.
     * @param array<int, Item_View> $items Collection items.
     * @param array<int, string> $warnings Preview warnings.
     */
    public function __construct(
        public readonly Render_Meta $meta,
        public readonly Render_Layout $layout,
        public readonly Render_Behavior $behavior,
        public readonly array $settings,
        public readonly array $items,
        public readonly array $warnings = [],
    ) {}

    /**
     * Returns a cloned context with selected fields replaced.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $changes Replacement values.
     * @return  self
     */
    public function with( array $changes ): self {
        $allowed_keys = [ 'items', 'settings', 'warnings' ];

        foreach ( array_keys( $changes ) as $change_key ) {
            if ( ! in_array( $change_key, $allowed_keys, true ) ) {
                throw new \InvalidArgumentException( sprintf( "Render_Context::with() does not support replacing '%s'", $change_key ) );
            }
        }

        return new self(
            meta: $this->meta,
            layout: $this->layout,
            behavior: $this->behavior,
            settings: $changes['settings'] ?? $this->settings,
            items: $changes['items'] ?? $this->items,
            warnings: $changes['warnings'] ?? $this->warnings,
        );
    }
}
