<?php
namespace FotoGrids\REST\Templates;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Templates Data Handler
 *
 * Handles template data for REST API endpoints.
 *
 * @since 1.0.0
 */
class Templates_Data {

	/**
	 * Load pre-defined templates from JSON files
	 *
	 * Scans the templates directory and loads all JSON template files
	 *
	 * @since 1.0.0
	 * @param string $category Optional category filter ('gallery' or 'album')
	 * @param bool $include_pro Whether to include Pro templates
	 * @return array Array of template data
	 */
	private static function load_predefined_templates( $category = null, $include_pro = true ) {
		$templates_dir = rtrim( FOTOGRIDS_PLUGIN_DIR, '/' ) . '/includes/rest/templates/templates/';
		$templates     = array();
		$is_pro        = \FotoGrids\License_Manager::has_pro();

		$categories = array( 'gallery', 'album' );
		foreach ( $categories as $cat ) {
			if ( $category && $category !== $cat ) {
				continue;
			}

			$cat_dir = $templates_dir . $cat . '/';
			if ( ! is_dir( $cat_dir ) ) {
				continue;
			}

			$json_files = glob( $cat_dir . '*.json' );
			if ( ! $json_files || empty( $json_files ) ) {
				continue;
			}

			foreach ( $json_files as $json_file ) {
				if ( ! file_exists( $json_file ) ) {
					continue;
				}

				$content = file_get_contents( $json_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
				if ( ! $content ) {
					continue;
				}

				$template = json_decode( $content, true );
				if ( ! $template || json_last_error() !== JSON_ERROR_NONE ) {
					continue;
				}

				$template['isUserTemplate'] = false;
				$template['category']       = $cat;

				if ( isset( $template['type'] ) && 'pro' === $template['type'] ) {
					if ( ! $include_pro || ! $is_pro ) {
						$templates[] = $template;
					} else {
						$templates[] = $template;
					}
				} else {
					$templates[] = $template;
				}
			}
		}

		return $templates;
	}

	/**
	 * Get available templates
	 *
	 * Returns a list of all available gallery templates, including both free
	 * and premium templates. Template availability depends on license status.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Array of available templates with metadata
	 */
	public static function get_templates( $request ) {
		$category = $request->get_param( 'category' ); // 'gallery' or 'album'
		$is_pro   = \FotoGrids\License_Manager::has_pro();

		$predefined_templates = self::load_predefined_templates( $category, true );
		$user_templates       = self::get_user_templates();
		$templates            = array_merge( $predefined_templates, $user_templates );

		if ( $category ) {
			$templates = array_filter(
				$templates,
				function ( $template ) use ( $category ) {
					return isset( $template['category'] ) && $template['category'] === $category;
				}
			);
		}

		// Pre-defined templates first, then user templates; ties broken by name.
		usort(
			$templates,
			function ( $a, $b ) {
				$a_is_predefined = isset( $a['isUserTemplate'] ) && ! $a['isUserTemplate'];
				$b_is_predefined = isset( $b['isUserTemplate'] ) && ! $b['isUserTemplate'];

				if ( $a_is_predefined && ! $b_is_predefined ) {
					return -1;
				}
				if ( ! $a_is_predefined && $b_is_predefined ) {
					return 1;
				}

				$a_order = isset( $a['order'] ) ? (int) $a['order'] : 999;
				$b_order = isset( $b['order'] ) ? (int) $b['order'] : 999;

				if ( $a_order === $b_order ) {
					$a_name = isset( $a['name'] ) ? $a['name'] : '';
					$b_name = isset( $b['name'] ) ? $b['name'] : '';
					return strcmp( $a_name, $b_name );
				}

				return $a_order - $b_order;
			}
		);

		$templates = array_values( $templates );

		return rest_ensure_response( array( 'templates' => $templates ) );
	}

	/**
	 * Save user template
	 *
	 * Saves a user-created template to the database
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Success or error response
	 */
	public static function save_user_template( $request ) {
		$template = $request->get_json_params();

		if ( ! $template || ! isset( $template['name'] ) || ! isset( $template['settings'] ) ) {
			return new \WP_Error( 'invalid_template', __( 'Invalid template data.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		if ( ! isset( $template['id'] ) ) {
			$template['id'] = 'user-' . time() . '-' . wp_generate_password( 6, false );
		}

		$template['isUserTemplate'] = true;
		if ( ! isset( $template['type'] ) ) {
			$template['type'] = 'user';
		}
		if ( ! isset( $template['category'] ) ) {
			$template['category'] = 'gallery';
		}

		$user_templates = get_user_meta( get_current_user_id(), 'fotogrids_user_templates', true );
		$user_templates = $user_templates ? json_decode( $user_templates, true ) : array();

		$found = false;
		foreach ( $user_templates as $key => $existing_template ) {
			if ( isset( $existing_template['id'] ) && $existing_template['id'] === $template['id'] ) {
				$user_templates[ $key ] = $template;
				$found                  = true;
				break;
			}
		}

		if ( ! $found ) {
			$user_templates[] = $template;
		}

		update_user_meta( get_current_user_id(), 'fotogrids_user_templates', wp_json_encode( $user_templates ) );

		return rest_ensure_response(
			array(
				'success'  => true,
				'message'  => __( 'Template saved successfully.', 'fotogrids' ),
				'template' => $template,
			)
		);
	}

	/**
	 * Download template from FotoGrids server
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Template data or error
	 */
	public static function download_template( $request ) {
		$template_id = $request->get_param( 'id' );
		$is_pro      = \FotoGrids\License_Manager::has_pro();

		if ( ! $template_id ) {
			return new \WP_Error( 'missing_template_id', __( 'Template ID is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		if ( ! $is_pro ) {
			return new \WP_Error( 'pro_required', __( 'Pro license required to download this template.', 'fotogrids' ), array( 'status' => 403 ) );
		}

		// TODO: Implement actual download from FotoGrids server (API call with license verification).
		return rest_ensure_response(
			array(
				'success'  => true,
				'message'  => __( 'Template downloaded successfully.', 'fotogrids' ),
				'template' => array(
					'id'   => $template_id,
					'name' => __( 'Downloaded Template', 'fotogrids' ),
					'type' => 'pro',
				),
			)
		);
	}

	/**
	 * Apply template to gallery or album
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Success or error
	 */
	public static function apply_template( $request ) {
		$template_id = $request->get_param( 'id' );
		$post_id     = $request->get_param( 'post_id' );
		$post_type   = $request->get_param( 'post_type' );

		if ( ! $template_id || ! $post_id || ! $post_type ) {
			return new \WP_Error( 'missing_params', __( 'Template ID, post ID, and post type are required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_Error( 'invalid_post', __( 'Invalid post.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		// Request may send 'gallery'/'album'; WordPress uses 'fotogrids_gallery'/'fotogrids_album'
		$post_type_map      = array(
			'gallery' => 'fotogrids_gallery',
			'album'   => 'fotogrids_album',
		);
		$expected_post_type = isset( $post_type_map[ $post_type ] ) ? $post_type_map[ $post_type ] : $post_type;
		if ( $post->post_type !== $expected_post_type ) {
			return new \WP_Error( 'invalid_post', __( 'Invalid post.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$template = self::get_template_by_id( $template_id, $post_type );

		if ( ! $template ) {
			return new \WP_Error( 'template_not_found', __( 'Template not found.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		if ( isset( $template['type'] ) && 'free' !== $template['type'] && ! \FotoGrids\License_Manager::has_pro() ) {
			return new \WP_Error( 'pro_required', __( 'Pro license required for this template.', 'fotogrids' ), array( 'status' => 403 ) );
		}

		// Applying a template is a bulk write of every setting on the target
		// post - gated on the per-CPT settings cap.
		$settings_cap = \FotoGrids\Permissions\Permission_Gate::settings_cap_for( $expected_post_type );
		if ( null !== $settings_cap && ! \FotoGrids\Permissions\Permission_Check::can( $settings_cap, $post_id ) ) {
			return new \WP_Error(
				'fotogrids_forbidden_settings',
				__( 'You do not have permission to change settings on this post.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		if ( isset( $template['settings'] ) && is_array( $template['settings'] ) ) {
			foreach ( $template['settings'] as $key => $value ) {
				update_post_meta( $post_id, 'fotogrids_' . $key, $value );
			}
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => __( 'Template applied successfully.', 'fotogrids' ),
			)
		);
	}

	/**
	 * Save current settings as template
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Success or error
	 */
	public static function save_template( $request ) {
		$post_id     = $request->get_param( 'post_id' );
		$post_type   = $request->get_param( 'post_type' );
		$name        = sanitize_text_field( $request->get_param( 'name' ) );
		$description = sanitize_textarea_field( $request->get_param( 'description' ) );

		if ( ! $name ) {
			return new \WP_Error( 'missing_name', __( 'Template name is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		if ( ! $post_id || ! $post_type ) {
			return new \WP_Error( 'missing_params', __( 'Post ID and post type are required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_Error( 'invalid_post', __( 'Invalid post.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$post_type_map      = array(
			'gallery' => 'fotogrids_gallery',
			'album'   => 'fotogrids_album',
		);
		$expected_post_type = isset( $post_type_map[ $post_type ] ) ? $post_type_map[ $post_type ] : $post_type;
		if ( $post->post_type !== $expected_post_type ) {
			return new \WP_Error( 'invalid_post', __( 'Invalid post.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$settings  = array();
		$meta_keys = get_post_meta( $post_id );

		foreach ( $meta_keys as $key => $values ) {
			if ( strpos( $key, 'fotogrids_' ) === 0 ) {
				$setting_key              = str_replace( 'fotogrids_', '', $key );
				$value                    = maybe_unserialize( $values[0] );
				$settings[ $setting_key ] = $value;
			}
		}

		$template = array(
			'id'             => 'user_' . time() . '_' . wp_generate_password( 8, false ),
			'name'           => $name,
			'description'    => $description,
			'type'           => 'user',
			'category'       => 'fotogrids_gallery' === $post_type ? 'gallery' : 'album',
			'settings'       => $settings,
			'isUserTemplate' => true,
			'created'        => current_time( 'mysql' ),
			'createdBy'      => get_current_user_id(),
		);

		$user_templates   = get_user_meta( get_current_user_id(), 'fotogrids_user_templates', true );
		$user_templates   = $user_templates ? json_decode( $user_templates, true ) : array();
		$user_templates[] = $template;
		update_user_meta( get_current_user_id(), 'fotogrids_user_templates', wp_json_encode( $user_templates ) );

		return rest_ensure_response(
			array(
				'success'  => true,
				'message'  => __( 'Template saved successfully.', 'fotogrids' ),
				'template' => $template,
			)
		);
	}

	/**
	 * Delete user template
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response Success or error
	 */
	public static function delete_template( $request ) {
		$template_id = $request->get_param( 'id' );

		if ( ! $template_id ) {
			return new \WP_Error( 'missing_template_id', __( 'Template ID is required.', 'fotogrids' ), array( 'status' => 400 ) );
		}

		$user_templates = get_user_meta( get_current_user_id(), 'fotogrids_user_templates', true );
		$user_templates = $user_templates ? json_decode( $user_templates, true ) : array();

		$found          = false;
		$user_templates = array_filter(
			$user_templates,
			function ( $template ) use ( $template_id, &$found ) {
				if ( isset( $template['id'] ) && $template['id'] === $template_id ) {
					$found = true;
					return false;
				}
				return true;
			}
		);

		if ( ! $found ) {
			return new \WP_Error( 'template_not_found', __( 'Template not found.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		update_user_meta( get_current_user_id(), 'fotogrids_user_templates', wp_json_encode( array_values( $user_templates ) ) );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => __( 'Template deleted successfully.', 'fotogrids' ),
			)
		);
	}

	/**
	 * Get user templates
	 *
	 * @return array User templates
	 */
	private static function get_user_templates() {
		$user_templates = get_user_meta( get_current_user_id(), 'fotogrids_user_templates', true );
		return $user_templates ? json_decode( $user_templates, true ) : array();
	}

	/**
	 * Render template preview HTML
	 *
	 * Returns full HTML page for iframe preview with template settings applied
	 *
	 * @param \WP_REST_Request $request The REST API request object
	 * @return \WP_REST_Response HTML response
	 */
	public static function render_template_preview( $request ) {
		$nonce = $request->get_param( '_wpnonce' );
		if ( $nonce ) {
			if ( ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
				return new \WP_Error( 'rest_forbidden', __( 'Invalid nonce.', 'fotogrids' ), array( 'status' => 403 ) );
			}
		} elseif ( ! current_user_can( 'edit_posts' ) ) {
			return new \WP_Error( 'rest_forbidden', __( 'Sorry, you are not allowed to do that.', 'fotogrids' ), array( 'status' => 403 ) );
		}

		$template_id = $request->get_param( 'template_id' );
		$category    = $request->get_param( 'category' ) ?: 'gallery';

		$template = self::get_template_by_id( $template_id, $category );
		if ( ! $template || ! is_array( $template ) ) {
			return new \WP_Error( 'template_not_found', __( 'Template not found.', 'fotogrids' ), array( 'status' => 404 ) );
		}

		$template_name = isset( $template['name'] ) ? $template['name'] : __( 'Template Preview', 'fotogrids' );

		$is_pro_template = isset( $template['type'] ) && 'pro' === $template['type'];
		$has_pro_license = \FotoGrids\License_Manager::has_pro();

		// Unlicensed Pro templates fall back to the limited preview_settings.
		if ( $is_pro_template && ! $has_pro_license && isset( $template['preview_settings'] ) && is_array( $template['preview_settings'] ) ) {
			$settings = $template['preview_settings'];
		} else {
			$settings = isset( $template['settings'] ) && is_array( $template['settings'] )
				? $template['settings']
				: array();
		}

		$defaults       = \FotoGrids\Collection_Defaults::resolve_gallery();
		$final_settings = array_merge( $defaults, $settings );

		// Layout falls back to the template ID when settings omit it.
		$layout = isset( $settings['layout'] ) ? $settings['layout'] : $template_id;
		if ( ! in_array( $layout, array( 'grid', 'masonry', 'justified', 'slider', 'carousel', 'video' ), true ) ) {
			$layout = 'grid';
		}

		$columns = isset( $settings['columns'] ) ? $settings['columns'] : array(
			'desktop' => 3,
			'tablet'  => 2,
			'mobile'  => 1,
		);
		if ( ! is_array( $columns ) ) {
			$columns = array(
				'desktop' => absint( $columns ),
				'tablet'  => absint( $columns ),
				'mobile'  => absint( $columns ),
			);
		}

		$preview_items = self::get_template_preview_items();

		if ( ! class_exists( '\FotoGrids\Public_Render' ) ) {
			require_once FOTOGRIDS_PLUGIN_DIR . 'public/class-public-render.php';
		}

		$spacing = isset( $final_settings['item_spacing'] ) && is_array( $final_settings['item_spacing'] )
			? $final_settings['item_spacing']
			: array(
				'desktop' => 10,
				'tablet'  => 8,
				'mobile'  => 5,
			);

		$gallery_html = \FotoGrids\Public_Render::render_template_preview(
			$preview_items,
			$layout,
			$columns,
			$spacing,
			$final_settings,
			array(
				'lazy'     => 'false',
				'lightbox' => 'false',
				'captions' => 'true',
			)
		);

		if ( empty( $gallery_html ) ) {
			$gallery_html = '<div class="fotogrids-error">' . __( 'Failed to generate gallery preview.', 'fotogrids' ) . '</div>';
		}

		// TEMPORARY DIAGNOSTIC - remove before release.
		// Hit the preview URL with &fg_debug=1 (requires WP_DEBUG) to dump what
		// the render pipeline collected vs. what the standalone HTML page links.
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && $request->get_param( 'fg_debug' ) ) {
			$css_urls = array();
			$js_data  = array();
			if ( class_exists( '\FotoGrids\Render\Internal\Asset_Resolver' ) ) {
				$resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
				$css_urls = $resolver->get_css_asset_urls();
				$js_data  = $resolver->get_js_asset_data();
			}
			$diag     = array(
				'template_id'         => $template_id,
				'resolved_layout'     => $layout,
				'settings_layout'     => $settings['layout'] ?? '(none)',
				'final_columns'       => $columns,
				'collected_css_urls'  => $css_urls,
				'collected_js_data'   => $js_data,
				'legacy_css_checked'  => $template_css_url,
				'legacy_css_exists'   => $template_css_exists,
				'gallery_html_length' => strlen( $gallery_html ),
				'gallery_html_head'   => substr( $gallery_html, 0, 600 ),
			);
			$response = new \WP_REST_Response( $diag );
			$response->set_status( 200 );
			return $response;
		}

		$frontend_css_url        = FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css';
		$template_css_url        = FOTOGRIDS_PLUGIN_DIR . 'public/assets/templates/' . $layout . '.css';
		$template_css_exists     = file_exists( $template_css_url );
		$template_css_url_public = $template_css_exists ? FOTOGRIDS_PLUGIN_URL . 'public/assets/templates/' . $layout . '.css' : '';

		$html  = '<!DOCTYPE html>' . "\n";
		$html .= '<html>' . "\n";
		$html .= '<head>' . "\n";
		$html .= '    <meta charset="UTF-8">' . "\n";
		$html .= '    <meta name="viewport" content="width=device-width, initial-scale=1.0">' . "\n";
		$html .= '    <title>' . esc_html( $template_name ) . ' - ' . __( 'Preview', 'fotogrids' ) . '</title>' . "\n";
        // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- This is a self-contained preview document returned by a REST endpoint, not the WP frontend; there is no wp_head to enqueue into.
		$html .= '    <link rel="stylesheet" href="' . esc_url( $frontend_css_url ) . '?ver=' . FOTOGRIDS_VERSION . '">' . "\n";

		if ( $template_css_exists ) {
            // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- Self-contained preview document; see note above.
			$html .= '    <link rel="stylesheet" href="' . esc_url( $template_css_url_public ) . '?ver=' . FOTOGRIDS_VERSION . '">' . "\n";
		}

		$preview_background = $request->get_param( 'preview_background' ) ?: 'light';
		$preview_width      = $request->get_param( 'preview_width' ) ?: 'full';

		$bg_color = '#f5f5f5';
		if ( 'dark' === $preview_background ) {
			$bg_color = '#1a1a1a';
		} elseif ( 'custom' === $preview_background ) {
			$bg_color = '#0066cc';
		}

		$max_width = 'none';
		if ( 'custom' === $preview_width ) {
			$max_width = '1000px';
		}

		$html .= '    <style>' . "\n";
		$html .= '        * { margin: 0; padding: 0; box-sizing: border-box; }' . "\n";
		$html .= '        html, body {' . "\n";
		$html .= '            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;' . "\n";
		$html .= '            padding: 20px;' . "\n";
		$html .= '            background: ' . esc_attr( $bg_color ) . ';' . "\n";
		$html .= '            min-height: 100vh;' . "\n";
		$html .= '        }' . "\n";
		$html .= '        body {' . "\n";
		$html .= '            margin: 0 auto;' . "\n";
		if ( 'none' !== $max_width ) {
			$html .= '            max-width: ' . esc_attr( $max_width ) . ';' . "\n";
		}
		$html .= '        }' . "\n";
		$html .= '        .fotogrids-collection {' . "\n";
		$html .= '            max-width: 100%;' . "\n";
		$html .= '        }' . "\n";
		$html .= '        .fotogrids-item img {' . "\n";
		$html .= '            background: #e0e0e0;' . "\n";
		$html .= '            display: flex;' . "\n";
		$html .= '            align-items: center;' . "\n";
		$html .= '            justify-content: center;' . "\n";
		$html .= '            min-height: 150px;' . "\n";
		$html .= '        }' . "\n";
		$html .= '    </style>' . "\n";
		$html .= '</head>' . "\n";
		$html .= '<body>' . "\n";
		$html .= '    ' . $gallery_html . "\n";
		$html .= '</body>' . "\n";
		$html .= '</html>';

		$response = new \WP_REST_Response( $html );
		$response->set_status( 200 );
		$response->header( 'Content-Type', 'text/html; charset=UTF-8' );
		return $response;
	}

	/**
	 * Get template by ID
	 *
	 * @param string $template_id Template ID
	 * @param string $category Category (gallery or album)
	 * @return array|null Template data or null
	 */
	private static function get_template_by_id( $template_id, $category = null ) {
		$user_templates = self::get_user_templates();
		foreach ( $user_templates as $template ) {
			if ( isset( $template['id'] ) && $template['id'] === $template_id ) {
				if ( $category && isset( $template['category'] ) && $template['category'] !== $category ) {
					continue;
				}
				return $template;
			}
		}

		$predefined = self::load_predefined_templates( $category, true );
		foreach ( $predefined as $template ) {
			if ( isset( $template['id'] ) && $template['id'] === $template_id ) {
				return $template;
			}
		}

		return null;
	}

	/**
	 * Get template preview items with real demo images
	 *
	 * Uses actual demo images from template-demo folder with format fallback (avif -> jpg)
	 * Reads from manifest.json if available, otherwise auto-discovers images
	 *
	 * @return array Array of item data formatted for gallery rendering
	 */
	private static function get_template_preview_items() {
		$plugin_dir = rtrim( FOTOGRIDS_PLUGIN_DIR, '/' ) . '/';
		$plugin_url = rtrim( FOTOGRIDS_PLUGIN_URL, '/' ) . '/';

		$demo_dir      = $plugin_dir . 'public/assets/template-demo/';
		$demo_url      = $plugin_url . 'public/assets/template-demo/';
		$manifest_path = $demo_dir . 'manifest.json';

		$manifest = null;
		if ( file_exists( $manifest_path ) ) {
			$manifest_content = file_get_contents( $manifest_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
			$manifest         = json_decode( $manifest_content, true );
			if ( json_last_error() !== JSON_ERROR_NONE ) {
				$manifest = null;
			}
		}

		$items = array();
		for ( $i = 1; $i <= 35; $i++ ) {
			$image_num = sprintf( '%02d', $i );
			$base_name = 'fotogrids-tp-' . $image_num;

			$avif_path = $demo_dir . 'avif/' . $base_name . '.avif';
			$jpg_path  = $demo_dir . 'jpg/' . $base_name . '.jpg';

			$avif_exists = file_exists( $avif_path );
			$jpg_exists  = file_exists( $jpg_path );

			if ( ! $avif_exists && ! $jpg_exists ) {
				continue;
			}

			$title   = null;
			$alt     = null;
			$caption = null;

			if ( $manifest && isset( $manifest['images'] ) ) {
				foreach ( $manifest['images'] as $manifest_image ) {
					if ( isset( $manifest_image['id'] ) && $manifest_image['id'] === $base_name ) {
						$title   = isset( $manifest_image['title'] ) ? $manifest_image['title'] : null;
						$alt     = isset( $manifest_image['alt'] ) ? $manifest_image['alt'] : null;
						$caption = isset( $manifest_image['caption'] ) ? $manifest_image['caption'] : null;
						break;
					}
				}
			}

			if ( ! $title ) {
				/* translators: %d: demo image number. */
				$title = sprintf( __( 'Demo Image %d', 'fotogrids' ), $i );
			}
			if ( ! $alt ) {
				/* translators: %d: demo image number. */
				$alt = sprintf( __( 'Template preview demo image %d', 'fotogrids' ), $i );
			}
			if ( ! $caption ) {
				$caption = sprintf( __( 'This is how your gallery will look with this template', 'fotogrids' ) );
			}

			$avif_url = $demo_url . 'avif/' . $base_name . '.avif';
			$jpg_url  = $demo_url . 'jpg/' . $base_name . '.jpg';

			$image_url = $avif_exists ? $avif_url : $jpg_url;

			$items[] = array(
				'id'      => $i,
				'title'   => $title,
				'alt'     => $alt,
				'caption' => $caption,
				'medium'  => $image_url,
				'full'    => $image_url,
				'avif'    => $avif_exists ? $avif_url : null,
				'jpg'     => $jpg_exists ? $jpg_url : null,
			);
		}

		if ( empty( $items ) ) {
			return self::get_template_preview_items_fallback();
		}

		return $items;
	}

	/**
	 * Fallback method using icon placeholders if demo images are not available
	 *
	 * @return array Array of item data with SVG icon placeholders
	 */
	private static function get_template_preview_items_fallback() {
		$image_icon_svg = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.27209 20.7279L10.8686 14.1314C11.2646 13.7354 11.4627 13.5373 11.691 13.4632C11.8918 13.3979 12.1082 13.3979 12.309 13.4632C12.5373 13.5373 12.7354 13.7354 13.1314 14.1314L19.6839 20.6839M14 15L16.8686 12.1314C17.2646 11.7354 17.4627 11.5373 17.691 11.4632C17.8918 11.3979 18.1082 11.3979 18.309 11.4632C18.5373 11.5373 18.7354 11.7354 19.1314 12.1314L22 15M10 9C10 10.1046 9.10457 11 8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9ZM6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27976 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3H6.8C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8V16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

		$video_icon_svg = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.7519 11.1679L11.5547 9.03647C10.8901 8.59343 10 9.06982 10 9.86852V14.1315C10 14.9302 10.8901 15.4066 11.5547 14.9635L14.7519 12.8321C15.3457 12.4362 15.3457 11.5638 14.7519 11.1679Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

		$image_icon_data_uri = 'data:image/svg+xml;base64,' . base64_encode( $image_icon_svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Benign data encoding for template payload, not code obfuscation.
		$video_icon_data_uri = 'data:image/svg+xml;base64,' . base64_encode( $video_icon_svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Benign data encoding for template payload, not code obfuscation.

		$items = array();
		for ( $i = 1; $i <= 6; $i++ ) {
			$is_video = ( 0 === $i % 3 );

			if ( $is_video ) {
				/* translators: %d: preview item number. */
				$item_title = sprintf( __( 'Video Item %d', 'fotogrids' ), $i );
				/* translators: %d: preview item number. */
				$item_alt = sprintf( __( 'Video placeholder %d', 'fotogrids' ), $i );
			} else {
				/* translators: %d: preview item number. */
				$item_title = sprintf( __( 'Image Item %d', 'fotogrids' ), $i );
				/* translators: %d: preview item number. */
				$item_alt = sprintf( __( 'Image placeholder %d', 'fotogrids' ), $i );
			}

			$items[] = array(
				'id'      => $i,
				'title'   => $item_title,
				'alt'     => $item_alt,
				'caption' => __( 'This is how your gallery will look with this template', 'fotogrids' ),
				'medium'  => $is_video ? $video_icon_data_uri : $image_icon_data_uri,
				'full'    => $is_video ? $video_icon_data_uri : $image_icon_data_uri,
			);
		}

		return $items;
	}
}
