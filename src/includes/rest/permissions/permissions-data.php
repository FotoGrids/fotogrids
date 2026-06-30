<?php
/**
 * Data handlers for the Permissions REST routes.
 *
 * @package FotoGrids\REST\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\REST\Permissions;

use FotoGrids\Activator;
use FotoGrids\Permissions\Core_Permissions;
use FotoGrids\Permissions\Permission_Options;
use FotoGrids\Permissions\Permission_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Two endpoints today:
 *
 *   GET  /permissions/registry        - definitions + roles + grant snapshot
 *   POST /permissions/simple          - write Panel 1 lowest-role dropdowns
 *
 * Reserved (registered later by Pro, NOT here):
 *
 *   POST /permissions/grants          - per-cap per-grantee writes (Pro)
 *   POST /permissions/grants/scoped   - per-gallery / per-album scoped grants (Pro)
 *   GET/POST /permissions/users/{id}  - per-user grant snapshot + writes (Pro)
 *
 * @since 1.0.0
 */
final class Permissions_Data {

	/**
	 * GET /permissions/registry
	 *
	 * Returns:
	 *   {
	 *     definitions: Permission_Definition[],          // full registry
	 *     simple:      Permission_Definition[],          // Panel 1
	 *     advanced:    Permission_Definition[],          // Panel 2
	 *     roles:       Role[],                           // editable WP roles + their caps
	 *     grantee_types: string[],                       // Free: ['role']; Pro extends.
	 *     has_pro:     bool,
	 *   }
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public static function get_registry( $request ): \WP_REST_Response { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		Permission_Registry::boot();

		/**
		 * Filter: grantee types the UI should expose.
		 *
		 * Free returns ['role']. Pro filters to add 'user' (and later 'token'
		 * for Client Proofing). The matrix component reads this to decide
		 * which dimensions to render.
		 *
		 * @since 1.0.0
		 * @param string[] $types
		 */
		$grantee_types = apply_filters(
			'fotogrids/permissions/grantee_types',
			array( 'role' )
		);

		$definitions = array_map(
			static fn ( $def ) => $def->to_array(),
			Permission_Registry::get_all()
		);
		$simple      = array_map(
			static fn ( $def ) => $def->to_array(),
			Permission_Registry::get_for_panel( 'simple' )
		);
		$advanced    = array_map(
			static fn ( $def ) => $def->to_array(),
			Permission_Registry::get_for_panel( 'advanced' )
		);

		return rest_ensure_response(
			array(
				'definitions'   => array_values( $definitions ),
				'simple'        => array_values( $simple ),
				'advanced'      => array_values( $advanced ),
				'roles'         => self::roles_with_caps(),
				'grantee_types' => array_values( array_unique( array_map( 'strval', (array) $grantee_types ) ) ),
				'has_pro'       => \FotoGrids\License_Manager::has_pro(),
				'options'       => array(
					'unauthorised_visibility' => Permission_Options::get_unauthorised_visibility(),
				),
			)
		);
	}

	/**
	 * POST /permissions/options
	 *
	 * Body: { key: string, value: string }
	 *
	 * Today the only supported key is 'unauthorised_visibility' with a value
	 * of 'readonly' | 'hidden'.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function set_option( $request ) {
		$key   = (string) ( $request['key'] ?? '' );
		$value = (string) ( $request['value'] ?? '' );

		if ( 'unauthorised_visibility' !== $key ) {
			return new \WP_Error(
				'fotogrids_invalid_option',
				__( 'Unknown permissions option.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( ! Permission_Options::set_unauthorised_visibility( $value ) ) {
			return new \WP_Error(
				'fotogrids_invalid_value',
				__( 'Invalid value for this option.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'key'     => $key,
				'value'   => Permission_Options::get_unauthorised_visibility(),
			)
		);
	}

	/**
	 * POST /permissions/simple
	 *
	 * Body: { key: string, lowest_role: string }
	 *
	 * `key` is a logical permission key (panel = 'simple'). `lowest_role` is
	 * one of administrator / editor / author / contributor / subscriber.
	 *
	 * For every atomic cap in the logical permission's underlying_caps:
	 *   - Grant it to lowest_role and every role above.
	 *   - Revoke it from every role below.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function set_simple( $request ) {
		Permission_Registry::boot();

		$key         = (string) ( $request['key'] ?? '' );
		$lowest_role = (string) ( $request['lowest_role'] ?? '' );

		$ladder = array( 'administrator', 'editor', 'author', 'contributor', 'subscriber' );
		if ( ! in_array( $lowest_role, $ladder, true ) ) {
			return new \WP_Error(
				'fotogrids_invalid_role',
				__( 'Invalid role.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$def = Permission_Registry::get( $key );
		if ( ! $def || ! $def->is_logical() ) {
			return new \WP_Error(
				'fotogrids_invalid_permission',
				__( 'Unknown logical permission.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$allowed_roles = Activator::roles_at_or_above( $lowest_role );
		$denied_roles  = array_values( array_diff( $ladder, $allowed_roles ) );

		foreach ( $def->underlying_caps as $cap ) {
			// Never allow revoking core caps from administrators.
			if ( in_array( $cap, array( 'manage_fotogrids', 'manage_fotogrids_permissions' ), true ) ) {
				$allowed_roles = array_unique( array_merge( $allowed_roles, array( 'administrator' ) ) );
				$denied_roles  = array_values( array_diff( $denied_roles, array( 'administrator' ) ) );
			}

			foreach ( $allowed_roles as $role_name ) {
				$role = get_role( $role_name );
				if ( $role ) {
					$role->add_cap( $cap );
				}
			}
			foreach ( $denied_roles as $role_name ) {
				$role = get_role( $role_name );
				if ( $role ) {
					$role->remove_cap( $cap );
				}
			}
		}

		return rest_ensure_response(
			array(
				'success'       => true,
				'key'           => $key,
				'lowest_role'   => $lowest_role,
				'allowed_roles' => array_values( $allowed_roles ),
			)
		);
	}

	/**
	 * Return every editable WP role with its caps and the resolved Panel-1
	 * lowest-role value for each logical permission.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function roles_with_caps(): array {
		$wp_roles = wp_roles();
		$out      = array();

		foreach ( $wp_roles->roles as $role_key => $role_data ) {
			$role = get_role( $role_key );
			if ( ! $role ) {
				continue;
			}
			$out[] = array(
				'key'          => $role_key,
				'name'         => $role_data['name'],
				'capabilities' => self::filter_fotogrids_caps( $role->capabilities ),
			);
		}

		return $out;
	}

	/**
	 * Keep only caps relevant to FotoGrids - everything in the registry plus
	 * the WP edit_posts/upload_files baseline the plugin reads occasionally.
	 *
	 * @param array<string, bool> $caps
	 * @return array<string, bool>
	 */
	private static function filter_fotogrids_caps( array $caps ): array {
		$relevant = array();
		$known    = array_flip( Permission_Registry::get_all_atomic_caps() );
		foreach ( $caps as $cap => $granted ) {
			if ( isset( $known[ $cap ] ) ) {
				$relevant[ $cap ] = (bool) $granted;
			}
		}
		return $relevant;
	}
}
