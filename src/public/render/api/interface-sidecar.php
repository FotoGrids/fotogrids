<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for render sidecar modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Sidecar {

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
    public function extends_id(): ?string;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function render( Render_Context $render_context ): string;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets;
}
