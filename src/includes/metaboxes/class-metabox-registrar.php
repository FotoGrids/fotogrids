<?php
/**
 * Registers the gallery / album / album-assignment metaboxes and their assets.
 *
 * @package FotoGrids\Metaboxes
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Metaboxes;

use FotoGrids\Admin\Settings_Localizer;
use FotoGrids\Assets\Collection_Settings_Assets;
use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Permissions\Permission_Check;
use FotoGrids\Permissions\Permission_Gate;
use FotoGrids\Permissions\Permission_Options;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Pure UI shell + asset-enqueue layer for the post-edit metaboxes.
 *
 * No save logic and no AJAX endpoints live here. The save path lives in
 * `Collection_Save_Pipeline`; the per-item AJAX endpoints live in
 * `Item_Ajax_Endpoints`.
 *
 * @since 1.0.0
 */
final class Metabox_Registrar {

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
	 * Wire the WP hooks owned by this layer.
	 *
	 * Called once per request from `Modules\Metaboxes\Module::init()`.
	 *
	 * @since 1.0.0
	 */
	public static function init(): void {
		add_action( 'add_meta_boxes', array( __CLASS__, 'register_metaboxes' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );

		// Runs after every other plugin's add_meta_boxes registration (incl.
		// SEO plugins that register their box into normal/high). Physically
		// moves the FotoGrids boxes to the front of the normal/high bucket,
		// which do_meta_boxes() renders before any other priority bucket.
		add_action( 'add_meta_boxes', array( __CLASS__, 'force_metabox_priority' ), 9999 );

		// do_meta_boxes() renders a user's saved drag order in the `sorted`
		// slot, which sits between `high` and the rest and would otherwise pull
		// boxes out of `high` and reorder them - defeating the rewrite above.
		// Disable the saved order on the FotoGrids screens so the forced
		// `high`-bucket order governs.
		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			add_filter(
				"get_user_option_meta-box-order_{$post_type}",
				'__return_empty_array'
			);
		}
	}

	/**
	 * Reorder the global metabox store so the FotoGrids boxes lead both the
	 * `normal` and `side` contexts on the gallery / album edit screens.
	 *
	 * The `meta-box-order` user-option only orders boxes *within* a priority
	 * bucket, so a third-party box registered into `high` can still render
	 * above ours. This runs at a late `add_meta_boxes` priority and rewrites
	 * `$wp_meta_boxes` directly: every FotoGrids box in a context is collected,
	 * promoted into the `high` bucket, and placed ahead of all other `high`
	 * boxes. Other boxes keep their original bucket and relative order.
	 *
	 * @since  1.0.0
	 * @param  \WP_Post|string $post_or_type The post object or post-type slug
	 *                                       WordPress passes to add_meta_boxes.
	 * @return void
	 */
	public static function force_metabox_priority( $post_or_type ): void {
		$screen = $post_or_type instanceof \WP_Post ? $post_or_type->post_type : (string) $post_or_type;

		if ( ! in_array( $screen, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
			return;
		}

		$normal_lead = 'fotogrids_album' === $screen ? 'fotogrids_album_galleries' : 'fotogrids_gallery_items';

		self::pin_context_to_top(
			$screen,
			'normal',
			array( $normal_lead, 'fotogrids_collection_settings' )
		);

		self::pin_context_to_top(
			$screen,
			'side',
			array( 'fotogrids_gallery_shortcode', 'fotogrids_album_shortcode', 'fotogrids_gallery_albums' )
		);
	}

	/**
	 * Move every FotoGrids box in one context to the front of its `high`
	 * bucket, in the given lead order, leaving third-party boxes in place.
	 *
	 * @since  1.0.0
	 * @param  string   $screen   Post-type screen id.
	 * @param  string   $context  Metabox context ('normal' | 'side').
	 * @param  string[] $lead_ids FotoGrids box ids in the order they should
	 *                            lead. Ids absent from this screen are ignored;
	 *                            any FotoGrids box not listed follows them.
	 * @return void
	 */
	private static function pin_context_to_top( string $screen, string $context, array $lead_ids ): void {
		global $wp_meta_boxes;

		if ( empty( $wp_meta_boxes[ $screen ][ $context ] ) || ! is_array( $wp_meta_boxes[ $screen ][ $context ] ) ) {
			return;
		}

		$ours   = array();
		$others = array();

		foreach ( $wp_meta_boxes[ $screen ][ $context ] as $bucket => $boxes ) {
			if ( ! is_array( $boxes ) ) {
				continue;
			}
			foreach ( $boxes as $box_id => $box ) {
				if ( strpos( (string) $box_id, 'fotogrids_' ) === 0 ) {
					$ours[ $box_id ] = $box;
				} else {
					$others[ $box_id ] = array(
						'bucket' => $bucket,
						'box'    => $box,
					);
				}
			}
		}

		if ( empty( $ours ) ) {
			return;
		}

		$ordered_ours = array();
		foreach ( $lead_ids as $box_id ) {
			if ( isset( $ours[ $box_id ] ) ) {
				$ordered_ours[ $box_id ] = $ours[ $box_id ];
				unset( $ours[ $box_id ] );
			}
		}
		// Any remaining FotoGrids boxes (e.g. a Pro module box) follow, ahead
		// of third-party boxes.
		foreach ( $ours as $box_id => $box ) {
			$ordered_ours[ $box_id ] = $box;
		}

		$rebuilt = array(
			'high'    => array(),
			'core'    => array(),
			'default' => array(),
			'low'     => array(),
		);

		foreach ( $ordered_ours as $box_id => $box ) {
			$rebuilt['high'][ $box_id ] = $box;
		}

		foreach ( $others as $box_id => $entry ) {
			$bucket                        = isset( $rebuilt[ $entry['bucket'] ] ) ? $entry['bucket'] : 'default';
			$rebuilt[ $bucket ][ $box_id ] = $entry['box'];
		}

		$wp_meta_boxes[ $screen ][ $context ] = array_filter( $rebuilt ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Intentional metabox-order override on FotoGrids edit screens.
	}

	/**
	 * Register the gallery items, collection settings, and gallery-albums
	 * metaboxes. The Templates metabox is registered by the Templates module.
	 *
	 * @since 1.0.0
	 */
	public static function register_metaboxes(): void {
		add_meta_box(
			'fotogrids_gallery_items',
			__( 'Gallery Items', 'fotogrids' ),
			array( __CLASS__, 'render_gallery_items' ),
			'fotogrids_gallery',
			'normal',
			'high'
		);

		global $post;

		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			// Apply the per-CPT settings cap. When the user lacks it:
			//   - 'hidden'   -> skip add_meta_box entirely.
			//   - 'readonly' -> register normally; the React app reads the
			//                   `editable=false` flag from the localised
			//                   data and disables every control.
			$settings_cap = Permission_Gate::settings_cap_for( $post_type );
			$post_id      = ( $post instanceof \WP_Post && $post->post_type === $post_type ) ? (int) $post->ID : 0;
			$can_settings = null === $settings_cap
				|| ( $post_id > 0
					? Permission_Check::can( $settings_cap, $post_id )
					: Permission_Check::can( $settings_cap ) );

			if ( ! $can_settings && Permission_Options::get_unauthorised_visibility() === 'hidden' ) {
				continue;
			}

			$title = 'fotogrids_gallery' === $post_type
				? __( 'Gallery Settings', 'fotogrids' )
				: __( 'Album Settings', 'fotogrids' );

			add_meta_box(
				'fotogrids_collection_settings',
				$title,
				array( __CLASS__, 'render_collection_settings' ),
				$post_type,
				'normal',
				'high'
			);
		}

		add_meta_box(
			'fotogrids_gallery_albums',
			__( 'Album Assignment', 'fotogrids' ),
			array( __CLASS__, 'render_gallery_albums' ),
			'fotogrids_gallery',
			'side',
			'default'
		);
	}

	/**
	 * Enqueue scripts + styles for the gallery / album edit screens.
	 *
	 * Bails on non-FotoGrids post types and non-edit screens so it never
	 * pollutes the wider wp-admin.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin hook (e.g. 'post.php').
	 */
	public static function enqueue_assets( $hook ): void {
		global $post_type;

		if ( ! in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ), true ) ) {
			return;
		}

		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_script( 'jquery-ui-sortable' );

		wp_enqueue_script(
			'fotogrids-featured-image-picker',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/featured-image-picker.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		wp_localize_script(
			'fotogrids-featured-image-picker',
			'fotogridsFeaturedImage',
			array(
				'frameTitle'  => __( 'Featured / Share Image', 'fotogrids' ),
				'frameButton' => __( 'Use this image', 'fotogrids' ),
				'set'         => __( 'Set featured image', 'fotogrids' ),
				'replace'     => __( 'Replace image', 'fotogrids' ),
			)
		);

		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-i18n' );

		Collection_Settings_Assets::enqueue( true );

		wp_enqueue_script(
			'fotogrids-metabox',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/metabox.js',
			array( 'wp-element', 'wp-components', 'wp-i18n', 'wp-media-utils', 'jquery', 'jquery-ui-sortable', 'fotogrids-icons' ),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_script(
			'fotogrids-collection-state-manager',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/collection-state-manager.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_script(
			'fotogrids-ajax-save',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/ajax-save.js',
			array( 'jquery', 'fotogrids-collection-state-manager' ),
			FOTOGRIDS_VERSION,
			true
		);

		wp_localize_script(
			'fotogrids-ajax-save',
			'fotogridsAjaxSave',
			array(
				'strings' => array(
					'savingGallery'             => __( 'Saving gallery...', 'fotogrids' ),
					'gallerySavedSuccessfully'  => __( 'Gallery saved successfully!', 'fotogrids' ),
					'saveFailed'                => __( 'Save failed. Please try again.', 'fotogrids' ),
					'fixValidationErrors'       => __( 'Please fix validation errors before saving.', 'fotogrids' ),
					'fixErrors'                 => __( 'Fix Errors', 'fotogrids' ),
					'pleaseFixValidationErrors' => __( 'Please fix validation errors before saving', 'fotogrids' ),
					'youHaveUnsavedChanges'     => __( 'You have unsaved changes', 'fotogrids' ),
					'lastSaved'                 => __( 'Last saved', 'fotogrids' ),
					'quickSave'                 => __( 'Quick Save', 'fotogrids' ),
					'quickSaveGallery'          => __( 'Quick Save Gallery (Ctrl+S)', 'fotogrids' ),
					'editGallery'               => __( 'Edit Gallery', 'fotogrids' ),
					'editAlbum'                 => __( 'Edit Album', 'fotogrids' ),
					'unsavedChangesConfirm'     => __( 'You have unsaved changes. Are you sure you want to leave?', 'fotogrids' ),
				),
			)
		);

		if ( 'fotogrids_gallery' === $post_type ) {
			wp_enqueue_script(
				'fotogrids-album-assignment',
				FOTOGRIDS_PLUGIN_URL . 'assets/js/album-assignment.js',
				array( 'wp-element', 'wp-api-fetch', 'fotogrids-ajax-save' ),
				FOTOGRIDS_VERSION,
				true
			);
		}

		if ( 'fotogrids_album' === $post_type ) {
			self::enqueue_album_galleries_script();
		}
	}

	/**
	 * Render the "Gallery Items" metabox shell + localise its React payload.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Current post (gallery).
	 */
	public static function render_gallery_items( $post ): void {
		wp_nonce_field( 'fotogrids_meta_box', 'fotogrids_meta_box_nonce' );

		$gallery_items = get_post_meta( $post->ID, 'fotogrids_gallery_items', true );
		$gallery_items = $gallery_items ? json_decode( $gallery_items, true ) : array();

		// Source of truth for the cover image is WP's native post thumbnail.
		// The runtime resolver (`Cover_Resolver::for_gallery()`) falls back to
		// the first valid item when nothing is explicitly set, so `_thumbnail_id`
		// is not seeded here - the UI shows a "no item is explicitly
		// featured" state until the user clicks a star.
		$featured_item_id = (int) get_post_thumbnail_id( $post->ID );

		// The item list holds attachment IDs and embed post IDs interleaved in
		// display order. Build each item by branching on its post type.
		$items_data = array();
		foreach ( (array) $gallery_items as $item_id ) {
			$item_id = (int) $item_id;
			if ( \FotoGrids\Galleries\Embed_Store::is_embed( $item_id ) ) {
				$embed_item = self::build_embed_item_data( $item_id, $featured_item_id );
				if ( null !== $embed_item ) {
					$items_data[] = $embed_item;
				}
				continue;
			}
			$item_data = self::build_attachment_item_data( $item_id, $featured_item_id );
			if ( null !== $item_data ) {
				$items_data[] = $item_data;
			}
		}

		wp_localize_script(
			'fotogrids-metabox',
			'fotogridsMetaBoxes',
			array(
				'galleryItems' => $items_data,
				'canEditPosts' => current_user_can( 'edit_posts' ),
				'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
				'nonce'        => wp_create_nonce( 'fotogrids_item_edit' ),
				'restNonce'    => wp_create_nonce( 'wp_rest' ),
				'postId'       => $post->ID,
				'strings'      => Metabox_Strings::all(),
			)
		);

		?>
		<div id="fotogrids-gallery-metabox-root"></div>
		<?php
	}

	/**
	 * Build the metabox grid payload for one attachment item.
	 *
	 * Handles both image and Media Library video attachments. Videos resolve
	 * their grid thumbnail through the poster chain instead of an image URL, so
	 * they survive a reload.
	 *
	 * @since 1.1.0
	 * @param int $item_id          The attachment ID.
	 * @param int $featured_item_id The gallery's featured attachment ID, or 0.
	 * @return array<string, mixed>|null Item payload, or null if the attachment no longer exists.
	 */
	private static function build_attachment_item_data( int $item_id, int $featured_item_id ): ?array {
		$attachment = get_post( $item_id );
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return null;
		}

		$item_type  = \FotoGrids\Render\Video\Video_Item_Helpers::type_for_attachment( $item_id );
		$is_video   = \FotoGrids\Render\Video\Video_Item_Helpers::TYPE_FILE === $item_type;
		$item_title = get_the_title( $item_id );
		$item_alt   = get_post_meta( $item_id, '_wp_attachment_image_alt', true );

		if ( $is_video ) {
			$custom_data = self::get_item_custom_data( $item_id );
			$poster      = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
				$item_type,
				$item_id,
				$custom_data,
				'thumbnail'
			);

			return array(
				'id'        => $item_id,
				'title'     => $item_title ? $item_title : 'Untitled',
				'url'       => (string) ( wp_get_attachment_url( $item_id ) ?: '' ),
				'thumbnail' => $poster,
				'alt'       => $item_alt ? $item_alt : ( $item_title ? $item_title : '' ),
				'featured'  => ( $featured_item_id > 0 && $item_id === $featured_item_id ),
				'item_type' => $item_type,
			);
		}

		$item_url      = wp_get_attachment_image_url( $item_id, 'full' );
		$thumbnail_url = wp_get_attachment_image_url( $item_id, 'thumbnail' );

		if ( ! $item_url ) {
			return null;
		}

		return array(
			'id'        => $item_id,
			'title'     => $item_title ? $item_title : 'Untitled',
			'url'       => $item_url,
			'thumbnail' => $thumbnail_url ? $thumbnail_url : $item_url,
			'alt'       => $item_alt ? $item_alt : ( $item_title ? $item_title : '' ),
			'featured'  => ( $featured_item_id > 0 && $item_id === $featured_item_id ),
			'item_type' => $item_type,
		);
	}

	/**
	 * Build the metabox grid payload for one embed post.
	 *
	 * @since 1.1.0
	 * @param int $embed_id         The fotogrids_embed post ID.
	 * @param int $featured_item_id The gallery's featured item ID, or 0.
	 * @return array<string, mixed>|null Item payload, or null if not an embed.
	 */
	private static function build_embed_item_data( int $embed_id, int $featured_item_id ): ?array {
		$embed = \FotoGrids\Galleries\Embed_Store::get( $embed_id );
		if ( null === $embed ) {
			return null;
		}

		$item_type   = (string) $embed['item_type'];
		$custom_data = self::embed_to_custom_data( $embed );
		$poster      = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
			$item_type,
			0,
			$custom_data,
			'thumbnail'
		);
		$caption     = (string) $embed['caption'];

		return array(
			'id'        => $embed_id,
			'title'     => $caption ? $caption : 'Video',
			'url'       => (string) $embed['url'],
			'thumbnail' => $poster,
			'alt'       => $caption,
			'featured'  => ( $featured_item_id > 0 && $embed_id === $featured_item_id ),
			'item_type' => $item_type,
			'source'    => \FotoGrids\Render\Video\Video_Item_Helpers::provider_for_type( $item_type ),
			// Full embed payload so the edit modal can prefill without an extra
			// round-trip.
			'embed'     => array(
				'caption'       => $caption,
				'embed_url'     => (string) $embed['url'],
				'video_id'      => (string) $embed['video_id'],
				'thumbnail_url' => $poster,
				'settings'      => $custom_data,
			),
		);
	}

	/**
	 * Flatten an Embed_Store record into the custom_data-shaped array the admin
	 * grid + edit modal expect.
	 *
	 * @since 1.1.0
	 * @param array<string, mixed> $embed Embed_Store::get() result.
	 * @return array<string, mixed>
	 */
	private static function embed_to_custom_data( array $embed ): array {
		$out = array_merge(
			array(
				'embed_url'     => $embed['url'] ?? '',
				'video_id'      => $embed['video_id'] ?? '',
				'thumbnail_url' => $embed['thumbnail_url'] ?? '',
			),
			is_array( $embed['settings'] ?? null ) ? $embed['settings'] : array()
		);
		if ( ! empty( $embed['poster_id'] ) ) {
			$out['poster_id'] = (int) $embed['poster_id'];
		}
		if ( ! empty( $embed['poster_url'] ) ) {
			$out['poster_url'] = (string) $embed['poster_url'];
		}
		return $out;
	}

	/**
	 * Read and decode the custom_data JSON for an item.
	 *
	 * @since 1.1.0
	 * @param int $attachment_id The attachment ID.
	 * @return array<string, mixed> Decoded custom_data, or empty array.
	 */
	private static function get_item_custom_data( int $attachment_id ): array {
		$row = \FotoGrids\Galleries\Item_Meta::get( $attachment_id );
		if ( null === $row || empty( $row['custom_data'] ) ) {
			return array();
		}

		$decoded = json_decode( (string) $row['custom_data'], true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Render the "Collection Settings" metabox shell (galleries + albums).
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Current post.
	 */
	public static function render_collection_settings( $post ): void {
		wp_nonce_field( 'fotogrids_meta_box', 'fotogrids_meta_box_nonce' );

		$localized_data = Settings_Localizer::data_for_collection(
			array(
				'post_id'     => $post->ID,
				'post_type'   => $post->post_type,
				'is_defaults' => false,
			)
		);

		// Settings-cap gating. When the user lacks the per-CPT settings cap,
		// ship editable=false so the React tree renders read-only. The
		// server-side Permission_Gate is the safety net if anything writes.
		$settings_cap                         = Permission_Gate::settings_cap_for( $post->post_type );
		$localized_data['editable']           = null === $settings_cap
			|| Permission_Check::can( $settings_cap, (int) $post->ID );
		$localized_data['unauthorisedNotice'] = __( 'You\'re viewing these settings in read-only mode. Ask a site administrator if changes are needed.', 'fotogrids' );

		wp_localize_script( 'fotogrids-collection-settings', 'fotogridsSettings', $localized_data );
		?>
		<div id="fotogrids-collection-settings-root"></div>
		<?php
	}

	/**
	 * Render the gallery → albums assignment sidebar metabox.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Current post (gallery).
	 */
	public static function render_gallery_albums( $post ): void {
		wp_nonce_field( 'fotogrids_gallery_albums', 'fotogrids_gallery_albums_nonce' );

		$assigned_albums = Gallery_Album_Relations::get_albums_for_gallery( $post->ID );
		$all_albums      = Gallery_Album_Relations::get_all_albums();

		wp_localize_script(
			'fotogrids-album-assignment',
			'fotogridsAlbumAssignment',
			array(
				'postId'         => $post->ID,
				'assignedAlbums' => $assigned_albums,
				'allAlbums'      => $all_albums,
				'nonce'          => wp_create_nonce( 'wp_rest' ),
				'restUrl'        => 'fotogrids/v1/',
				'strings'        => array(
					'searchPlaceholder'      => __( 'Search albums...', 'fotogrids' ),
					'noAvailableAlbumsFound' => __( 'No available albums found', 'fotogrids' ),
					'noMoreAlbumsFound'      => __( 'No more albums found', 'fotogrids' ),
					'createNewAlbum'         => __( 'Create New Album', 'fotogrids' ),
					'assignedTo'             => __( 'Assigned to', 'fotogrids' ),
					'notAssignedTo'          => __( 'Not assigned to any', 'fotogrids' ),
					'albums'                 => __( 'albums', 'fotogrids' ),
					'loading'                => __( 'Loading...', 'fotogrids' ),
					'error'                  => __( 'Error loading albums', 'fotogrids' ),
					'saved'                  => __( 'Album assignments saved', 'fotogrids' ),
				),
			)
		);
		?>
		<div id="fotogrids-gallery-albums-root">
			<!-- React Album Assignment component will mount here -->
			<?php \FotoGrids\Admin\Loading_Indicator::render( __( 'Loading albums...', 'fotogrids' ) ); ?>
		</div>
		<?php
	}

	/**
	 * Album → galleries metabox script (sidebar on album edit screen).
	 *
	 * Pulled out of `enqueue_assets()` to keep that method readable.
	 *
	 * @since 1.0.0
	 */
	private static function enqueue_album_galleries_script(): void {
		wp_enqueue_script(
			'fotogrids-album-galleries',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/album-galleries.js',
			array( 'wp-element', 'wp-api-fetch' ),
			FOTOGRIDS_VERSION,
			true
		);

		global $post;
		if ( ! ( $post instanceof \WP_Post ) || 'fotogrids_album' !== $post->post_type ) {
			return;
		}

		$assigned_galleries  = Gallery_Album_Relations::get_galleries_for_album( $post->ID );
		$all_galleries       = Gallery_Album_Relations::get_all_galleries();
		$featured_gallery_id = (int) get_post_meta( $post->ID, 'fotogrids_featured_gallery', true );

		wp_localize_script(
			'fotogrids-album-galleries',
			'fotogridsAlbumGalleries',
			array(
				'postId'            => $post->ID,
				'assignedGalleries' => $assigned_galleries,
				'allGalleries'      => $all_galleries,
				'featuredGalleryId' => $featured_gallery_id > 0 ? $featured_gallery_id : null,
				'nonce'             => wp_create_nonce( 'wp_rest' ),
				'restUrl'           => 'fotogrids/v1/',
				'strings'           => array(
					'assignedGalleries'      => __( 'Assigned Galleries', 'fotogrids' ),
					'availableGalleries'     => __( 'Available Galleries', 'fotogrids' ),
					'searchPlaceholder'      => __( 'Search Galleries...', 'fotogrids' ),
					'noGalleriesAssigned'    => __( 'No Galleries assigned to this Album', 'fotogrids' ),
					'noGalleriesAvailable'   => __( 'No available Galleries found', 'fotogrids' ),
					'dragToReorder'          => __( 'Drag to reorder Galleries', 'fotogrids' ),
					'removeFromAlbum'        => __( 'Remove from Album', 'fotogrids' ),
					'addToAlbum'             => __( 'Add to Album', 'fotogrids' ),
					'setAsFeatured'          => __( 'Set as featured Gallery', 'fotogrids' ),
					'clearFeatured'          => __( 'Clear featured Gallery', 'fotogrids' ),
					'featuredGallerySet'     => __( 'Featured Gallery set', 'fotogrids' ),
					'featuredGalleryCleared' => __( 'Featured Gallery cleared', 'fotogrids' ),
					'errorSavingFeatured'    => __( 'Error saving featured Gallery', 'fotogrids' ),
					'viewGallery'            => __( 'View Gallery', 'fotogrids' ),
					'editGallery'            => __( 'Edit Gallery', 'fotogrids' ),
					'loading'                => __( 'Loading...', 'fotogrids' ),
					'saved'                  => __( 'Gallery assignments saved', 'fotogrids' ),
					'error'                  => __( 'Error updating Album', 'fotogrids' ),
					'items'                  => __( 'items', 'fotogrids' ),
					'noItems'                => __( 'No items', 'fotogrids' ),
					'galleryTitleMissing'    => __( 'Gallery Title Missing', 'fotogrids' ),
					'dropItemHere'           => __( 'Drop item here', 'fotogrids' ),
				),
			)
		);
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
