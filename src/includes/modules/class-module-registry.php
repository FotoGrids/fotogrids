<?php
/**
 * Module registry.
 *
 * @package FotoGrids\Modules
 * @since   1.0.0
 */

namespace FotoGrids\Modules;

use FotoGrids\Hooks\Actions_System;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Static singleton registry for all FotoGrids modules.
 *
 * Modules call Module_Registry::register( new My_Module() ) from the
 * 'fotogrids/modules/register' action. The registry then sorts by source,
 * resolves dependencies in topological order, gates by context, and inits
 * each active module exactly once.
 *
 * Source ('fotogrids' | 'fotogrids-pro' | 'third-party') is derived from the
 * module's PHP namespace - the module never declares it. This prevents a
 * third-party module from spoofing a first-party source.
 *
 * Namespace -> source mapping:
 *   FotoGrids\Modules\*       -> 'fotogrids'
 *   FotoGrids_Pro\Modules\*   -> 'fotogrids-pro'
 *   anything else             -> 'third-party'
 *
 * Init order:
 *   1. fotogrids (built-in Free modules)
 *   2. fotogrids-pro (built-in Pro modules)
 *   3. third-party
 *   Within each group, dependency order is honoured (a module never inits
 *   before a module it depends on), then registration order.
 *
 * Override: registering a module with the same id as an existing one replaces
 * it (last-write-wins). This lets Pro ship an enhanced version of a Free
 * module by registering the same id. Replacements are logged under WP_DEBUG.
 *
 * @since 1.0.0
 */
final class Module_Registry {

	/**
	 * Registered modules, keyed by id.
	 * Each value: [ 'module' => Module_Interface, 'source' => string ].
	 *
	 * @var array<string, array{module: Module_Interface, source: string}>
	 */
	private static array $modules = array();

	/**
	 * Whether boot() has already run, so it cannot run twice.
	 *
	 * @var bool
	 */
	private static bool $booted = false;

	/**
	 * Source priority for sorting.
	 *
	 * @var array<string, int>
	 */
	private const SOURCE_PRIORITY = array(
		'fotogrids'     => 0,
		'fotogrids-pro' => 1,
		'third-party'   => 2,
	);

	/**
	 * Register a module.
	 *
	 * Source is derived from the module's PHP namespace. If a module with the
	 * same id is already registered it is replaced (last-write-wins), allowing
	 * Pro to override a Free module.
	 *
	 * @since 1.0.0
	 * @param Module_Interface $module Module instance to register.
	 * @return void
	 */
	public static function register( Module_Interface $module ): void {
		$id     = $module->get_id();
		$source = self::detect_source( $module );

		if ( isset( self::$modules[ $id ] ) ) {
			\FotoGrids\Debug_Log::write(
				'module_registry',
				sprintf(
					'module "%s" (%s) replaced by %s (%s).',
					$id,
					self::$modules[ $id ]['source'],
					get_class( $module ),
					$source
				)
			);
		}

		self::$modules[ $id ] = array(
			'module' => $module,
			'source' => $source,
		);
	}

	/**
	 * Boot every registered module.
	 *
	 * Fires the registration hook, resolves order and dependencies, gates by
	 * the current request context, and inits each active module once. Safe to
	 * call only once - subsequent calls are no-ops.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;

		/**
		 * Register FotoGrids modules.
		 *
		 * Free registers at priority 10; Pro registers at priority 10 (source
		 * sorting guarantees Free inits first regardless of add order);
		 * third-party plugins should use priority 20 or higher.
		 *
		 * @since 1.0.0
		 */
		do_action( Actions_System::MODULES_REGISTER );

		foreach ( self::resolve_init_order() as $entry ) {
			$module = $entry['module'];

			if ( ! $module->is_active() ) {
				continue;
			}

			// NOTE: we deliberately do NOT gate init() by request context here.
			// init() only *registers* WordPress hooks (rest_api_init,
			// add_meta_boxes, save_post, etc.), and WordPress already fires
			// each of those callbacks only in its proper context. Gating init()
			// by a context snapshot taken at 'init' is unsafe for REST: a REST
			// request does not have REST_REQUEST defined yet at 'init', so it
			// would look like 'frontend' and a module declaring ['admin','rest']
			// would never register its routes (=> rest_no_route). get_contexts()
			// remains declarative metadata used by enqueue_all() and the
			// manifest; modules that need finer gating self-gate inside init().
			if ( ! self::dependencies_active( $module ) ) {
				\FotoGrids\Debug_Log::write(
					'module_registry',
					sprintf(
						'module "%s" skipped - unmet dependencies (%s).',
						$module->get_id(),
						implode( ', ', $module->get_dependencies() )
					)
				);
				continue;
			}

			$module->init();
		}
	}

	/**
	 * Enqueue assets for every registered, active, admin-capable module.
	 *
	 * Hooked to admin_enqueue_scripts from the bootstrap (separate from boot()
	 * so enqueues run on normal admin page loads, not only when boot() fires).
	 * Each module's enqueue_assets() guards itself to the relevant screen, so
	 * this is safe to call unconditionally.
	 *
	 * Only modules that declare the 'admin' context are considered - a
	 * frontend-only or REST-only module never enqueues admin assets.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	public static function enqueue_all( string $hook ): void {
		foreach ( self::$modules as $entry ) {
			$module = $entry['module'];

			if ( ! $module->is_active() ) {
				continue;
			}

			if ( ! in_array( 'admin', $module->get_contexts(), true ) ) {
				continue;
			}

			$module->enqueue_assets( $hook );
		}
	}

	/**
	 * Get all registered modules, source-sorted.
	 *
	 * @since 1.0.0
	 * @return array<string, array{module: Module_Interface, source: string}>
	 */
	public static function get_all(): array {
		$entries = self::sort_by_source();
		$out     = array();
		foreach ( $entries as $entry ) {
			$out[ $entry['module']->get_id() ] = $entry;
		}
		return $out;
	}

	/**
	 * Get a single module entry by id, or null if not registered.
	 *
	 * @since 1.0.0
	 * @param string $id Module id.
	 * @return array{module: Module_Interface, source: string}|null
	 */
	public static function get_by_id( string $id ): ?array {
		return self::$modules[ $id ] ?? null;
	}

	/**
	 * Whether a module id is registered.
	 *
	 * @since 1.0.0
	 * @param string $id Module id.
	 * @return bool
	 */
	public static function has( string $id ): bool {
		return isset( self::$modules[ $id ] );
	}

	/**
	 * Build the manifest for the current user.
	 *
	 * Filtered to modules the user can access (capability), each carrying a
	 * resolved access_state via the shared Access_State resolver - the same
	 * vocabulary the Tools manifest and collection-settings catalog use.
	 *
	 * @since 1.0.0
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_manifest_for_user(): array {
		$manifest = array();

		foreach ( self::get_all() as $entry ) {
			/** @var Module_Interface $module */
			$module     = $entry['module'];
			$capability = $module->get_capability();

			$can_access = current_user_can( $capability )
				|| ( 'manage_fotogrids' !== $capability && current_user_can( 'manage_fotogrids' ) );

			if ( ! $can_access ) {
				continue;
			}

			$manifest[] = array(
				'id'            => $module->get_id(),
				'name'          => $module->get_name(),
				'description'   => $module->get_description(),
				'source'        => $entry['source'],
				'tier_required' => $module->get_tier_required(),
				'access_state'  => \FotoGrids\Licensing\Access_State::resolve( $module->get_tier_required() ),
				'capability'    => $capability,
				'active'        => $module->is_active(),
				'depends_on'    => $module->get_dependencies(),
			);
		}

		return $manifest;
	}

	// -------------------------------------------------------------------------
	// Internals
	// -------------------------------------------------------------------------

	/**
	 * Derive source from the module's PHP namespace.
	 *
	 * @since 1.0.0
	 * @param Module_Interface $module Module instance.
	 * @return string 'fotogrids' | 'fotogrids-pro' | 'third-party'.
	 */
	private static function detect_source( Module_Interface $module ): string {
		$class = get_class( $module );

		if ( str_starts_with( $class, 'FotoGrids\\Modules\\' ) ) {
			return 'fotogrids';
		}

		if ( str_starts_with( $class, 'FotoGrids_Pro\\Modules\\' ) ) {
			return 'fotogrids-pro';
		}

		return 'third-party';
	}

	/**
	 * Whether every dependency of a module is registered and active.
	 *
	 * @since 1.0.0
	 * @param Module_Interface $module Module to check.
	 * @return bool
	 */
	private static function dependencies_active( Module_Interface $module ): bool {
		foreach ( $module->get_dependencies() as $dep_id ) {
			if ( ! isset( self::$modules[ $dep_id ] ) ) {
				return false;
			}
			if ( ! self::$modules[ $dep_id ]['module']->is_active() ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Stable sort by source priority, preserving registration order within a
	 * source group.
	 *
	 * @since 1.0.0
	 * @return array<int, array{module: Module_Interface, source: string}>
	 */
	private static function sort_by_source(): array {
		$priority = self::SOURCE_PRIORITY;

		$indexed = array();
		$i       = 0;
		foreach ( self::$modules as $entry ) {
			$indexed[] = array(
				'entry' => $entry,
				'order' => $i++,
			);
		}

		usort(
			$indexed,
			static function ( $a, $b ) use ( $priority ) {
				$pa = $priority[ $a['entry']['source'] ] ?? 99;
				$pb = $priority[ $b['entry']['source'] ] ?? 99;

				if ( $pa !== $pb ) {
					return $pa - $pb;
				}

				return $a['order'] - $b['order'];
			}
		);

		return array_map( static fn( $item ) => $item['entry'], $indexed );
	}

	/**
	 * Produce the init order: source-sorted, then reordered so every module
	 * appears after its dependencies (topological). Cycles and missing deps
	 * are tolerated - such modules are still emitted (and later filtered by
	 * dependencies_active()), so a bad dependency never silently drops a
	 * whole batch.
	 *
	 * @since 1.0.0
	 * @return array<int, array{module: Module_Interface, source: string}>
	 */
	private static function resolve_init_order(): array {
		$source_sorted = self::sort_by_source();

		// Map id => entry for lookup, preserving source-sorted sequence.
		$by_id = array();
		foreach ( $source_sorted as $entry ) {
			$by_id[ $entry['module']->get_id() ] = $entry;
		}

		$ordered  = array();
		$visited  = array();
		$visiting = array();

		$visit = static function ( string $id ) use ( &$visit, &$ordered, &$visited, &$visiting, $by_id ) {
			if ( isset( $visited[ $id ] ) || isset( $visiting[ $id ] ) ) {
				return; // Already placed or currently in the stack (cycle guard).
			}
			if ( ! isset( $by_id[ $id ] ) ) {
				return; // Unknown dependency - handled by dependencies_active().
			}

			$visiting[ $id ] = true;

			foreach ( $by_id[ $id ]['module']->get_dependencies() as $dep_id ) {
				$visit( $dep_id );
			}

			unset( $visiting[ $id ] );
			$visited[ $id ] = true;
			$ordered[]      = $by_id[ $id ];
		};

		foreach ( $by_id as $id => $entry ) {
			$visit( $id );
		}

		return $ordered;
	}
}
