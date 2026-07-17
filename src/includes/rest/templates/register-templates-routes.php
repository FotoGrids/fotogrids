<?php
namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Templates REST Routes Registration
 *
 * Handles registration of template-related REST API endpoints.
 *
 * @since 1.0.0
 */
class Register_Templates_Routes {

	/**
	 * Register all template-related REST API routes
	 *
	 * Registers endpoints for template listing.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register() {
		// Load permissions file
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/rest/templates/templates-permissions.php';

		// List templates endpoint
		register_rest_route(
			'fotogrids/v1',
			'/templates',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\REST\Templates\Templates_Data', 'get_templates' ),
					'permission_callback' => array( '\FotoGrids\REST\Templates\Templates_Permissions', 'check_templates_read' ),
					'args'                => array(
						'category' => array(
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'refresh'  => array(
							'default'           => false,
							'sanitize_callback' => 'rest_sanitize_boolean',
						),
					),
				),
			)
		);

		// Apply template endpoint
		register_rest_route(
			'fotogrids/v1',
			'/templates/(?P<id>[a-zA-Z0-9_-]+)/apply',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( '\FotoGrids\REST\Templates\Templates_Data', 'apply_template' ),
					'permission_callback' => array( '\FotoGrids\REST\Templates\Templates_Permissions', 'check_template_apply' ),
					'args'                => array(
						'id'        => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
						),
						'post_id'   => array(
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
						'post_type' => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			)
		);

		// Delete template endpoint
		register_rest_route(
			'fotogrids/v1',
			'/templates/(?P<id>[a-zA-Z0-9_-]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( '\FotoGrids\REST\Templates\Templates_Data', 'delete_template' ),
					'permission_callback' => array( '\FotoGrids\REST\Templates\Templates_Permissions', 'check_template_delete' ),
					'args'                => array(
						'id' => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			)
		);

		// Template preview endpoint (returns HTML)
		// Note: This endpoint can be accessed via iframe, so we allow nonce-based auth
		register_rest_route(
			'fotogrids/v1',
			'/templates/preview',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( '\FotoGrids\REST\Templates\Templates_Data', 'render_template_preview' ),
					'permission_callback' => '__return_true', // We'll check permissions inside the callback
					'args'                => array(
						'template_id'        => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_text_field',
						),
						'category'           => array(
							'default'           => 'gallery',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'preview_background' => array(
							'default'           => 'light',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'preview_bg_color'   => array(
							'default'           => '',
							'sanitize_callback' => array( '\FotoGrids\REST\Templates\Templates_Data', 'sanitize_css_color' ),
						),
						'_wpnonce'           => array(
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			)
		);

		// Add filter to output HTML directly for preview endpoint
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'serve_template_preview_html' ), 10, 4 );
	}

	/**
	 * Serve HTML directly for template preview endpoint
	 *
	 * @param bool $served Whether the request has been served
	 * @param \WP_REST_Response $result Result to send to the client
	 * @param \WP_REST_Request $request Request used to generate the response
	 * @param \WP_REST_Server $server Server instance
	 * @return bool True if served, false otherwise
	 */
	public static function serve_template_preview_html( $served, $result, $request, $server ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		// Only handle our preview endpoint
		if ( $request->get_route() !== '/fotogrids/v1/templates/preview' ) {
			return $served;
		}

		// If it's an error, let WordPress handle it normally
		if ( is_wp_error( $result ) ) {
			return $served;
		}

		$data = $result->get_data();

		// If data is a string (HTML), output it directly
		if ( is_string( $data ) ) {
			// Clean any output buffers to prevent whitespace issues
			while ( ob_get_level() ) {
				ob_end_clean();
			}

			// Set headers
			status_header( 200 );
			nocache_headers();
			header( 'Content-Type: text/html; charset=UTF-8' );

			// $data is a complete standalone HTML document assembled by
			// Templates_Data::render_template_preview() with every dynamic value
			// escaped at construction (esc_html/esc_url/esc_attr). It contains
			// DOCTYPE/<head>/<link>/<style>, so no output escaper can run over it
			// without breaking the page.
			echo $data; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Pre-escaped full HTML document; see note above.
			exit;
		}

		return $served;
	}
}
