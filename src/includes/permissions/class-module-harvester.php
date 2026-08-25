<?php
/**
 * Harvest permission definitions from the Module registry.
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
 * Walks the Module_Registry and registers a Permission_Definition for every
 * module's `get_capability()`. Same shape as Tool_Harvester, including
 * labelling the row with the module's own name.
 *
 * @since 1.0.0
 */
final class Module_Harvester {

	/**
	 * Run the harvest. Called once from Permission_Registry::boot().
	 */
	public static function harvest(): void {
		if ( ! class_exists( '\FotoGrids\Modules\Module_Registry' ) ) {
			return;
		}

		$modules = \FotoGrids\Modules\Module_Registry::get_all();
		foreach ( $modules as $entry ) {
			$module = $entry['module'] ?? null;
			if ( ! $module || ! is_object( $module ) ) {
				continue;
			}

			$cap = method_exists( $module, 'get_capability' ) ? (string) $module->get_capability() : 'manage_fotogrids';
			if ( '' === $cap || 'manage_fotogrids' === $cap ) {
				continue;
			}

			if ( Permission_Registry::get( $cap ) !== null ) {
				if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log(
						sprintf(
							'FotoGrids Permissions: module "%s" duplicates already-registered capability "%s" - skipping.',
							$module->get_id(),
							$cap
						)
					);
				}
				continue;
			}

			$tier = method_exists( $module, 'get_tier_required' ) ? (string) $module->get_tier_required() : 'free';
			$name = self::module_name( $module );

			$description = method_exists( $module, 'get_description' ) ? (string) $module->get_description() : '';
			if ( '' === $description ) {
				/* translators: %s: module name. */
				$description = sprintf( __( 'Use the features the %s module adds.', 'fotogrids' ), $name );
			}

			Permission_Registry::register(
				new Permission_Definition(
					array(
						'key'                 => $cap,
						'label'               => $name,
						'description'         => $description,
						'group'               => 'modules',
						'panel'               => 'advanced',
						'default_lowest_role' => 'administrator',
						'tier'                => $tier,
					)
				)
			);
		}
	}

	/**
	 * Resolve a module's display name.
	 *
	 * Module_Interface declares `get_name()`; `get_label()` is accepted as a
	 * fallback for third-party modules that follow the Tool_Interface shape.
	 * Falls back to the module id so a matrix row never renders a raw
	 * capability slug.
	 *
	 * @since 1.0.0
	 * @param object $module Registered module instance.
	 * @return string
	 */
	private static function module_name( object $module ): string {
		foreach ( array( 'get_name', 'get_label', 'get_id' ) as $method ) {
			if ( ! method_exists( $module, $method ) ) {
				continue;
			}
			$name = trim( (string) $module->{$method}() );
			if ( '' !== $name ) {
				return $name;
			}
		}
		return __( 'Unnamed', 'fotogrids' );
	}
}
