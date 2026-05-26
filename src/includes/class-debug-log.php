<?php
declare(strict_types=1);

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Centralised debug-log gate.
 *
 * Every internal `error_log( '[FotoGrids ...] ...' )` call site goes through
 * this helper instead of writing to PHP's error log directly. Logging is gated
 * twice:
 *
 *  1. `WP_DEBUG` must be true (the platform-level dev flag).
 *  2. The channel must be enabled - either by a `FOTOGRIDS_DEBUG_<CHANNEL>`
 *     constant (true wins, false hard-disables) or by the
 *     `fotogrids_debug_channels` option managed from the Maintenance tab.
 *
 * Default state on a fresh `WP_DEBUG` dev box: every channel is off. The user
 * opts in per channel from Plugin Settings -> Maintenance -> Debug Log.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
final class Debug_Log {

    /**
     * Option key holding the array of enabled channel slugs.
     */
    private const OPTION_KEY = 'fotogrids_debug_channels';

    /**
     * Channel manifest. Each entry describes a logical area of the plugin that
     * emits its own `[FotoGrids <Label>]` log lines. The UI in the Maintenance
     * tab renders one toggle per entry.
     *
     * Keeping the manifest in one place means adding a channel is a one-line
     * change here plus the call-site swap to `Debug_Log::write()`.
     *
     * @return array<int, array<string, string>>
     */
    public static function get_channels(): array {
        return array(
            array(
                'slug'        => 'catalog',
                'label'       => __( 'Catalog & state resolver', 'fotogrids' ),
                'description' => __( 'Loads settings catalog files and resolves per-field tier state.', 'fotogrids' ),
            ),
            array(
                'slug'        => 'catalog_assembler',
                'label'       => __( 'Catalog assembler', 'fotogrids' ),
                'description' => __( 'Builds the admin settings tree from contributing catalog files.', 'fotogrids' ),
            ),
            array(
                'slug'        => 'edit_gate',
                'label'       => __( 'Edit gate', 'fotogrids' ),
                'description' => __( 'Enforces which fields a given license tier is allowed to edit.', 'fotogrids' ),
            ),
            array(
                'slug'        => 'module_registry',
                'label'       => __( 'Module registry', 'fotogrids' ),
                'description' => __( 'Registers and boots Free and Pro modules.', 'fotogrids' ),
            ),
            array(
                'slug'        => 'license',
                'label'       => __( 'License (Freemius)', 'fotogrids' ),
                'description' => __( 'Freemius bootstrap and license-plan lookups.', 'fotogrids' ),
            ),
            array(
                'slug'        => 'render',
                'label'       => __( 'Render pipeline', 'fotogrids' ),
                'description' => __( 'Gallery and album rendering, including error context.', 'fotogrids' ),
            ),
        );
    }

    /**
     * Returns the list of channel slugs that are currently enabled by the
     * stored option. Channels overridden by a constant are NOT reflected here -
     * `should_log()` checks the constant separately.
     *
     * @since 1.0.0
     * @return array<int, string>
     */
    public static function get_enabled_channels(): array {
        $stored = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $stored ) ) {
            return array();
        }

        $valid_slugs = array_map(
            static fn( array $channel ): string => $channel['slug'],
            self::get_channels()
        );

        return array_values( array_intersect( $valid_slugs, array_map( 'strval', $stored ) ) );
    }

    /**
     * Persist the list of enabled channel slugs. Unknown slugs are dropped
     * silently so the UI cannot accidentally store garbage.
     *
     * @since 1.0.0
     * @param array<int, string> $slugs Channel slugs to enable.
     * @return array<int, string> The normalised list that was persisted.
     */
    public static function save_enabled_channels( array $slugs ): array {
        $valid_slugs = array_map(
            static fn( array $channel ): string => $channel['slug'],
            self::get_channels()
        );

        $clean = array_values( array_intersect( $valid_slugs, array_map( 'strval', $slugs ) ) );

        update_option( self::OPTION_KEY, $clean, false );

        return $clean;
    }

    /**
     * Returns the constant name that overrides a channel, e.g. 'catalog' ->
     * 'FOTOGRIDS_DEBUG_CATALOG'. Exposed so the UI can show the constant name
     * next to a forced row.
     *
     * @since 1.0.0
     * @param string $channel Channel slug.
     * @return string
     */
    public static function constant_name_for( string $channel ): string {
        return 'FOTOGRIDS_DEBUG_' . strtoupper( $channel );
    }

    /**
     * Whether the channel is currently locked to a value by a constant. The
     * constant wins over the stored option, in either direction (a constant
     * defined as `false` forces the channel off regardless of the toggle).
     *
     * @since 1.0.0
     * @param string $channel Channel slug.
     * @return array{forced: bool, value: bool}
     */
    public static function constant_state_for( string $channel ): array {
        $name = self::constant_name_for( $channel );

        if ( ! defined( $name ) ) {
            return array( 'forced' => false, 'value' => false );
        }

        return array(
            'forced' => true,
            'value'  => (bool) constant( $name ),
        );
    }

    /**
     * Single source of truth used by every internal call site. Returns true
     * when both `WP_DEBUG` is on AND the channel is enabled (after applying
     * the constant override).
     *
     * @since 1.0.0
     * @param string $channel Channel slug.
     * @return bool
     */
    public static function should_log( string $channel ): bool {
        if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
            return false;
        }

        $constant_state = self::constant_state_for( $channel );
        if ( $constant_state['forced'] ) {
            return $constant_state['value'];
        }

        return in_array( $channel, self::get_enabled_channels(), true );
    }

    /**
     * Convenience wrapper used by call sites. Writes the message to PHP's
     * error log iff `should_log( $channel )` returns true. The message is
     * prefixed with a stable `[FotoGrids <Label>]` tag derived from the
     * channel manifest so log lines stay greppable.
     *
     * @since 1.0.0
     * @param string $channel Channel slug.
     * @param string $message Log message body.
     * @return void
     */
    public static function write( string $channel, string $message ): void {
        if ( ! self::should_log( $channel ) ) {
            return;
        }

        $label = self::label_for( $channel );

        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
        error_log( sprintf( '[FotoGrids %s] %s', $label, $message ) );
    }

    /**
     * Looks up the human-readable label for a channel. Falls back to the slug
     * if the channel isn't in the manifest, which only happens during
     * development when a new channel is being wired up.
     *
     * @since 1.0.0
     * @param string $channel Channel slug.
     * @return string
     */
    private static function label_for( string $channel ): string {
        foreach ( self::get_channels() as $entry ) {
            if ( $entry['slug'] === $channel ) {
                return (string) $entry['label'];
            }
        }

        return $channel;
    }
}
