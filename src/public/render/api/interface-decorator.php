<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for render decorator modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Decorator {

    /**
     * @since   1.0.0
     * @return  string
     */
    public function id(): string;

    /**
     * @since   1.0.0
     * @return  string
     */
    public function origin(): string;

    /**
     * @since   1.0.0
     * @return  string|null
     */
    public function replaces(): ?string;

    /**
     * @since   1.0.0
     * @return  string|null
     */
    public function extends_id(): ?string;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool;

    /**
     * @since   1.0.0
     * @param   array<int, Item_View> $collection_items Item values.
     * @param   Render_Context        $render_context   Render context.
     * @return  array<int, Item_View>
     */
    public function decorate_items( array $collection_items, Render_Context $render_context ): array;

    /**
     * Data attributes to merge onto the collection wrapper element.
     *
     * Keys must be prefixed with 'data-fg-'. Values are meaningful tokens
     * (e.g. 'data-fg-border' => 'solid') — never bare booleans. An attribute
     * should only be returned when the feature is active; omitting it entirely
     * is the canonical "off" state.
     *
     * Multi-value attributes use space-separated tokens so CSS attribute
     * selectors ([data-fg-filter~="grayscale"]) work without parsing.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<string, string|Responsive_Var>
     */
    public function style_vars( Render_Context $render_context ): array;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets;
}
