<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Registry for render modules grouped by category.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Module_Registry {

	/**
	 * @var array<int, string>
	 */
	public const CATEGORIES = array( 'gates', 'sorters', 'decorators', 'layouts', 'features', 'filter_sources', 'sidecars' );

	/**
	 * @var array<string, array<int, class-string>>
	 */
	private static array $registered_modules = array();

	/**
	 * Registers a module class in the requested category.
	 *
	 * @since   1.0.0
	 * @param   string $category Module category.
	 * @param   class-string $module_class Module class name.
	 * @return  void
	 */
	public static function register( string $category, string $module_class ): void {
		if ( ! in_array( $category, self::CATEGORIES, true ) ) {
			throw new \InvalidArgumentException( sprintf( "Unknown category: '%s'", esc_html( $category ) ) );
		}

		self::$registered_modules[ $category ] ??= array();
		self::$registered_modules[ $category ][] = $module_class;
	}

	/**
	 * Returns active modules in precedence order.
	 *
	 * @since   1.0.0
	 * @param   string         $category Module category.
	 * @param   Render_Context $render_context Render context.
	 * @return  array<int, object>
	 */
	public static function active_modules( string $category, Render_Context $render_context ): array {
		if ( ! in_array( $category, self::CATEGORIES, true ) ) {
			throw new \InvalidArgumentException( sprintf( "Unknown category: '%s'", esc_html( $category ) ) );
		}

		$registered_classes   = self::$registered_modules[ $category ] ?? array();
		$instantiated_modules = array();

		foreach ( $registered_classes as $registered_index => $module_class ) {
			$module_instance = new $module_class();
			if ( ! method_exists( $module_instance, 'supports' ) || ! $module_instance->supports( $render_context ) ) {
				continue;
			}

			$instantiated_modules[] = array(
				'index'  => $registered_index,
				'module' => $module_instance,
			);
		}

		usort(
			$instantiated_modules,
			static function ( array $left_module, array $right_module ): int {
				$left_origin_rank  = self::origin_precedence_rank( $left_module['module']->origin() );
				$right_origin_rank = self::origin_precedence_rank( $right_module['module']->origin() );

				if ( $left_origin_rank !== $right_origin_rank ) {
					return $left_origin_rank <=> $right_origin_rank;
				}

				return $left_module['index'] <=> $right_module['index'];
			}
		);

		$replaced_module_ids = array();
		foreach ( $instantiated_modules as $module_row ) {
			$module_instance = $module_row['module'];
			if ( method_exists( $module_instance, 'replaces' ) ) {
				$replaced_module_id = $module_instance->replaces();
				if ( is_string( $replaced_module_id ) && '' !== $replaced_module_id ) {
					$replaced_module_ids[] = $replaced_module_id;
				}
			}
		}

		$active_modules = array();
		foreach ( $instantiated_modules as $module_row ) {
			$module_instance = $module_row['module'];
			if ( in_array( $module_instance->id(), $replaced_module_ids, true ) ) {
				continue;
			}
			$active_modules[] = $module_instance;
		}

		return $active_modules;
	}

	/**
	 * Returns all registered module class names for a category.
	 *
	 * @since   1.0.0
	 * @param   string $category Module category.
	 * @return  array<int, class-string>
	 */
	public static function all_modules( string $category ): array {
		if ( ! in_array( $category, self::CATEGORIES, true ) ) {
			throw new \InvalidArgumentException( sprintf( "Unknown category: '%s'", esc_html( $category ) ) );
		}

		return self::$registered_modules[ $category ] ?? array();
	}

	/**
	 * Resets the registry state for tests.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	public static function reset(): void {
		self::$registered_modules = array();
	}

	/**
	 * Returns numeric precedence rank for an origin slug.
	 *
	 * @since   1.0.0
	 * @param   string $origin Module origin slug.
	 * @return  int
	 */
	private static function origin_precedence_rank( string $origin ): int {
		if ( 'fotogrids' === $origin ) {
			return 0;
		}

		if ( 'fotogrids-pro' === $origin ) {
			return 1;
		}

		return 2;
	}
}
