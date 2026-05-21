<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Loads and normalizes JSON-backed settings catalog entries.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class Catalog {

    /**
     * @var array<string, array<string, mixed>>
     */
    private static array $entries = [];

    /**
     * Raw catalog files preserved in load order, used by the assembler to build
     * the admin settings tree. Each entry is the decoded JSON contents of a
     * catalog file plus an `origin` tag identifying the contributing plugin.
     *
     * @var array<int, array<string, mixed>>
     */
    private static array $raw_files = [];

    private static bool $loaded = false;

    /**
     * Loads all catalog JSON files once.
     *
     * @since   1.0.0
     * @return  void
     */
    public static function init(): void {
        if ( self::$loaded ) {
            return;
        }

        foreach ( self::get_json_files() as $json_file_path ) {
            self::load_json_file( $json_file_path );
        }

        self::$loaded = true;
    }

    /**
     * Returns one catalog entry by field ID.
     *
     * @since   1.0.0
     * @param   string $field_id Field identifier.
     * @return  array<string, mixed>|null
     */
    public static function get( string $field_id ): ?array {
        self::init();

        return self::$entries[ $field_id ] ?? null;
    }

    /**
     * Returns all loaded catalog entries.
     *
     * @since   1.0.0
     * @return  array<string, array<string, mixed>>
     */
    public static function all(): array {
        self::init();

        return self::$entries;
    }

    /**
     * Returns the raw catalog files in load order, each tagged with an `origin`
     * slug identifying the contributing plugin.
     *
     * Consumed by the Catalog_Assembler to build the admin settings tree.
     * Side-effect free; safe to call multiple times.
     *
     * @since   1.0.0
     * @return  array<int, array<string, mixed>>
     */
    public static function raw_files(): array {
        self::init();

        return self::$raw_files;
    }

    /**
     * Resets loaded state for tests.
     *
     * @since   1.0.0
     * @return  void
     */
    public static function reset_for_tests(): void {
        self::$entries = [];
        self::$raw_files = [];
        self::$loaded  = false;
    }

    /**
     * Returns all JSON files contributing catalog entries.
     *
     * @since   1.0.0
     * @return  array<int, string>
     */
    private static function get_json_files(): array {
        $free_catalog_dir = trailingslashit( FOTOGRIDS_PLUGIN_DIR . 'assets/admin/plain/collection-settings' );
        $json_file_paths  = [
            $free_catalog_dir . 'layout.json',
            $free_catalog_dir . 'interactions.json',
            $free_catalog_dir . 'styling.json',
            $free_catalog_dir . 'captions.json',
            $free_catalog_dir . 'media.json',
            $free_catalog_dir . 'video.json',
            $free_catalog_dir . 'effects.json',
            $free_catalog_dir . 'custom-code.json',
            $free_catalog_dir . 'performance.json',
            $free_catalog_dir . 'sorting.json',
            $free_catalog_dir . 'filtering.json',
            $free_catalog_dir . 'permissions.json',
            $free_catalog_dir . 'security.json',
            $free_catalog_dir . 'sharing.json',
            $free_catalog_dir . 'ecommerce.json',
            $free_catalog_dir . 'exif.json',
            $free_catalog_dir . 'advanced.json',
            $free_catalog_dir . 'gallery-general.json',
        ];

        $json_file_paths = apply_filters( 'fotogrids/catalog/json_files', $json_file_paths );

        if ( ! is_array( $json_file_paths ) ) {
            return [];
        }

        return array_values(
            array_filter(
                array_map( static fn( $value ) => is_string( $value ) ? $value : '', $json_file_paths ),
                static fn( string $path ): bool => $path !== ''
            )
        );
    }

    /**
     * Loads one JSON file: registers it in the raw-files list (for the assembler)
     * and flattens its settings into the per-field entries map (for state lookup).
     *
     * The placement block on each file is consumed by Catalog_Assembler. Two
     * placement modes need special handling at load time:
     *
     *  - `extend_options`: appends options to an existing field's options array
     *    in the entries map, so per-option tier lookups still work.
     *
     * All other modes (`insert_tab`, `insert_subtab`, `insert_section`, `replace`,
     * `hide`) only affect the assembled tree, never the entries map. The
     * settings inside those files still register their per-field entries so
     * State_Resolver can find them.
     *
     * @since   1.0.0
     * @param   string $json_file_path Absolute JSON file path.
     * @return  void
     */
    private static function load_json_file( string $json_file_path ): void {
        if ( ! file_exists( $json_file_path ) ) {
            self::dev_log( sprintf( 'Catalog file missing: %s', $json_file_path ) );
            return;
        }

        $raw_json = file_get_contents( $json_file_path );
        if ( $raw_json === false ) {
            self::dev_log( sprintf( 'Catalog file unreadable: %s', $json_file_path ) );
            return;
        }

        $decoded_json = json_decode( $raw_json, true );
        if ( ! is_array( $decoded_json ) ) {
            self::dev_log( sprintf( 'Catalog file invalid JSON: %s', $json_file_path ) );
            return;
        }

        $decoded_json['origin'] = self::infer_origin_from_path( $json_file_path );
        self::$raw_files[] = $decoded_json;

        $placement = $decoded_json['placement'] ?? null;
        $placement_mode = is_array( $placement ) ? ( $placement['mode'] ?? null ) : null;

        if ( $placement_mode === 'extend_options' ) {
            self::apply_extend_options( $placement, $json_file_path );
            return;
        }

        $settings = $decoded_json['settings'] ?? null;
        if ( ! is_array( $settings ) ) {
            return;
        }

        self::flatten_settings( $settings, $decoded_json );
    }

    /**
     * Infer the contributing plugin's origin slug from the catalog file's path.
     *
     * Files under the Pro plugin directory are tagged 'fotogrids-pro'; everything
     * else is tagged 'fotogrids'. Third-party plugins can override by setting an
     * explicit `origin` field at the top of their catalog file before contributing
     * it through the `fotogrids/catalog/json_files` filter.
     *
     * @since   1.0.0
     * @param   string $json_file_path Absolute path to the catalog JSON.
     * @return  string
     */
    private static function infer_origin_from_path( string $json_file_path ): string {
        if ( defined( 'FOTOGRIDS_PRO_PLUGIN_DIR' ) && str_starts_with( $json_file_path, FOTOGRIDS_PRO_PLUGIN_DIR ) ) {
            return 'fotogrids-pro';
        }

        return 'fotogrids';
    }

    /**
     * Flattens nested settings/groups/subtabs to keyed entries.
     *
     * @since   1.0.0
     * @param   array<int, array<string, mixed>> $settings Catalog settings branch.
     * @param   array<string, mixed>              $group Root group metadata.
     * @return  void
     */
    private static function flatten_settings( array $settings, array $group ): void {
        foreach ( $settings as $setting ) {
            if ( ! is_array( $setting ) ) {
                continue;
            }

            $setting_type = $setting['type'] ?? '';
            if ( $setting_type === 'setting_group' && ! empty( $setting['settings'] ) && is_array( $setting['settings'] ) ) {
                self::flatten_settings( $setting['settings'], $group );
                continue;
            }

            if ( $setting_type === 'setting_subtabs' && ! empty( $setting['subTabs'] ) && is_array( $setting['subTabs'] ) ) {
                foreach ( $setting['subTabs'] as $sub_tab ) {
                    if ( is_array( $sub_tab ) && ! empty( $sub_tab['settings'] ) && is_array( $sub_tab['settings'] ) ) {
                        self::flatten_settings( $sub_tab['settings'], $group );
                    }
                }
                continue;
            }

            $field_key = $setting['key'] ?? null;
            if ( ! is_string( $field_key ) || $field_key === '' ) {
                continue;
            }

            self::$entries[ $field_key ] = self::normalize( $setting, $group );
        }
    }

    /**
     * Applies an extend_options placement into an existing setting's options map.
     *
     * Called for catalog files with `placement.mode = extend_options`. Affects
     * only the per-field entries map used by State_Resolver; the assembler
     * performs the same operation on the assembled tree independently so the
     * UI sees the added options too.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $placement Extend_options placement descriptor.
     * @param   string               $json_file_path Source JSON path.
     * @return  void
     */
    private static function apply_extend_options( array $placement, string $json_file_path ): void {
        $target_setting_key = $placement['extend_setting'] ?? null;
        $target_options     = $placement['extend_options'] ?? null;

        if ( ! is_string( $target_setting_key ) || $target_setting_key === '' || ! is_array( $target_options ) ) {
            self::dev_log( sprintf( 'Catalog extend payload invalid: %s', $json_file_path ) );
            return;
        }

        if ( ! isset( self::$entries[ $target_setting_key ] ) ) {
            self::dev_log( sprintf( 'Catalog extend target missing: %s (%s)', $target_setting_key, $json_file_path ) );
            return;
        }

        $existing_entry   = self::$entries[ $target_setting_key ];
        $existing_options = $existing_entry['options'] ?? [];
        if ( ! is_array( $existing_options ) ) {
            $existing_options = [];
        }

        foreach ( $target_options as $option ) {
            if ( ! is_array( $option ) ) {
                continue;
            }

            $option_value = $option['value'] ?? ( $option['key'] ?? null );
            if ( ! is_string( $option_value ) || $option_value === '' ) {
                continue;
            }

            if ( isset( $existing_options[ $option_value ] ) ) {
                self::dev_log( sprintf( 'Catalog option collision on %s.%s (%s)', $target_setting_key, $option_value, $json_file_path ) );
            }

            $existing_options[ $option_value ] = [
                'label'         => $option['label'] ?? $option_value,
                'tier_required' => self::normalize_tier( $option ),
                'icon'          => $option['icon'] ?? null,
                'description'   => $option['description'] ?? null,
            ];
        }

        $existing_entry['options'] = $existing_options;
        self::$entries[ $target_setting_key ] = $existing_entry;
    }

    /**
     * Normalizes one raw setting record into the canonical entry shape.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $raw_setting Raw setting map.
     * @param   array<string, mixed> $group Group metadata.
     * @return  array<string, mixed>
     */
    private static function normalize( array $raw_setting, array $group ): array {
        $normalized_options = null;
        if ( ! empty( $raw_setting['options'] ) && is_array( $raw_setting['options'] ) ) {
            $normalized_options = [];
            foreach ( $raw_setting['options'] as $option ) {
                if ( ! is_array( $option ) ) {
                    continue;
                }

                $option_value = $option['value'] ?? ( $option['key'] ?? null );
                if ( $option_value === null ) {
                    continue;
                }

                $normalized_options[ (string) $option_value ] = [
                    'label'         => $option['label'] ?? (string) $option_value,
                    'tier_required' => self::normalize_tier( $option ),
                    'icon'          => $option['icon'] ?? null,
                    'description'   => $option['description'] ?? null,
                ];
            }
        }

        return [
            'key'                      => (string) ( $raw_setting['key'] ?? '' ),
            'label'                    => (string) ( $raw_setting['label'] ?? ( $raw_setting['key'] ?? '' ) ),
            'description'              => $raw_setting['description'] ?? null,
            'control'                  => (string) ( $raw_setting['type'] ?? 'text' ),
            'options'                  => $normalized_options,
            'tier_required'            => self::normalize_tier( $raw_setting ),
            'render_when_unlicensed'   => isset( $raw_setting['render_when_unlicensed'] )
                ? (bool) $raw_setting['render_when_unlicensed']
                : true,
            'setting_lives_in'         => (string) ( $raw_setting['setting_lives_in'] ?? 'free' ),
            'visible_when_uninstalled' => isset( $raw_setting['visible_when_uninstalled'] )
                ? (bool) $raw_setting['visible_when_uninstalled']
                : true,
            'depends_on'               => $raw_setting['depends_on'] ?? null,
            'depends_on_value'         => $raw_setting['depends_on_value'] ?? null,
            'group'                    => (string) ( $group['id'] ?? '' ),
            'teaser_benefit_key'       => $raw_setting['teaser_benefit_key'] ?? null,
            'sanitize'                 => $raw_setting['sanitize'] ?? null,
        ];
    }

    /**
     * Resolves tier requirement with free-flag backwards compatibility.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $source Source setting or option map.
     * @return  string
     */
    private static function normalize_tier( array $source ): string {
        $explicit_tier = $source['tier_required'] ?? null;
        if ( is_string( $explicit_tier ) && $explicit_tier !== '' ) {
            return $explicit_tier;
        }

        if ( array_key_exists( 'free', $source ) ) {
            return ! empty( $source['free'] ) ? 'free' : 'pro_starter';
        }

        return 'free';
    }

    /**
     * Logs catalog warnings in debug mode.
     *
     * @since   1.0.0
     * @param   string $message Warning message.
     * @return  void
     */
    private static function dev_log( string $message ): void {
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( '[FotoGrids Catalog] ' . $message );
        }
    }
}
