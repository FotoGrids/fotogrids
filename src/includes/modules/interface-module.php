<?php
/**
 * Module interface.
 *
 * @package FotoGrids\Modules
 * @since   1.0.0
 */

namespace FotoGrids\Modules;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Module contract.
 *
 * A module is a self-contained, independently-togglable capability bundle -
 * a vertical slice of the product that owns its own backend wiring (hooks,
 * REST routes, cron), declares who may use it (tier + capability + context),
 * and exposes its own internal extension points so other modules (especially
 * Pro) can extend it without replacing it.
 *
 * Source ('fotogrids' | 'fotogrids-pro' | 'third-party') is NOT declared by
 * the module - the registry derives it from the class namespace so it cannot
 * be spoofed. This mirrors how Tools_Registry handles tool source.
 *
 * @since 1.0.0
 */
interface Module_Interface {

    /**
     * Unique module identifier.
     *
     * Used for dedup (last-write-wins override), dependency resolution, and
     * the module manifest.
     *
     * @since 1.0.0
     * @return string e.g. 'templates', 'library', 'statistics'.
     */
    public function get_id(): string;

    /**
     * Human-readable module name for the manifest / admin UI.
     *
     * @since 1.0.0
     * @return string
     */
    public function get_name(): string;

    /**
     * One-line description for the manifest.
     *
     * @since 1.0.0
     * @return string
     */
    public function get_description(): string;

    /**
     * Minimum tier required for this module's headline gated capability.
     *
     * One of: 'free' | 'pro_starter' | 'pro_plus' | 'agency'. The registry
     * resolves this to an access_state ('editable' / 'teaser' / 'locked') for
     * the manifest. A module may be tier 'free' (always runs) and still gate
     * individual actions internally - this is the headline gate, not the only
     * gate.
     *
     * @since 1.0.0
     * @return string
     */
    public function get_tier_required(): string;

    /**
     * WordPress capability a user needs for this module's admin surface.
     *
     * Default 'manage_fotogrids'. Custom caps (e.g. 'manage_fotogrids_backups')
     * let the Permissions module expose per-module access control by reading
     * each module's declared capability.
     *
     * @since 1.0.0
     * @return string
     */
    public function get_capability(): string;

    /**
     * Contexts this module should initialise in.
     *
     * Any of: 'admin' | 'frontend' | 'rest' | 'cli'. The registry skips init()
     * in contexts the module does not declare - e.g. a metabox module never
     * boots on a frontend page render.
     *
     * @since 1.0.0
     * @return string[]
     */
    public function get_contexts(): array;

    /**
     * Sibling module IDs that must be registered and active before this one
     * initialises. The registry inits in topological dependency order.
     *
     * @since 1.0.0
     * @return string[]
     */
    public function get_dependencies(): array;

    /**
     * Whether the module should run at all (env / feature-flag level gate).
     *
     * @since 1.0.0
     * @return bool
     */
    public function is_active(): bool;

    /**
     * Enqueue this module's admin scripts and styles.
     *
     * Called on admin_enqueue_scripts for EVERY module (via
     * Module_Registry::enqueue_all), so the module is responsible for its own
     * page guard - unlike Tools, modules surface on varied screens (a metabox
     * on post.php, a settings page, a CPT-edit screen), so there is no single
     * shared guard the registry could apply. A typical implementation checks
     * $hook / the current screen, then enqueues whatever get_script_url() and
     * get_style_url() return.
     *
     * Built-in module assets are co-located under
     * includes/modules/<Name>/assets/ and built there by the module-* webpack
     * entries, mirroring how Tools co-locate their assets.
     *
     * @since 1.0.0
     * @param string $hook Current admin page hook suffix.
     * @return void
     */
    public function enqueue_assets( string $hook ): void;

    /**
     * Initialise the module: register hooks, REST routes, cron, assets.
     *
     * Called once, in dependency and source order, only in declared contexts.
     * Modules that own REST routes should add their own rest_api_init callback
     * here rather than calling register_rest_route() directly, so boot timing
     * is decoupled from REST timing.
     *
     * @since 1.0.0
     * @return void
     */
    public function init(): void;
}
