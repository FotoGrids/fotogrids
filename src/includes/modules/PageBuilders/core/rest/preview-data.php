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
use FotoGrids\License_Manager;
use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;
use FotoGrids\Modules\PageBuilders\Pro_Guard;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Handlers behind `/preview/gallery/{id}`, `/preview/album/{id}`, and
 * `/picker/items`.
 *
 * Generic, builder-agnostic. Used by every page-builder host - the
 * Gutenberg block in the first instance, Elementor / Divi / Bricks once
 * those sub-modules ship.
 *
 * Gallery preview is intentionally a thin wrapper around the existing
 * Admin `Preview_Endpoint::preview()` - same response shape, same code
 * path, no behaviour drift between the metabox preview and the
 * page-builder preview. Album preview is built here because no existing
 * endpoint renders albums for an admin caller.
 *
 * @since 1.0.0
 */
final class Preview_Data {

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * This class is part of the FotoGrids custom-table data layer. Every
	 * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
	 * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
	 * WP placeholders cannot bind. All user-supplied *values* are passed
	 * through $wpdb->prepare(); where SQL is assembled incrementally or uses
	 * a generated %d IN() list, the prepare call is a separate statement the
	 * sniff cannot follow. Custom tables have no WP_Query / core-API
	 * equivalent and no object-cache layer applies at this level.
	 * ---------------------------------------------------------------------
	 */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

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
	 * Renders a gallery through the same public-render pipeline used on
	 * the front-of-site, then flips `is_preview = true` on the meta so
	 * preview-aware modules (password gate, etc.) take the admin path.
	 *
	 * Using `build_for_public()` here - rather than `build_for_preview()`
	 * which the legacy admin Preview_Endpoint relied on - gives the
	 * preview the full sorter + filter + pagination behaviour. Without
	 * that, paginated galleries rendered all items but still showed the
	 * load-more chrome.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function render_gallery_preview( \WP_REST_Request $request ) {
		$gallery_id   = absint( $request->get_param( 'id' ) );
		$gallery_post = get_post( $gallery_id );

		if ( ! $gallery_post || 'fotogrids_gallery' !== $gallery_post->post_type ) {
			return new \WP_Error(
				'fotogrids_preview_gallery_not_found',
				__( 'Gallery not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
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

		// Per-host preview-feature toggles (Gutenberg block / metabox /
		// future page-builder hosts). Applied as settings overrides so
		// the renderer behaves accordingly.
		//
		//   click_behavior=false  -> override item_click_behavior with
		//                            'nothing' so no decorator wires
		//                            click handlers. The gallery still
		//                            renders with full styling; clicks
		//                            do nothing.
		//   pagination=false      -> leave pagination_type alone so the
		//                            chrome still renders. The client
		//                            neutralises load-more / page-button
		//                            clicks via a capture-phase
		//                            listener on LivePreview.
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
			Request_Source::PREVIEW_SAVED
		);

		$render_result = Render_Controller::factory()->render( $render_context );

		do_action( Actions_Render::LATE_ASSETS, $render_context );

		$payload = self::serialize_render_payload( $render_result, $render_context );
		$payload = self::merge_page_builder_meta( $payload, 'gallery', $gallery_id );

		return rest_ensure_response( $payload );
	}

	/**
	 * Return a copy of the render context with `is_preview = true` and the
	 * supplied source stamped on the meta, plus preview-only settings
	 * markers merged in.
	 *
	 * Render_Context::with() explicitly forbids replacing the meta field,
	 * so we reach for the underlying constructor instead.
	 *
	 * @since 1.0.0
	 * @param \FotoGrids\Render\Api\Render_Context $context
	 * @param \FotoGrids\Render\Api\Request_Source $source
	 * @return \FotoGrids\Render\Api\Render_Context
	 */
	private static function flip_to_preview_context(
		\FotoGrids\Render\Api\Render_Context $context,
		string $source
	): \FotoGrids\Render\Api\Render_Context {
		$preview_meta = $context->meta->with(
			array(
				'is_preview' => true,
				'source'     => $source,
			)
		);

		$preview_settings = array_merge(
			$context->settings,
			array(
				'_preview_source'     => $source->value,
				'_show_render_errors' => current_user_can( 'edit_posts' ),
			)
		);

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
	 * Resolve a gallery's normalized settings - the exact shape the
	 * renderer expects, including nested keys like columns.desktop /
	 * item_spacing.desktop. Delegates to Gallery_Repository, which is
	 * also what Public_Render::get_gallery_settings wraps internally.
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
	 * Read the per-host preview feature toggles off the REST request.
	 *
	 * Defaults and normalisation are delegated to {@see Preview_Options}
	 * so every builder (Gutenberg via REST, Elementor via direct PHP,
	 * future Divi / Bricks) speaks the same vocabulary.
	 *
	 * Both toggles are eventually applied:
	 *   - click_behavior=false overrides item_click_behavior server-side
	 *     so no decorator binds a click handler at render time.
	 *   - pagination=false is consumed client-side by LivePreview, which
	 *     catches pagination-button clicks in the capture phase. The
	 *     server still renders pagination chrome and slicing exactly
	 *     like the live page.
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
	 * `is_preview = true` so the password gate is bypassed (same rule the
	 * gallery preview follows). Mirrors the Preview_Endpoint response
	 * shape exactly.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function render_album_preview( \WP_REST_Request $request ) {
		$album_id   = absint( $request->get_param( 'id' ) );
		$album_post = get_post( $album_id );

		if ( ! $album_post || 'fotogrids_album' !== $album_post->post_type ) {
			return new \WP_Error(
				'fotogrids_preview_album_not_found',
				__( 'Album not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$child_gallery_ids = self::resolve_album_child_gallery_ids( $album_id );

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

		// Flip is_preview on the meta so the password gate (and other
		// preview-aware modules) take the admin path.
		$render_context = Context_Builder::for_preview()->build_for_album(
			$album_id,
			$album_settings,
			$child_gallery_ids,
			Request_Source::PREVIEW_SAVED
		);

		$render_context = self::flip_to_preview_context(
			$render_context,
			Request_Source::PREVIEW_SAVED
		);

		$render_result = Render_Controller::factory()->render( $render_context );

		// wp_footer never fires in REST, so fire the FotoGrids-only late-assets
		// action that page-scope modules (loading-icon) also hook.
		do_action( Actions_Render::LATE_ASSETS, $render_context );

		$payload = self::serialize_render_payload( $render_result, $render_context );

		$payload = self::merge_page_builder_meta( $payload, 'album', $album_id );

		return rest_ensure_response( $payload );
	}

	/**
	 * `GET /picker/items`.
	 *
	 * Paged, searchable listing of galleries or albums for the page-builder
	 * picker. Returns picker-card-shaped data:
	 *
	 *   {
	 *     items: [
	 *       {
	 *         id,
	 *         title,
	 *         item_count,
	 *         featured_thumb,    // URL or null
	 *         created_at,        // ISO-8601
	 *         updated_at,        // ISO-8601
	 *         layout,            // current layout id for visual hint
	 *         requires_pro       // bool (from Pro_Guard)
	 *       }
	 *     ],
	 *     total,
	 *     has_more,
	 *     license_state          // 'active' | 'lapsed' | 'none'
	 *   }
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

		$post_type = 'album' === $type ? 'fotogrids_album' : 'fotogrids_gallery';

		$query_args = array(
			'post_type'      => $post_type,
			// Every status the picker is allowed to surface. `publish` is
			// always public; the others are only visible to users with
			// edit caps (the picker's permission gate enforces that).
			'post_status'    => array( 'publish', 'private', 'draft', 'pending', 'future' ),
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

		$query = new \WP_Query( $query_args );
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
		 * Lets Pro / third parties mutate (or add fields to) a picker item
		 * before it's returned. Common use: append a Pro Stats "Views"
		 * column.
		 *
		 * @since 1.0.0
		 * @param array[] $items
		 * @param string  $type 'gallery' | 'album'
		 */
		$items = (array) apply_filters( Filters_Page_Builders::PICKER_ITEMS, $items, $type );

		return rest_ensure_response(
			array(
				'items'         => array_values( $items ),
				'total'         => $total,
				'page'          => $page,
				'per_page'      => $per_page,
				'has_more'      => $page < $pages,
				'license_state' => self::current_license_state(),
			)
		);
	}

	/**
	 * `POST /import/core-gallery`.
	 *
	 * Creates a new `fotogrids_gallery` post from a list of attachment IDs
	 * and returns the new gallery's id + edit URL. The core gallery → block
	 * transform calls this; the user is taken to the new gallery's edit
	 * screen to finish setup.
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
				'post_type'   => 'fotogrids_gallery',
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

		$status = $post ? $post->post_status : 'publish';

		return array(
			'id'             => $gallery_id,
			'title'          => $post ? html_entity_decode( $post->post_title, ENT_QUOTES, 'UTF-8' ) : '',
			'status'         => $status,
			'status_label'   => self::status_label( $status ),
			'item_count'     => count( $item_ids ),
			'featured_thumb' => $thumb,
			'created_at'     => $post ? mysql2date( 'c', $post->post_date_gmt, false ) : null,
			'updated_at'     => $post ? mysql2date( 'c', $post->post_modified_gmt, false ) : null,
			'layout'         => isset( $settings['layout'] ) ? (string) $settings['layout'] : 'grid',
			'requires_pro'   => Pro_Guard::gallery_requires_pro( $gallery_id ),
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

		$status = $post ? $post->post_status : 'publish';

		return array(
			'id'             => $album_id,
			'title'          => $post ? html_entity_decode( $post->post_title, ENT_QUOTES, 'UTF-8' ) : '',
			'status'         => $status,
			'status_label'   => self::status_label( $status ),
			'item_count'     => count( $children ),
			'featured_thumb' => $thumb,
			'created_at'     => $post ? mysql2date( 'c', $post->post_date_gmt, false ) : null,
			'updated_at'     => $post ? mysql2date( 'c', $post->post_modified_gmt, false ) : null,
			'layout'         => isset( $settings['layout'] ) ? (string) $settings['layout'] : 'grid',
			'requires_pro'   => Pro_Guard::album_requires_pro( $album_id ),
		);
	}

	/**
	 * Resolve a localized, human-readable label for a post status.
	 *
	 * Uses {@see get_post_status_object()} so any registered status —
	 * including custom ones — gets the registrant's intended label.
	 * Falls back to the raw slug if WordPress doesn't know the status.
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
	 * Resolve a gallery's thumbnail URL: featured item -> first item ->
	 * null. One DB query at most, no mosaic fallback.
	 *
	 * @since 1.0.0
	 * @param int $gallery_id Gallery ID.
	 * @return string|null
	 */
	private static function resolve_gallery_thumb_url( int $gallery_id ): ?string {
		// Poster-aware cover resolution handles image, video-file, and embed
		// items uniformly, so embed-only / video-only galleries still preview.
		if ( class_exists( '\FotoGrids\Galleries\Cover_Resolver' ) ) {
			$url = \FotoGrids\Galleries\Cover_Resolver::url_for_collection( (int) $gallery_id, 'medium' );
			if ( '' !== $url ) {
				return $url;
			}
		}

		return null;
	}

	/**
	 * Resolve an album's thumbnail URL: featured gallery -> first child
	 * gallery's featured/first item -> null.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album ID.
	 * @return string|null
	 */
	private static function resolve_album_thumb_url( int $album_id ): ?string {
		if ( ! class_exists( '\FotoGrids\Gallery_Album_Relations' ) ) {
			return null;
		}

		$children = (array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album(
			$album_id,
			array(
				'orderby' => 'position',
				'order'   => 'ASC',
			)
		);

		foreach ( $children as $child ) {
			$child_id = is_object( $child ) ? (int) $child->ID : 0;
			if ( $child_id <= 0 ) {
				continue;
			}
			$thumb = self::resolve_gallery_thumb_url( $child_id );
			if ( $thumb ) {
				return $thumb;
			}
		}

		return null;
	}

	/**
	 * Resolve child gallery IDs for an album, in album-stored order.
	 *
	 * @since 1.0.0
	 * @param int $album_id Album ID.
	 * @return int[]
	 */
	private static function resolve_album_child_gallery_ids( int $album_id ): array {
		if ( ! class_exists( '\FotoGrids\Gallery_Album_Relations' ) ) {
			return array();
		}

		$child_galleries = (array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album(
			$album_id,
			array(
				'orderby' => 'position',
				'order'   => 'ASC',
			)
		);

		$ids = array_map(
			static fn ( $gallery_post ) => (int) ( is_object( $gallery_post ) ? $gallery_post->ID : 0 ),
			$child_galleries
		);

		return array_values( array_filter( $ids ) );
	}

	/**
	 * Mirror of Preview_Endpoint's response packaging, factored out so the
	 * album endpoint produces the same shape.
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
	 * Stamp the page-builder fields onto a render-payload response.
	 *
	 * @since 1.0.0
	 * @param array  $payload    Existing response data.
	 * @param string $kind       'gallery' | 'album'.
	 * @param int    $object_id  Gallery / album ID.
	 * @return array
	 */
	private static function merge_page_builder_meta( array $payload, string $kind, int $object_id ): array {
		$requires_pro = 'album' === $kind
			? Pro_Guard::album_requires_pro( $object_id )
			: Pro_Guard::gallery_requires_pro( $object_id );

		$payload['page_builders'] = array(
			'requires_pro'  => $requires_pro,
			'license_state' => self::current_license_state(),
		);
		return $payload;
	}

	/**
	 * Topo-sorted serialisation of enqueued JS handles. Same logic as the
	 * existing Preview_Endpoint - kept in sync deliberately so both
	 * endpoints produce identical client-side wiring.
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

	/**
	 * Current user's license state, in the 'active' | 'lapsed' | 'none'
	 * vocabulary the JS pro-guard expects.
	 *
	 * Mirrors `Access_State::resolve()` semantics without coupling this
	 * module to that resolver - we want a single flat string for the
	 * client, not a tier-based state.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	private static function current_license_state(): string {
		if ( ! class_exists( License_Manager::class ) ) {
			return 'none';
		}
		if ( License_Manager::is_pro_active() ) {
			return 'active';
		}
		// No active license: any saved license_key in the local table counts
		// as "ever had Pro" and maps to 'lapsed'; otherwise 'none'.
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_licenses';
		// Defensive: the licenses table may not exist on very fresh installs.
		// suppress_errors() blocks the wpdb error from polluting the response.
		$previous = $wpdb->suppress_errors( true );
		$count    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
		$wpdb->suppress_errors( $previous );

		return $count > 0 ? 'lapsed' : 'none';
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
