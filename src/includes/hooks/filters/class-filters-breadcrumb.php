<?php
/**
 * Collection-header breadcrumb filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Breadcrumb filter hooks.
 */
final class Filters_Breadcrumb {

    /**
     * Whether to emit BreadcrumbList JSON-LD schema.
     *
     * @since 1.0.0
     * @param bool                                 $should_emit Default true.
     * @param int                                  $gallery_id  Gallery ID.
     * @param int|null                             $album_id    Album ID, if any.
     * @param \FotoGrids\Render\Api\Render_Context $context     Render context.
     */
    public const SHOULD_EMIT_SCHEMA = 'fotogrids/breadcrumb/should_emit_schema';

    /**
     * Final breadcrumb HTML override (return non-null to short-circuit).
     *
     * @since 1.0.0
     * @param string|null $overridden     Override HTML or null.
     * @param int         $gallery_id     Gallery ID.
     * @param int|null    $album_id       Album ID, if any.
     * @param array       $filter_context Filter context payload.
     */
    public const RENDER_HTML = 'fotogrids/breadcrumb/render_html';

    /**
     * SVG markup used as the separator between breadcrumb segments.
     *
     * @since 1.0.0
     * @param string $separator_svg SVG markup.
     */
    public const SEPARATOR_SVG = 'fotogrids/breadcrumb/separator_svg';
}
