<?php
/**
 * Permission Registry.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Static registry for FotoGrids permissions.
 *
 * Two read paths:
 *   - get_all()                            All registered definitions.
 *   - get_for_panel( 'simple' | 'advanced' ) Filtered for the matching panel.
 *
 * Registration sources, in this order:
 *   1. Core_Permissions::register()   - hardcoded plugin caps + CPT caps.
 *   2. Auto-harvest from Tools_Registry and Module_Registry.
 *   3. The 'fotogrids/permissions/register' filter - Pro and third-party.
 *
 * Source attribution (`Permission_Definition::$source`) is derived from the
 * caller's PHP namespace, exactly like Tools_Registry and Module_Registry.
 * Same intent: third-party code cannot spoof a first-party source.
 *
 * @since 1.0.0
 */
final class Permission_Registry {

    /**
     * Registered definitions, keyed by permission key.
     *
     * @var array<string, Permission_Definition>
     */
    private static array $definitions = [];

    /**
     * Whether the registry has been booted in this request.
     *
     * @var bool
     */
    private static bool $booted = false;

    /**
     * Source priority for stable sort.
     *
     * @var array<string, int>
     */
    private const SOURCE_PRIORITY = [
        'fotogrids'     => 0,
        'fotogrids-pro' => 1,
        'third-party'   => 2,
    ];

    /**
     * Group sort order. Anything not in the list sorts last, alphabetically.
     *
     * @var array<int, string>
     */
    private const GROUP_ORDER = [
        'gallery',
        'album',
        'media',
        'stats',
        'tools',
        'modules',
        'plugin',
    ];

    /**
     * Register a permission definition.
     *
     * If a definition with the same key is already registered, the new one
     * replaces it. This is the documented way for Pro to override Free
     * defaults (e.g. promote a Pro-tier cap or change a default role).
     *
     * Source is derived from the calling code's namespace via the
     * debug_backtrace, the same way Tools_Registry detects it. Callers do
     * NOT pass source themselves.
     *
     * @param Permission_Definition $definition Permission to register.
     */
    public static function register( Permission_Definition $definition ): void {
        $source = self::detect_source();
        $definition->set_source( $source );

        self::$definitions[ $definition->key ] = $definition;
    }

    /**
     * Boot the registry. Idempotent.
     *
     * Calling this lazily (from REST, from the admin enqueue, from the
     * activator helper) is safe - it short-circuits on subsequent calls.
     *
     * Boot order is intentional:
     *   1. Core static registrations.
     *   2. Harvest from Tools_Registry + Module_Registry.
     *   3. Filter for Pro / third-party.
     *
     * Tools and modules must be registered before this runs - that is why
     * the bootstrap waits for 'init' priority 6 in normal request flow.
     * Activation contexts call the lifecycle helper directly.
     */
    public static function boot(): void {
        if ( self::$booted ) {
            return;
        }
        self::$booted = true;

        Core_Permissions::register();
        Tool_Harvester::harvest();
        Module_Harvester::harvest();

        /**
         * Filter: third-party / Pro permission registration.
         *
         * Pro hooks here to append per-feature caps, override Free defaults,
         * or contribute Pro-tier-only definitions that show up as teasers in
         * the matrix.
         *
         * @since 1.0.0
         * @param Permission_Registry $registry The registry instance (proxied
         *                                      by static methods - pass through
         *                                      and call register() on it).
         */
        do_action( 'fotogrids/permissions/register', new self() );
    }

    /**
     * Force a re-boot. Test helper - production code does not call this.
     *
     * @internal
     */
    public static function reset(): void {
        self::$definitions = [];
        self::$booted      = false;
    }

    /**
     * All registered definitions, sorted.
     *
     * Sort order: group (registry-defined priority, then alphabetical),
     * source (fotogrids < pro < third-party), then registration order.
     *
     * @return Permission_Definition[]
     */
    public static function get_all(): array {
        if ( ! self::$booted ) {
            self::boot();
        }

        $defs = array_values( self::$definitions );

        usort( $defs, static function ( Permission_Definition $a, Permission_Definition $b ): int {
            $group_cmp = self::compare_groups( $a->group, $b->group );
            if ( $group_cmp !== 0 ) {
                return $group_cmp;
            }
            $a_prio = self::SOURCE_PRIORITY[ $a->source ] ?? 99;
            $b_prio = self::SOURCE_PRIORITY[ $b->source ] ?? 99;
            if ( $a_prio !== $b_prio ) {
                return $a_prio - $b_prio;
            }
            return strcmp( $a->key, $b->key );
        } );

        return $defs;
    }

    /**
     * Definitions filtered to a panel: 'simple' shows logical caps for
     * Panel 1, 'advanced' shows everything that should appear in the matrix.
     *
     * @param string $panel 'simple' | 'advanced'.
     * @return Permission_Definition[]
     */
    public static function get_for_panel( string $panel ): array {
        return array_values( array_filter( self::get_all(), static function ( Permission_Definition $def ) use ( $panel ): bool {
            if ( $panel === 'simple' ) {
                return $def->panel === 'simple' || $def->panel === 'both';
            }
            if ( $panel === 'advanced' ) {
                return $def->panel === 'advanced' || $def->panel === 'both';
            }
            return false;
        } ) );
    }

    /**
     * Lookup a single definition by key. Returns null if not registered.
     */
    public static function get( string $key ): ?Permission_Definition {
        if ( ! self::$booted ) {
            self::boot();
        }
        return self::$definitions[ $key ] ?? null;
    }

    /**
     * Classify a payload key as 'content' or 'settings'.
     *
     * The rule is global, not per-key: anything saved through the per-item
     * editor + the post title is content. Everything else (Collection
     * Settings metabox, Templates metabox, layout, lightbox, SEO, etc.) is
     * settings. New settings keys are automatically classified as 'settings'
     * - only the content allow-list needs to stay short and explicit.
     *
     * Pro and 3rd-party plugins can override the verdict via the
     * 'fotogrids/permissions/classify_key' filter (for example, to declare a
     * new item-level field as content rather than letting it fall through to
     * settings).
     *
     * @since 1.0.0
     * @param string $key       Payload key (e.g. 'layout', 'post_title', 'items').
     * @param string $post_type 'fotogrids_gallery' | 'fotogrids_album'.
     * @return string 'content' | 'settings'.
     */
    public static function classify_key( string $key, string $post_type = '' ): string {
        // Item-side keys + post-level fields that belong to content. Everything
        // else (Catalog fields, template choice, custom CSS/JS, SEO, etc.)
        // counts as settings.
        static $content_keys = [
            'post_title',
            'post_status',
            'post_excerpt',
            'featured_item_id',
            'items',
            'item_order',
            'item_ids',
            // Per-item fields - written through the Items REST or the
            // per-item editor inside the metabox.
            'caption',
            'description',
            'credit',
            'alt',
            'external_url',
            'link_target',
            'location',
            'tags',
            'people',
            'locations',
        ];

        $classification = in_array( $key, $content_keys, true ) ? 'content' : 'settings';

        /**
         * Filter: classify a payload key as 'content' or 'settings'.
         *
         * Lets Pro and 3rd parties move keys between buckets. Return value
         * must be 'content' or 'settings'; anything else is ignored.
         *
         * @since 1.0.0
         * @param string $classification Default decision.
         * @param string $key            Payload key.
         * @param string $post_type      CPT slug.
         */
        $filtered = apply_filters(
            'fotogrids/permissions/classify_key',
            $classification,
            $key,
            $post_type
        );

        return in_array( $filtered, [ 'content', 'settings' ], true )
            ? $filtered
            : $classification;
    }

    /**
     * All distinct atomic caps known to the registry, in stable order.
     *
     * Used by the activator to grant default capabilities to roles. Logical
     * permissions are expanded via their underlying_caps.
     *
     * @return string[]
     */
    public static function get_all_atomic_caps(): array {
        $caps = [];
        foreach ( self::get_all() as $def ) {
            if ( $def->is_logical() ) {
                foreach ( $def->underlying_caps as $cap ) {
                    $caps[ $cap ] = true;
                }
            } else {
                $caps[ $def->key ] = true;
            }
        }
        return array_keys( $caps );
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * Compare two group slugs for stable section ordering.
     */
    private static function compare_groups( string $a, string $b ): int {
        $a_idx = array_search( $a, self::GROUP_ORDER, true );
        $b_idx = array_search( $b, self::GROUP_ORDER, true );

        if ( $a_idx === false && $b_idx === false ) {
            return strcmp( $a, $b );
        }
        if ( $a_idx === false ) {
            return 1;
        }
        if ( $b_idx === false ) {
            return -1;
        }
        return $a_idx - $b_idx;
    }

    /**
     * Detect the source of the caller by walking debug_backtrace and looking
     * at the first frame outside this class.
     */
    private static function detect_source(): string {
        // Intentional caller introspection (not debug output): inspects the call
        // stack to attribute a permission check to its originating subsystem.
        // DEBUG_BACKTRACE_IGNORE_ARGS + depth limit keep it cheap.
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_debug_backtrace
        $trace = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 6 );
        foreach ( $trace as $frame ) {
            if ( empty( $frame['class'] ) ) {
                continue;
            }
            if ( $frame['class'] === self::class ) {
                continue;
            }
            $class = $frame['class'];

            if ( str_starts_with( $class, 'FotoGrids\\Permissions\\' ) ) {
                // Core bootstrap and harvesters live in this namespace - count
                // them as first-party.
                return 'fotogrids';
            }
            if ( str_starts_with( $class, 'FotoGrids\\' ) ) {
                return 'fotogrids';
            }
            if ( str_starts_with( $class, 'FotoGrids_Pro\\' ) ) {
                return 'fotogrids-pro';
            }
            return 'third-party';
        }
        return 'third-party';
    }
}
