<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

use FotoGrids\Catalog\Catalog_REST_Endpoint;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Handles catalog field-state refresh requests.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */
final class Catalog_Field_States_Endpoint {

	/**
	 * Returns catalog field states (derived statically from each field's tier).
	 *
	 * @since   1.0.0
	 * @param   \WP_REST_Request $request Request object.
	 * @return  \WP_REST_Response
	 */
	public static function get_field_states( \WP_REST_Request $request ): \WP_REST_Response { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by the REST callback contract.
		return rest_ensure_response(
			Catalog_REST_Endpoint::build_field_states_payload()
		);
	}
}
