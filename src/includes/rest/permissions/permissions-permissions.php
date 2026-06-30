<?php
/**
 * Permission callbacks for the Permissions REST routes.
 *
 * @package FotoGrids\REST\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\REST\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Both registry read and Panel-1 (simple) write are gated on
 * `manage_fotogrids_permissions` - a dedicated cap registered by
 * Core_Permissions so admins can later delegate this in Pro without
 * also granting full settings access.
 *
 * @since 1.0.0
 */
final class Permissions_Permissions {

	/**
	 * Read the registry (definitions + roles + current grants).
	 *
	 * @param \WP_REST_Request $request
	 * @return bool
	 */
	public static function check_read( $request ): bool { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return \FotoGrids\Permissions\Permission_Check::can( 'manage_fotogrids_permissions' )
			|| \FotoGrids\Permissions\Permission_Check::can( 'manage_fotogrids' );
	}

	/**
	 * Write Panel-1 (simple) lowest-role dropdowns.
	 *
	 * @param \WP_REST_Request $request
	 * @return bool
	 */
	public static function check_write_simple( $request ): bool { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return \FotoGrids\Permissions\Permission_Check::can( 'manage_fotogrids_permissions' )
			|| \FotoGrids\Permissions\Permission_Check::can( 'manage_fotogrids' );
	}
}
