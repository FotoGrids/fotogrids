<?php
namespace FotoGrids\Tools;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Tools REST - Manifest Endpoint
 *
 * Registers GET /fotogrids/v1/admin/tools which returns the manifest
 * of all tools the current user can access.
 *
 * Each tool entry includes a pre-computed access_state derived statically
 * from the tool's tier_required with no license check, following the same
 * pattern as the collection-settings catalog:
 *
 *   'editable' - tier is 'free' (fully available in the free plugin)
 *   'teaser'   - feature exists on a higher tier; a static upgrade prompt
 *
 * @since 1.0.0
 */
class Tools_Rest {

	/**
	 * Register REST routes.
	 */
	public static function register_routes(): void {
		register_rest_route(
			'fotogrids/v1',
			'/admin/tools',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_manifest' ),
				'permission_callback' => array( __CLASS__, 'check_permission' ),
			)
		);
	}

	/**
	 * Permission: any user who can access at least one tool.
	 * Individual tool visibility is filtered inside get_manifest().
	 */
	public static function check_permission(): bool {
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Return the tool manifest for the current user.
	 *
	 * @return \WP_REST_Response
	 */
	public static function get_manifest(): \WP_REST_Response {
		$entries  = Tools_Registry::get_all_for_user();
		$manifest = array();

		foreach ( $entries as $id => $entry ) {
			/** @var Tool_Interface $tool */
			$tool   = $entry['tool'];
			$source = $entry['source'];

			$manifest[] = array(
				'id'             => $tool->get_id(),
				'label'          => $tool->get_label(),
				'description'    => $tool->get_description(),
				'icon'           => $tool->get_icon(),
				'image'          => $tool->get_image(),
				'image_bg_color' => $tool->get_image_bg_color(),
				'group'          => $tool->get_group(),
				'source'         => $source,
				'tier_required'  => $tool->get_tier_required(),
				'access_state'   => self::resolve_access_state( $tool->get_tier_required() ),
				'available'      => $tool->is_available(),
				'component'      => $tool->get_js_component(),
			);
		}

		return new \WP_REST_Response( $manifest, 200 );
	}

	/**
	 * Resolve tier_required → access_state (static; no license check).
	 *
	 * Delegates to the shared Access_State resolver so the Tools manifest,
	 * the Modules manifest, and the collection-settings catalog all use the
	 * same vocabulary and the same logic.
	 *
	 * @param string $tier_required
	 * @return string 'editable' | 'teaser'
	 */
	private static function resolve_access_state( string $tier_required ): string {
		return \FotoGrids\Licensing\Access_State::resolve( $tier_required );
	}
}
