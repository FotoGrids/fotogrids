<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for render layout modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Layout {

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
     * @return  string
     */
    public function layout_key(): string;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @param   Item_Renderer  $item_renderer  Shared item renderer.
     * @return  string
     */
    public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string;

    /**
     * CSS classes added to the wrapper element for layout-specific structural
     * rules (e.g. 'fg-layout-grid'). Layouts are the only module type that
     * still contribute classes — everything else uses data attributes.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<int, string>
     */
    public function structural_classes( Render_Context $render_context ): array;

    /**
     * Data attributes to merge onto the collection wrapper element.
     *
     * Keys must be prefixed with 'data-fg-'. See Decorator::wrapper_data_attrs()
     * for the full convention.
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
