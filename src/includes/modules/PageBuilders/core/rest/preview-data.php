<?php
/**
 * Data handlers for the Page Builders preview + picker REST endpoints.
 *
 * @package FotoGrids\Modules\PageBuilders\REST
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\REST;

use FotoGrids\Hooks\Actions_Render;
use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;
use FotoGrids\Post_Types;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Instance_Id_Factory;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Handlers behind `/preview/gallery/{id}`, `/preview/album/{id}`, and
 * `/picker/items`, shared by every page-builder host.
 *
 * @since 1.0.0
 */
final class Preview_Data {

	/**
	 * Per-request items_per_page cap for the picker listing.
	 *
	 * @var int
	 */
	private const PICKER_PER_PAGE_MAX = 100;

	/**
	 * Default items_per_page for the picker listing.
	 *
	 * @var int
	 */
	private const PICKER_PER_PAGE_DEFAULT = 24;

	/**
	 * `POST /preview/gallery/{id}`.
	 *
	 * Renders a gallery through the public-render pipeline with
	 * `is_preview = true` on the meta.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function render_gallery_preview( \WP_REST_Request $request ) {
		$gallery_id   = absint( $request->get_param( 'id' ) );
		$gallery_post = get_post( $gallery_id );

		if ( ! $gallery_post || Post_Types::GALLERY !== $gallery_post->post_type ) {
			return new \WP_Error(
				'fotogrids_preview_gallery_not_found',
				__( 'Gallery not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( ! Preview_Renderer::can_preview( $gallery_id ) ) {
			return self::forbidden();
		}

		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return new \WP_Error(
				'fotogrids_preview_pipeline_unavailable',
				__( 'Render pipeline is not available.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		$render_settings = self::resolve_gallery_settings( $gallery_id );
		$item_ids        = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id )
			: array();

		// pagination=false is handled client-side by LivePreview.
		$preview_options = self::read_preview_options( $request );
		if ( false === $preview_options['click_behavior'] ) {
			$render_settings['item_click_behavior'] = 'nothing';
		}

		$render_context = Context_Builder::for_preview()->build_for_public(
			$gallery_id,
			$render_settings,
			$item_ids,
			Request_Source::PREVIEW_SAVED
		);

		$render_context = self::flip_to_preview_context(
			$render_context,
			Request_Source::PREVIEW_SAVED,
			(string) $request->get_param( 'placement_key' )
		);

		$render_result = Render_Controller::factory()->render( $render_context );

		do_action( Actions_Render::LATE_ASSETS, $render_context );

		$payload = self::serialize_render_payload( $render_result, $render_context );

		return rest_ensure_response( $payload );
	}

	/**
	 * Return a copy of the render context with `is_preview = true`, the
	 * given source on the meta, and preview-only settings merged in.
	 *
	 * Uses the constructor because Render_Context::with() forbids replacing meta.
	 *
	 * @since 1.0.0
	 * @param \FotoGrids\Render\Api\Render_Context $context
	 * @param value-of<\FotoGrids\Render\Api\Request_Source::ALL> $source
	 * @param string $placement_key Builder element ID; empty keeps the counter-based instance ID.
	 * @return \FotoGrids\Render\Api\Render_Context
	 */
	private static function flip_to_preview_context(
		\FotoGrids\Render\Api\Render_Context $context,
		string $source,
		string $placement_key = ''
	): \FotoGrids\Render\Api\Render_Context {
		$meta_changes = array(
			'is_preview' => true,
			'source'     => $source,
		);

		$collection_id = Collection_Kind::ALBUM === $context->meta->collection_kind
			? (int) $context->meta->album_id
			: $context->meta->gallery_id;
		$placement_id  = Instance_Id_Factory::instance()->generate_for_placement( $collection_id, $placement_key );

		if ( null !== $placement_id ) {
			$meta_changes['instance_id'] = $placement_id;
		}

		$preview_meta = $context->meta->with( $meta_changes );

		$preview_settings = array_merge( $context->settings, Preview_Renderer::preview_settings( $collection_id, $source ) );

		return new \FotoGrids\Render\Api\Render_Context(
			$preview_meta,
			$context->layout,
			$context->behavior,
			$preview_settings,
			$context->items,
			$context->warnings,
			$context->via_album_id,
		);
	}

	/**
	 * Resolve a gallery's normalized settings in the shape the renderer expects.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id
	 * @return array<string,mixed>
	 */
	private static function resolve_gallery_settings( int $gallery_id ): array {
		if ( class_exists( '\FotoGrids\Galleries\Gallery_Repository' ) ) {
			return (array) \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id );
		}
		return array();
	}

	/**
	 * Read the preview feature toggles off the REST request, normalised by
	 * {@see Preview_Options}.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return array{click_behavior: bool, pagination: bool}
	 */
	private static function read_preview_options( \WP_REST_Request $request ): array {
		$raw = $request->get_param( 'preview_options' );
		return Preview_Options::normalise( is_array( $raw ) ? $raw : array() );
	}

	/**
	 * `POST /preview/album/{id}`.
	 *
	 * Renders an album through the Render_Controller pipeline with
	 * `is_preview = true`.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function render_album_preview( \WP_REST_Request $request ) {
		$album_id   = absint( $request->get_param( 'id' ) );
		$album_post = get_post( $album_id );

		if ( ! $album_post || Post_Types::ALBUM !== $album_post->post_type ) {
			return new \WP_Error(
				'fotogrids_preview_album_not_found',
				__( 'Album not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( ! Preview_Renderer::can_preview( $album_id ) ) {
			return self::forbidden();
		}

		$child_gallery_ids = Preview_Renderer::visible_child_gallery_ids( $album_id );

		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return new \WP_Error(
				'fotogrids_preview_pipeline_unavailable',
				__( 'Render pipeline is not available.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		$album_settings = class_exists( '\FotoGrids\Albums\Album_Repository' )
			? (array) \FotoGrids\Albums\Album_Repository::get_settings( $album_id )
			: array();

		// See render_gallery_preview() for the toggle semantics.
		$preview_options = self::read_preview_options( $request );
		if ( false === $preview_options['click_behavior'] ) {
			$album_settings['item_click_behavior'] = 'nothing';
		}

		$render_context = Context_Builder::for_preview()->build_for_album(
			$album_id,
			$album_settings,
			$child_gallery_ids,
			Request_Source::PREVIEW_SAVED
		);

		$render_context = self::flip_to_preview_context(
			$render_context,
			Request_Source::PREVIEW_SAVED,
			(string) $request->get_param( 'placement_key' )
		);

		$render_result = Render_Controller::factory()->render( $render_context );

		// wp_footer never fires in REST; LATE_ASSETS stands in for it.
		do_action( Actions_Render::LATE_ASSETS, $render_context );

		$payload = self::serialize_render_payload( $render_result, $render_context );

		return rest_ensure_response( $payload );
	}

	/**
	 * `GET /picker/items`.
	 *
	 * Paged, searchable listing of galleries or albums as picker cards.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public static function get_picker_items( \WP_REST_Request $request ) {
		$type     = (string) $request->get_param( 'type' );
		$page     = max( 1, absint( $request->get_param( 'page' ) ) );
		$per_page = self::resolve_per_page( $request );
		$search   = trim( (string) $request->get_param( 'search' ) );
		$orderby  = (string) $request->get_param( 'orderby' );

		$post_type = 'album' === $type ? Post_Types::ALBUM : Post_Types::GALLERY;

		$caps       = get_post_type_object( $post_type )->cap ?? null;
		$all_drafts = $caps && current_user_can( $caps->edit_others_posts );
		$own_drafts = ! $all_drafts && $caps && current_user_can( $caps->edit_posts );
		$query_args = array(
			'post_type'      => $post_type,
			'post_status'    => $all_drafts || $own_drafts
				? array( 'publish', 'private', 'draft', 'pending', 'future' )
				: array( 'publish', 'private' ),
			'perm'           => 'readable',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'no_found_rows'  => false,
			'fields'         => 'ids',
		);

		if ( '' !== $search ) {
			$query_args['s'] = $search;
		}

		switch ( $orderby ) {
			case 'oldest':
				$query_args['orderby'] = 'date';
				$query_args['order']   = 'ASC';
				break;
			case 'title':
				$query_args['orderby'] = 'title';
				$query_args['order']   = 'ASC';
				break;
			case 'modified':
				$query_args['orderby'] = 'modified';
				$query_args['order']   = 'DESC';
				break;
			case 'newest':
			default:
				$query_args['orderby'] = 'date';
				$query_args['order']   = 'DESC';
				break;
		}

		$own_drafts_where = static function ( string $where ): string {
			global $wpdb;

			return $where . $wpdb->prepare(
				" AND ( {$wpdb->posts}.post_status IN ( 'publish', 'private' ) OR {$wpdb->posts}.post_author = %d )",
				get_current_user_id()
			);
		};

		if ( $own_drafts ) {
			add_filter( 'posts_where', $own_drafts_where );
		}

		$query = new \WP_Query( $query_args );

		remove_filter( 'posts_where', $own_drafts_where );
		$ids   = (array) $query->posts;
		$total = (int) $query->found_posts;
		$pages = (int) $query->max_num_pages;

		$items = array();
		foreach ( $ids as $post_id ) {
			$items[] = 'album' === $type
				? self::album_picker_card( (int) $post_id )
				: self::gallery_picker_card( (int) $post_id );
		}

		/**
		 * Filters the picker items before they are returned.
		 *
		 * @since 1.0.0
		 * @param array[] $items
		 * @param string  $type 'gallery' | 'album'
		 */
		$items = (array) apply_filters( Filters_Page_Builders::PICKER_ITEMS, $items, $type );

		return rest_ensure_response(
			array(
				'items'    => array_values( $items ),
				'total'    => $total,
				'page'     => $page,
				'per_page' => $per_page,
				'has_more' => $page < $pages,
			)
		);
	}

	/**
	 * `POST /import/core-gallery`.
	 *
	 * Creates a draft `fotogrids_gallery` from attachment IDs and returns its
	 * id and edit URL.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function import_core_gallery( \WP_REST_Request $request ) {
		$ids = (array) $request->get_param( 'attachment_ids' );
		$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );

		if ( empty( $ids ) ) {
			return new \WP_Error(
				'fotogrids_import_no_attachments',
				__( 'No attachments to import.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$title = (string) $request->get_param( 'title' );
		if ( '' === $title ) {
			$title = sprintf(
				/* translators: %s: date imported */
				__( 'Imported gallery (%s)', 'fotogrids' ),
				date_i18n( get_option( 'date_format' ) )
			);
		}

		$gallery_id = wp_insert_post(
			array(
				'post_title'  => sanitize_text_field( $title ),
				'post_type'   => Post_Types::GALLERY,
				'post_status' => 'draft',
			),
			true
		);

		if ( is_wp_error( $gallery_id ) ) {
			return $gallery_id;
		}

		if ( class_exists( '\FotoGrids\Galleries\Gallery_Items' ) ) {
			foreach ( $ids as $attachment_id ) {
				\FotoGrids\Galleries\Gallery_Items::add( (int) $gallery_id, (int) $attachment_id );
			}
		}

		return rest_ensure_response(
			array(
				'gallery_id' => (int) $gallery_id,
				'edit_url'   => admin_url( 'post.php?action=edit&post=' . (int) $gallery_id ),
			)
		);
	}

	/**
	 * Build the picker card payload for a single gallery.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery ID.
	 * @return array<string, mixed>
	 */
	private static function gallery_picker_card( int $gallery_id ): array {
		$post     = get_post( $gallery_id );
		$thumb    = self::resolve_gallery_thumb_url( $gallery_id );
		$item_ids = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( (int) $gallery_id )
			: array();
		$settings = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? (array) \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $gallery_id )
			: array();

		$status   = $post ? $post->post_status : 'publish';
		$can_edit = current_user_can( 'edit_post', $gallery_id );

		if ( ! $can_edit && ! empty( $settings['password_protect'] )
			&& \FotoGrids\Password_Crypto::is_encrypted( (string) ( $settings['_password_encrypted'] ?? '' ) )
		) {
			$thumb = null;
		}

		return array(
			'id'             => $gallery_id,
			'can_edit'       => $can_edit,
			'title'          => $post ? html_entity_decode( $post->post_title, ENT_QUOTES, 'UTF-8' ) : '',
			'status'         => $status,
			'status_label'   => self::status_label( $status ),
			'item_count'     => count( $item_ids ),
			'featured_thumb' => $thumb,
			'created_at'     => $post ? mysql2date( 'c', $post->post_date_gmt, false ) : null,
			'updated_at'     => $post ? mysql2date( 'c', $post->post_modified_gmt, false ) : null,
			'layout'         => isset( $settings['layout'] ) ? (string) $settings['layout'] : 'grid',
		);
	}

	/**
	 * Build the picker card payload for a single album.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album ID.
	 * @return array<string, mixed>
	 */
	private static function album_picker_card( int $album_id ): array {
		$post  = get_post( $album_id );
		$thumb = self::resolve_album_thumb_url( $album_id );

		$children = array();
		if ( class_exists( '\FotoGrids\Gallery_Album_Relations' ) ) {
			$children = (array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album(
				$album_id,
				array(
					'orderby' => 'position',
					'order'   => 'ASC',
				)
			);
		}

		$settings = class_exists( '\FotoGrids\Albums\Album_Repository' )
			? (array) \FotoGrids\Albums\Album_Repository::get_settings( $album_id )
			: array();

		$status   = $post ? $post->post_status : 'publish';
		$can_edit = current_user_can( 'edit_post', $album_id );

		if ( ! $can_edit && ! empty( $settings['password_protect'] )
			&& \FotoGrids\Password_Crypto::is_encrypted( (string) ( $settings['_password_encrypted'] ?? '' ) )
		) {
			$thumb = null;
		}

		return array(
			'id'             => $album_id,
			'can_edit'       => $can_edit,
			'title'          => $post ? html_entity_decode( $post->post_title, ENT_QUOTES, 'UTF-8' ) : '',
			'status'         => $status,
			'status_label'   => self::status_label( $status ),
			'item_count'     => count( $children ),
			'featured_thumb' => $thumb,
			'created_at'     => $post ? mysql2date( 'c', $post->post_date_gmt, false ) : null,
			'updated_at'     => $post ? mysql2date( 'c', $post->post_modified_gmt, false ) : null,
			'layout'         => isset( $settings['layout'] ) ? (string) $settings['layout'] : 'grid',
		);
	}

	/**
	 * Resolve a localized label for a post status, falling back to the slug.
	 *
	 * @since 1.0.0
	 * @param string $status Post status slug.
	 * @return string
	 */
	private static function status_label( string $status ): string {
		$obj = get_post_status_object( $status );
		if ( $obj && isset( $obj->label ) && '' !== $obj->label ) {
			return (string) $obj->label;
		}
		return $status;
	}

	/**
	 * Resolve a gallery's medium-size cover URL, or null.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery ID.
	 * @return string|null
	 */
	private static function resolve_gallery_thumb_url( int $gallery_id ): ?string {
		if ( class_exists( '\FotoGrids\Galleries\Cover_Resolver' ) ) {
			$url = \FotoGrids\Galleries\Cover_Resolver::url_for_collection( (int) $gallery_id, 'medium' );
			if ( '' !== $url ) {
				return $url;
			}
		}

		return null;
	}

	/**
	 * Resolve an album's thumbnail URL from its first visible child gallery
	 * that has one, or null.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album ID.
	 * @return string|null
	 */
	private static function resolve_album_thumb_url( int $album_id ): ?string {
		foreach ( Preview_Renderer::visible_child_gallery_ids( $album_id ) as $child_id ) {
			$thumb = self::resolve_gallery_thumb_url( $child_id );
			if ( $thumb ) {
				return $thumb;
			}
		}

		return null;
	}

	/**
	 * Error for a collection the current user may not preview.
	 *
	 * @since 1.3.0
	 * @return \WP_Error
	 */
	private static function forbidden(): \WP_Error {
		return new \WP_Error(
			'rest_forbidden',
			__( 'Sorry, you are not allowed to preview this.', 'fotogrids' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	/**
	 * Build the preview response payload for the gallery and album endpoints.
	 *
	 * @since 1.0.0
	 * @param object $render_result Render_Controller render result.
	 * @param object $render_context Context used for the render.
	 * @return array<string, mixed>
	 */
	private static function serialize_render_payload( $render_result, $render_context ): array {
		$css_assets = Asset_Resolver::instance()->get_css_asset_urls();
		$js_assets  = Asset_Resolver::instance()->get_js_asset_data();
		$js_payload = self::serialize_js_assets( $js_assets );

		$sharing = array();
		if ( class_exists( '\FotoGrids\Settings\Sharing_Settings_Store' ) ) {
			$sharing = (array) \FotoGrids\Settings\Sharing_Settings_Store::get();
		}

		$localize_fotogrids = array(
			'deep_linking_enabled'  => (bool) ( $sharing['deep_linking_enabled'] ?? false ),
			'embedded_share_target' => $sharing['embedded_share_target'] ?? '',
			'restUrl'               => esc_url_raw( rest_url() ),
			'renderUrl'             => esc_url_raw( rest_url( 'fotogrids/v1/gallery/render' ) ),
			'renderNonce'           => wp_create_nonce( 'wp_rest' ),
		);

		return array(
			'html'           => $render_result->html,
			'instance_id'    => $render_result->instance_id,
			'active_modules' => $render_result->active_modules,
			'http_status'    => $render_result->http_status,
			'inlineCss'      => $render_result->inline_css,
			'inlineJs'       => $render_result->inline_js,
			'jsonLd'         => $render_result->json_ld,
			'assets'         => array(
				'css'      => $css_assets,
				'js'       => $js_payload,
				'localize' => array(
					'fotogrids' => $localize_fotogrids,
				),
			),
			'meta'           => array(
				'warnings' => $render_context->warnings,
			),
		);
	}

	/**
	 * Serialise enqueued JS handles in dependency order.
	 *
	 * @since 1.0.0
	 * @param array<string, array{src: string, in_footer: bool}> $js_assets
	 * @return array<int, array<string, mixed>>
	 */
	private static function serialize_js_assets( array $js_assets ): array {
		$scripts = wp_scripts();
		$records = array();

		foreach ( $js_assets as $handle => $meta ) {
			$deps = array();
			if ( isset( $scripts->registered[ $handle ] ) ) {
				$deps = (array) $scripts->registered[ $handle ]->deps;
			}

			$inline_before = '';
			$inline_after  = '';
			if ( isset( $scripts->registered[ $handle ] ) ) {
				$before_data = $scripts->get_data( $handle, 'before' );
				$after_data  = $scripts->get_data( $handle, 'after' );
				if ( is_array( $before_data ) ) {
					$inline_before = implode( "\n", array_filter( $before_data, 'is_string' ) );
				} elseif ( is_string( $before_data ) ) {
					$inline_before = $before_data;
				}
				if ( is_array( $after_data ) ) {
					$inline_after = implode( "\n", array_filter( $after_data, 'is_string' ) );
				} elseif ( is_string( $after_data ) ) {
					$inline_after = $after_data;
				}
			}

			$records[ $handle ] = array(
				'handle'        => $handle,
				'src'           => $meta['src'],
				'in_footer'     => (bool) $meta['in_footer'],
				'deps'          => array_values( $deps ),
				'inline_before' => $inline_before,
				'inline_after'  => $inline_after,
			);
		}

		$sorted   = array();
		$visited  = array();
		$visiting = array();

		$visit = function ( string $handle ) use ( &$visit, &$records, &$sorted, &$visited, &$visiting ): void {
			if ( isset( $visited[ $handle ] ) || ! isset( $records[ $handle ] ) ) {
				return;
			}
			if ( isset( $visiting[ $handle ] ) ) {
				return; // cycle guard
			}
			$visiting[ $handle ] = true;

			foreach ( $records[ $handle ]['deps'] as $dep_handle ) {
				if ( is_string( $dep_handle ) ) {
					$visit( $dep_handle );
				}
			}

			$visited[ $handle ] = true;
			$sorted[]           = $records[ $handle ];
		};

		foreach ( $records as $handle => $_record ) {
			$visit( $handle );
		}

		return $sorted;
	}

	/**
	 * Resolve the per_page param with a default and a hard cap.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return int
	 */
	private static function resolve_per_page( \WP_REST_Request $request ): int {
		$raw = absint( $request->get_param( 'per_page' ) );
		if ( $raw <= 0 ) {
			$raw = self::PICKER_PER_PAGE_DEFAULT;
		}
		return min( $raw, self::PICKER_PER_PAGE_MAX );
	}
}
