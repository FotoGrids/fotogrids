<?php
namespace FotoGrids\Tools;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Tools Registry
 *
 * Singleton registry for all FotoGrids tools. Tools call
 * Tools_Registry::register( new My_Tool() ) from the
 * 'fotogrids/tools/init' action.
 *
 * Source (fotogrids / fotogrids-pro / third-party) is derived
 * automatically from the tool's PHP namespace — the tool itself
 * never declares it. This prevents third-party tools from spoofing
 * a first-party source.
 *
 * Namespace → source mapping:
 *   FotoGrids\Tools\*       → 'fotogrids'
 *   FotoGrids_Pro\Tools\*   → 'fotogrids-pro'
 *   anything else           → 'third-party'
 *
 * Sort order within the manifest:
 *   1. fotogrids (built-in Free tools)
 *   2. fotogrids-pro (built-in Pro tools)
 *   3. third-party (plugins, extensions)
 *   Within each group, registration order is preserved.
 *
 * Pro override: registering a tool with the same id as an existing
 * tool replaces it. This lets Pro ship an enhanced version of a
 * Free tool without forking.
 *
 * @since 1.0.0
 */
class Tools_Registry {

	/**
	 * Registered tools, keyed by id.
	 * Each value: [ 'tool' => Tool_Interface, 'source' => string ]
	 *
	 * @var array<string, array{tool: Tool_Interface, source: string}>
	 */
	private static array $tools = [];

	/**
	 * Whether the sorted manifest is current.
	 *
	 * @var bool
	 */
	private static bool $sorted = false;

	/**
	 * Source priority for sorting.
	 *
	 * @var array<string, int>
	 */
	private const SOURCE_PRIORITY = [
		'fotogrids'     => 0,
		'fotogrids-pro' => 1,
		'third-party'   => 2,
	];

	/**
	 * Register a tool.
	 *
	 * The tool's source is derived from its PHP namespace — it cannot
	 * be declared by the tool itself. If a tool with the same id is
	 * already registered, it is replaced (allows Pro to override Free).
	 *
	 * @param Tool_Interface $tool Tool instance to register.
	 */
	public static function register( Tool_Interface $tool ): void {
		$id     = $tool->get_id();
		$source = self::detect_source( $tool );

		if ( isset( self::$tools[ $id ] ) ) {
			// Intentional replacement — log in debug mode only.
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				error_log( sprintf(
					'FotoGrids Tools: tool "%s" (%s) replaced by %s (%s).',
					$id,
					self::$tools[ $id ]['source'],
					get_class( $tool ),
					$source
				) );
			}
		}

		self::$tools[ $id ] = [
			'tool'   => $tool,
			'source' => $source,
		];

		self::$sorted = false;
	}

	/**
	 * Get all registered tools, sorted by source priority then
	 * registration order, filtered to only those the current user
	 * can access (capability check).
	 *
	 * @return array<string, array{tool: Tool_Interface, source: string}>
	 */
	public static function get_all_for_user(): array {
		$tools = self::get_all();

		return array_filter( $tools, static function ( $entry ) {
			$capability = $entry['tool']->get_capability();

			// If the custom capability isn't assigned to any role yet (e.g. before
			// the Permissions Manager has run), fall back to manage_fotogrids so
			// tools remain accessible to admins during development and before
			// per-tool capabilities are explicitly granted.
			if ( current_user_can( $capability ) ) {
				return true;
			}

			if ( $capability !== 'manage_fotogrids' && current_user_can( 'manage_fotogrids' ) ) {
				return true;
			}

			return false;
		} );
	}

	/**
	 * Get all registered tools, sorted, regardless of current user.
	 *
	 * @return array<string, array{tool: Tool_Interface, source: string}>
	 */
	public static function get_all(): array {
		if ( ! self::$sorted ) {
			self::sort_tools();
		}

		return self::$tools;
	}

	/**
	 * Get a single tool entry by id, or null if not found.
	 *
	 * @param string $id Tool id.
	 * @return array{tool: Tool_Interface, source: string}|null
	 */
	public static function get_by_id( string $id ): ?array {
		return self::$tools[ $id ] ?? null;
	}

	/**
	 * Initialise all registered tools (call init() on each).
	 *
	 * Hooked to rest_api_init so tools can safely call register_rest_route().
	 * Does NOT handle asset enqueueing — see enqueue_all().
	 */
	public static function init_all(): void {
		foreach ( self::$tools as $entry ) {
			$entry['tool']->init();
		}
	}

	/**
	 * Enqueue assets for all registered tools.
	 *
	 * Hooked to admin_enqueue_scripts from the bootstrap (separate from
	 * init_all so enqueues work on regular admin page loads, not only
	 * during REST requests where rest_api_init fires).
	 *
	 * Each tool's enqueue_assets() guards itself to the Tools page and
	 * the active ?tool= param, so this is safe to call unconditionally.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public static function enqueue_all( string $hook ): void {
		foreach ( self::$tools as $entry ) {
			$entry['tool']->enqueue_assets( $hook );
		}
	}

	// -------------------------------------------------------------------------
	// Internals
	// -------------------------------------------------------------------------

	/**
	 * Derive source from the tool's PHP namespace.
	 *
	 * @param Tool_Interface $tool
	 * @return string 'fotogrids' | 'fotogrids-pro' | 'third-party'
	 */
	private static function detect_source( Tool_Interface $tool ): string {
		$class = get_class( $tool );

		if ( str_starts_with( $class, 'FotoGrids\\Tools\\' ) ) {
			return 'fotogrids';
		}

		if ( str_starts_with( $class, 'FotoGrids_Pro\\Tools\\' ) ) {
			return 'fotogrids-pro';
		}

		return 'third-party';
	}

	/**
	 * Stable sort: by source priority, preserving registration order
	 * within each source group.
	 */
	private static function sort_tools(): void {
		$priority = self::SOURCE_PRIORITY;

		// PHP's uasort is not guaranteed stable before 8.0; we implement
		// a stable sort by tagging each entry with its insertion index.
		$indexed = [];
		$i       = 0;
		foreach ( self::$tools as $id => $entry ) {
			$indexed[] = [ 'id' => $id, 'entry' => $entry, 'order' => $i++ ];
		}

		usort( $indexed, static function ( $a, $b ) use ( $priority ) {
			$pa = $priority[ $a['entry']['source'] ] ?? 99;
			$pb = $priority[ $b['entry']['source'] ] ?? 99;

			if ( $pa !== $pb ) {
				return $pa - $pb;
			}

			return $a['order'] - $b['order'];
		} );

		$sorted = [];
		foreach ( $indexed as $item ) {
			$sorted[ $item['id'] ] = $item['entry'];
		}

		self::$tools  = $sorted;
		self::$sorted = true;
	}
}
