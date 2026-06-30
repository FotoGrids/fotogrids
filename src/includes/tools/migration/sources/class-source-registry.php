<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Migration Source Registry
 *
 * Holds the ordered list of migration sources. Order is significant: it is
 * the order the source cards appear in the picker. WordPress core is
 * registered first, then competitor gallery plugins, then slider plugins.
 *
 * @since 1.0.0
 */
class Source_Registry {

	/**
	 * Registered sources, keyed by id, in registration order.
	 *
	 * @var array<string, Source_Interface>
	 */
	private static array $sources = array();

	/**
	 * Register a source. Registration order is preserved.
	 *
	 * @since 1.0.0
	 * @param Source_Interface $source Source instance.
	 * @return void
	 */
	public static function register( Source_Interface $source ): void {
		self::$sources[ $source->get_id() ] = $source;
	}

	/**
	 * All registered sources in registration order.
	 *
	 * @since 1.0.0
	 * @return array<string, Source_Interface>
	 */
	public static function all(): array {
		return self::$sources;
	}

	/**
	 * A single source by id, or null.
	 *
	 * @since 1.0.0
	 * @param string $id Source id.
	 * @return Source_Interface|null
	 */
	public static function get( string $id ): ?Source_Interface {
		return self::$sources[ $id ] ?? null;
	}
}
