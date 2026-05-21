<?php
declare(strict_types=1);

namespace FotoGrids\Settings;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Normalizes collection settings to canonical render shapes.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */
final class Settings_Normalizer {

    /**
     * Normalize settings payload to canonical shape.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $settings Raw settings.
     * @return  array<string, mixed>
     */
    public static function normalize( array $settings ): array {
        return $settings;
    }
}
