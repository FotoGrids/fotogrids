<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Immutable metadata describing the render request.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Meta {

    /**
     * @since   1.0.0
     * @param   int            $gallery_id Gallery identifier.
     * @param   int|null       $album_id Album identifier.
     * @param   string         $instance_id Unique instance ID.
     * @param   Request_Source $source Render source.
     * @param   bool           $is_preview Whether this is preview mode.
     * @param   Render_Mode    $mode Request mode.
     * @param   int            $schema_version Request schema version.
     * @return  void
     */
    public function __construct(
        public readonly int $gallery_id,
        public readonly ?int $album_id,
        public readonly string $instance_id,
        public readonly Request_Source $source,
        public readonly bool $is_preview,
        public readonly Render_Mode $mode,
        public readonly int $schema_version = 2,
    ) {}
}
