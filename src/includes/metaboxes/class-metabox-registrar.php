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

    /**
     * Wire the WP hooks owned by this layer.
     *
     * Called once per request from `Modules\Metaboxes\Module::init()`.
     *
     * @since 1.0.0
     */
    public static function init(): void {
        add_action( 'add_meta_boxes', [ __CLASS__, 'register_metaboxes' ] );
        add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
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
            [ __CLASS__, 'render_gallery_items' ],
            'fotogrids_gallery',
            'normal',
            'high'
        );

        global $post;

        foreach ( [ 'fotogrids_gallery', 'fotogrids_album' ] as $post_type ) {
            // Apply the per-CPT settings cap. When the user lacks it:
            //   - 'hidden'   -> skip add_meta_box entirely.
            //   - 'readonly' -> register normally; the React app reads the
            //                   `editable=false` flag from the localised
            //                   data and disables every control.
            $settings_cap = Permission_Gate::settings_cap_for( $post_type );
            $post_id      = ( $post instanceof \WP_Post && $post->post_type === $post_type ) ? (int) $post->ID : 0;
            $can_settings = $settings_cap === null
                || ( $post_id > 0
                    ? Permission_Check::can( $settings_cap, $post_id )
                    : Permission_Check::can( $settings_cap ) );

            if ( ! $can_settings && Permission_Options::get_unauthorised_visibility() === 'hidden' ) {
                continue;
            }

            $title = $post_type === 'fotogrids_gallery'
                ? __( 'Gallery Settings', 'fotogrids' )
                : __( 'Album Settings', 'fotogrids' );

            add_meta_box(
                'fotogrids_collection_settings',
                $title,
                [ __CLASS__, 'render_collection_settings' ],
                $post_type,
                'normal',
                'default'
            );
        }

        add_meta_box(
            'fotogrids_gallery_albums',
            __( 'Album Assignment', 'fotogrids' ),
            [ __CLASS__, 'render_gallery_albums' ],
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

        if ( ! in_array( $post_type, [ 'fotogrids_gallery', 'fotogrids_album' ], true ) ) {
            return;
        }

        if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_script( 'jquery-ui-sortable' );

        wp_enqueue_script( 'wp-element' );
        wp_enqueue_script( 'wp-components' );
        wp_enqueue_script( 'wp-i18n' );

        Collection_Settings_Assets::enqueue( true, true );

        wp_enqueue_script(
            'fotogrids-metabox',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/metabox.js',
            [ 'wp-element', 'wp-components', 'wp-i18n', 'jquery', 'jquery-ui-sortable', 'fotogrids-icons' ],
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-collection-state-manager',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/collection-state-manager.js',
            [],
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-ajax-save',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/ajax-save.js',
            [ 'jquery', 'fotogrids-collection-state-manager' ],
            FOTOGRIDS_VERSION,
            true
        );

        wp_localize_script( 'fotogrids-ajax-save', 'fotogridsAjaxSave', [
            'strings' => [
                'savingGallery'              => __( 'Saving gallery...', 'fotogrids' ),
                'gallerySavedSuccessfully'   => __( 'Gallery saved successfully!', 'fotogrids' ),
                'saveFailed'                 => __( 'Save failed. Please try again.', 'fotogrids' ),
                'fixValidationErrors'        => __( 'Please fix validation errors before saving.', 'fotogrids' ),
                'fixErrors'                  => __( 'Fix Errors', 'fotogrids' ),
                'pleaseFixValidationErrors'  => __( 'Please fix validation errors before saving', 'fotogrids' ),
                'youHaveUnsavedChanges'      => __( 'You have unsaved changes', 'fotogrids' ),
                'lastSaved'                  => __( 'Last saved', 'fotogrids' ),
                'quickSave'                  => __( 'Quick Save', 'fotogrids' ),
                'quickSaveGallery'           => __( 'Quick Save Gallery (Ctrl+S)', 'fotogrids' ),
                'editGallery'                => __( 'Edit Gallery', 'fotogrids' ),
                'editAlbum'                  => __( 'Edit Album', 'fotogrids' ),
                'unsavedChangesConfirm'      => __( 'You have unsaved changes. Are you sure you want to leave?', 'fotogrids' ),
            ],
        ] );

        if ( $post_type === 'fotogrids_gallery' ) {
            wp_enqueue_script(
                'fotogrids-album-assignment',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/album-assignment.js',
                [ 'wp-element', 'wp-api-fetch', 'fotogrids-ajax-save' ],
                FOTOGRIDS_VERSION,
                true
            );
        }

        if ( $post_type === 'fotogrids_album' ) {
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
        $gallery_items = $gallery_items ? json_decode( $gallery_items, true ) : [];

        // Source of truth for the cover image is WP's native post thumbnail.
        // The runtime resolver (`Cover_Resolver::for_gallery()`) falls back to
        // the first valid item when nothing is explicitly set, so we don't
        // seed `_thumbnail_id` here — the UI shows a "no item is explicitly
        // featured" state until the user clicks a star.
        $featured_item_id = (int) get_post_thumbnail_id( $post->ID );

        // The item list holds attachment IDs and embed post IDs interleaved in
        // display order. Build each item by branching on its post type.
        $items_data = [];
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

        wp_localize_script( 'fotogrids-metabox', 'fotogridsMetaBoxes', [
            'galleryItems' => $items_data,
            'canEditPosts' => current_user_can( 'edit_posts' ),
            'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
            'nonce'        => wp_create_nonce( 'fotogrids_item_edit' ),
            'restNonce'    => wp_create_nonce( 'wp_rest' ),
            'postId'       => $post->ID,
            'strings'      => self::common_metabox_strings(),
        ] );

        ?>
        <div id="fotogrids-gallery-metabox-root"></div>
        <?php
    }

    /**
     * Build the metabox grid payload for one attachment item.
     *
     * Handles both image and Media Library video attachments. Videos resolve
     * their grid thumbnail through the poster chain instead of an image URL, so
     * they survive a reload (previously they were dropped when
     * wp_get_attachment_image_url returned false for a video).
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
            // Per-attachment item data (incl. any custom poster) is stored in
            // the global gallery_id = 0 row, mirroring the item edit modal.
            $custom_data = self::get_item_custom_data( $item_id, 0 );
            $poster      = \FotoGrids\Render\Video\Video_Poster_Resolver::resolve(
                $item_type,
                $item_id,
                $custom_data,
                'thumbnail'
            );

            return [
                'id'        => $item_id,
                'title'     => $item_title ?: 'Untitled',
                'url'       => (string) ( wp_get_attachment_url( $item_id ) ?: '' ),
                'thumbnail' => $poster,
                'alt'       => $item_alt ?: $item_title ?: '',
                'featured'  => ( $featured_item_id > 0 && $item_id === $featured_item_id ),
                'item_type' => $item_type,
            ];
        }

        $item_url      = wp_get_attachment_image_url( $item_id, 'full' );
        $thumbnail_url = wp_get_attachment_image_url( $item_id, 'thumbnail' );

        if ( ! $item_url ) {
            return null;
        }

        return [
            'id'        => $item_id,
            'title'     => $item_title ?: 'Untitled',
            'url'       => $item_url,
            'thumbnail' => $thumbnail_url ?: $item_url,
            'alt'       => $item_alt ?: $item_title ?: '',
            'featured'  => ( $featured_item_id > 0 && $item_id === $featured_item_id ),
            'item_type' => $item_type,
        ];
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
        $caption = (string) $embed['caption'];

        return [
            'id'        => $embed_id,
            'title'     => $caption ?: 'Video',
            'url'       => (string) $embed['url'],
            'thumbnail' => $poster,
            'alt'       => $caption,
            'featured'  => ( $featured_item_id > 0 && $embed_id === $featured_item_id ),
            'item_type' => $item_type,
            'source'    => \FotoGrids\Render\Video\Video_Item_Helpers::provider_for_type( $item_type ),
            // Full embed payload so the edit modal can prefill without an extra
            // round-trip.
            'embed'     => [
                'caption'       => $caption,
                'embed_url'     => (string) $embed['url'],
                'video_id'      => (string) $embed['video_id'],
                'thumbnail_url' => $poster,
                'settings'      => $custom_data,
            ],
        ];
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
     * Read and decode the custom_data JSON for an item row.
     *
     * @since 1.1.0
     * @param int $attachment_id The attachment ID (0 for embeds).
     * @param int $gallery_id    The gallery scope for the row.
     * @return array<string, mixed> Decoded custom_data, or empty array.
     */
    private static function get_item_custom_data( int $attachment_id, int $gallery_id ): array {
        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $raw = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT custom_data FROM {$table}
                 WHERE attachment_id = %d AND gallery_id = %d
                 LIMIT 1",
                $attachment_id,
                $gallery_id
            )
        );

        if ( empty( $raw ) ) {
            return [];
        }

        $decoded = json_decode( (string) $raw, true );
        return is_array( $decoded ) ? $decoded : [];
    }

    /**
     * Render the "Collection Settings" metabox shell (galleries + albums).
     *
     * @since 1.0.0
     * @param \WP_Post $post Current post.
     */
    public static function render_collection_settings( $post ): void {
        wp_nonce_field( 'fotogrids_meta_box', 'fotogrids_meta_box_nonce' );

        $localized_data = Settings_Localizer::data_for_collection( [
            'post_id'     => $post->ID,
            'post_type'   => $post->post_type,
            'is_defaults' => false,
        ] );

        // Settings-cap gating. When the user lacks the per-CPT settings cap,
        // ship editable=false so the React tree renders read-only. The
        // server-side Permission_Gate is the safety net if anything writes.
        $settings_cap = Permission_Gate::settings_cap_for( $post->post_type );
        $localized_data['editable']           = $settings_cap === null
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

        wp_localize_script( 'fotogrids-album-assignment', 'fotogridsAlbumAssignment', [
            'postId'          => $post->ID,
            'assignedAlbums'  => $assigned_albums,
            'allAlbums'       => $all_albums,
            'nonce'           => wp_create_nonce( 'wp_rest' ),
            'restUrl'         => 'fotogrids/v1/',
            'strings'         => [
                'searchPlaceholder'       => __( 'Search albums...', 'fotogrids' ),
                'noAvailableAlbumsFound'  => __( 'No available albums found', 'fotogrids' ),
                'noMoreAlbumsFound'       => __( 'No more albums found', 'fotogrids' ),
                'createNewAlbum'          => __( 'Create New Album', 'fotogrids' ),
                'assignedTo'              => __( 'Assigned to', 'fotogrids' ),
                'notAssignedTo'           => __( 'Not assigned to any', 'fotogrids' ),
                'albums'                  => __( 'albums', 'fotogrids' ),
                'loading'                 => __( 'Loading...', 'fotogrids' ),
                'error'                   => __( 'Error loading albums', 'fotogrids' ),
                'saved'                   => __( 'Album assignments saved', 'fotogrids' ),
            ],
        ] );
        ?>
        <div id="fotogrids-gallery-albums-root">
            <!-- React Album Assignment component will mount here -->
            <div class="fotogrids-loading">
                <span class="spinner fg-is-active"></span>
                <?php esc_html_e( 'Loading albums...', 'fotogrids' ); ?>
            </div>
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
            [ 'wp-element', 'wp-api-fetch' ],
            FOTOGRIDS_VERSION,
            true
        );

        global $post;
        if ( ! ( $post instanceof \WP_Post ) || $post->post_type !== 'fotogrids_album' ) {
            return;
        }

        $assigned_galleries  = Gallery_Album_Relations::get_galleries_for_album( $post->ID );
        $all_galleries       = Gallery_Album_Relations::get_all_galleries();
        $featured_gallery_id = (int) get_post_meta( $post->ID, 'fotogrids_featured_gallery', true );

        wp_localize_script( 'fotogrids-album-galleries', 'fotogridsAlbumGalleries', [
            'postId'             => $post->ID,
            'assignedGalleries'  => $assigned_galleries,
            'allGalleries'       => $all_galleries,
            'featuredGalleryId'  => $featured_gallery_id > 0 ? $featured_gallery_id : null,
            'nonce'              => wp_create_nonce( 'wp_rest' ),
            'restUrl'            => 'fotogrids/v1/',
            'strings'            => [
                'assignedGalleries'       => __( 'Assigned Galleries', 'fotogrids' ),
                'availableGalleries'      => __( 'Available Galleries', 'fotogrids' ),
                'searchPlaceholder'       => __( 'Search Galleries...', 'fotogrids' ),
                'noGalleriesAssigned'     => __( 'No Galleries assigned to this Album', 'fotogrids' ),
                'noGalleriesAvailable'    => __( 'No available Galleries found', 'fotogrids' ),
                'dragToReorder'           => __( 'Drag to reorder Galleries', 'fotogrids' ),
                'removeFromAlbum'         => __( 'Remove from Album', 'fotogrids' ),
                'addToAlbum'              => __( 'Add to Album', 'fotogrids' ),
                'setAsFeatured'           => __( 'Set as featured Gallery', 'fotogrids' ),
                'clearFeatured'           => __( 'Clear featured Gallery', 'fotogrids' ),
                'featuredGallerySet'      => __( 'Featured Gallery set', 'fotogrids' ),
                'featuredGalleryCleared'  => __( 'Featured Gallery cleared', 'fotogrids' ),
                'errorSavingFeatured'     => __( 'Error saving featured Gallery', 'fotogrids' ),
                'viewGallery'             => __( 'View Gallery', 'fotogrids' ),
                'editGallery'             => __( 'Edit Gallery', 'fotogrids' ),
                'loading'                 => __( 'Loading...', 'fotogrids' ),
                'saved'                   => __( 'Gallery assignments saved', 'fotogrids' ),
                'error'                   => __( 'Error updating Album', 'fotogrids' ),
                'items'                   => __( 'items', 'fotogrids' ),
                'noItems'                 => __( 'No items', 'fotogrids' ),
                'galleryTitleMissing'     => __( 'Gallery Title Missing', 'fotogrids' ),
                'dropItemHere'            => __( 'Drop item here', 'fotogrids' ),
            ],
        ] );
    }

    /**
     * Common translation strings shipped to the item-edit modal React tree.
     *
     * Kept private because every consumer is one of the public render
     * methods on this class.
     *
     * @return array<string, string>
     */
    private static function common_metabox_strings(): array {
        return [
            'selectItems'                          => __( 'Select Items for Gallery', 'fotogrids' ),
            'addToGallery'                         => __( 'Add to Gallery', 'fotogrids' ),
            'editItem'                             => __( 'Edit Item', 'fotogrids' ),
            'removeItem'                           => __( 'Remove Item', 'fotogrids' ),
            'confirmClear'                         => __( 'Are you sure you want to remove all items?', 'fotogrids' ),
            'mediaNotAvailable'                    => __( 'WordPress media library is not available. Please refresh the page.', 'fotogrids' ),
            'loading'                              => __( 'Loading...', 'fotogrids' ),
            'errorLoadingItem'                     => __( 'Error loading item data', 'fotogrids' ),
            'errorSaving'                          => __( 'Error saving item data', 'fotogrids' ),
            'itemSavedSuccessfully'                => __( 'Item saved successfully!', 'fotogrids' ),
            'unsavedChangesConfirm'                => __( 'You have unsaved changes. Are you sure you want to close without saving?', 'fotogrids' ),
            'unsavedChangesNavigate'               => __( 'You have unsaved changes. Are you sure you want to navigate away without saving?', 'fotogrids' ),
            'title'                                => __( 'Title', 'fotogrids' ),
            'altText'                              => __( 'Alt Text', 'fotogrids' ),
            'caption'                              => __( 'Caption', 'fotogrids' ),
            'description'                          => __( 'Description', 'fotogrids' ),
            'credit'                               => __( 'Credit', 'fotogrids' ),
            'saveChanges'                          => __( 'Save Changes', 'fotogrids' ),
            'cancel'                               => __( 'Cancel', 'fotogrids' ),
            'close'                                => __( 'Close', 'fotogrids' ),
            'prevItem'                             => __( 'Previous item', 'fotogrids' ),
            'nextItem'                             => __( 'Next item', 'fotogrids' ),
            'dropHere'                             => __( 'Drop here', 'fotogrids' ),
            'details'                              => __( 'Details', 'fotogrids' ),
            'tags'                                 => __( 'Tags', 'fotogrids' ),
            'people'                               => __( 'People', 'fotogrids' ),
            'location'                             => __( 'Location', 'fotogrids' ),
            'manageItems'                          => __( 'Manage Items', 'fotogrids' ),
            'previewGallery'                       => __( 'Preview Gallery', 'fotogrids' ),
            'addNew'                               => __( 'Add New', 'fotogrids' ),
            'removeAll'                            => __( 'Remove All', 'fotogrids' ),
            'removeAllItems'                       => __( 'Remove all items', 'fotogrids' ),
            'removeAllModalTitle'                  => __( 'Remove all gallery items?', 'fotogrids' ),
            'removeAllModalWarning'                => __( 'This action cannot be undone.', 'fotogrids' ),
            'removeAllModalBody'                   => __( 'You are about to remove every item from this gallery. The gallery will become empty, and the removed items will no longer appear here.', 'fotogrids' ),
            'removeAllModalDeleteCustomDataLabel'  => __( 'Also delete custom data saved for these items', 'fotogrids' ),
            'removeAllModalDeleteCustomDataHelp'   => __( 'This includes item-specific FotoGrids data such as custom titles, descriptions, links, captions, alt text overrides, sorting data, tags, filters, and other custom fields. This data will be deleted for these items everywhere they are used in FotoGrids, including other galleries where the same items appear.', 'fotogrids' ),
            'removeAllModalConfirmPrompt'          => __( 'To confirm, type REMOVE ALL below.', 'fotogrids' ),
            'removeAllModalConfirmPlaceholder'     => __( 'Type REMOVE ALL', 'fotogrids' ),
            'bulkEditor'                           => __( 'Bulk Editor', 'fotogrids' ),
            'upload'                               => __( 'Upload', 'fotogrids' ),
            'uploadDescription'                    => __( 'Choose files from your computer', 'fotogrids' ),
            'fromLibrary'                          => __( 'From Library', 'fotogrids' ),
            'addFromLibrary'                       => __( 'Add items from library', 'fotogrids' ),
            'fromLibraryDescription'               => __( 'Choose from WordPress media library', 'fotogrids' ),
            'fromFolder'                           => __( 'From Folder', 'fotogrids' ),
            'fromFolderDescription'                => __( 'Browse uploads folder structure', 'fotogrids' ),
            'fromZip'                              => __( 'From ZIP', 'fotogrids' ),
            'fromZipDescription'                   => __( 'Upload and extract ZIP file', 'fotogrids' ),
            'video'                                => __( 'Video', 'fotogrids' ),
            'videoDescription'                     => __( 'Add video files', 'fotogrids' ),
            'videoEmbed'                           => __( 'Video Embed', 'fotogrids' ),
            'addVideoEmbed'                        => __( 'Add a video embed', 'fotogrids' ),
            'addVideoEmbedDescription'             => __( 'YouTube / Vimeo', 'fotogrids' ),
            'videoEmbedAdded'                      => __( 'Video added to gallery.', 'fotogrids' ),
            'videoEmbedUpdated'                    => __( 'Video updated.', 'fotogrids' ),
            'videoEmbedRemoveFailed'               => __( 'Failed to remove the video.', 'fotogrids' ),
            'editVideoEmbed'                       => __( 'Edit Video Embed', 'fotogrids' ),
            'saveChanges'                          => __( 'Save Changes', 'fotogrids' ),
            'saving'                               => __( 'Saving…', 'fotogrids' ),
            'video'                                => __( 'Video', 'fotogrids' ),
            'posterImage'                          => __( 'Poster Image', 'fotogrids' ),
            'posterImageDesc'                      => __( 'Shown in the gallery before the video plays. Defaults to the video’s own thumbnail.', 'fotogrids' ),
            'choosePoster'                         => __( 'Choose Poster', 'fotogrids' ),
            'changePoster'                         => __( 'Change Poster', 'fotogrids' ),
            'usePoster'                            => __( 'Use as poster', 'fotogrids' ),
            'removePoster'                         => __( 'Remove', 'fotogrids' ),
            'link'                                 => __( 'Link', 'fotogrids' ),
            'loadVideo'                            => __( 'Load video', 'fotogrids' ),
            'videoLoaded'                          => __( 'Video loaded successfully.', 'fotogrids' ),
            'invalidYouTubeUrl'                    => __( 'Please enter a valid YouTube URL.', 'fotogrids' ),
            'invalidVimeoUrl'                      => __( 'Please enter a valid Vimeo URL.', 'fotogrids' ),
            'resolveError'                         => __( 'Could not resolve video URL.', 'fotogrids' ),
            'resolveMetadataFailed'                => __( 'Video found but metadata could not be fetched.', 'fotogrids' ),
            'noThumbnail'                          => __( 'No thumbnail available', 'fotogrids' ),
            'previewWillAppear'                    => __( 'Preview will appear here', 'fotogrids' ),
            'startTime'                            => __( 'Start Time', 'fotogrids' ),
            'startTimeDesc'                        => __( 'Specify a start time (in seconds)', 'fotogrids' ),
            'endTime'                              => __( 'End Time', 'fotogrids' ),
            'endTimeDesc'                          => __( 'Specify an end time (in seconds)', 'fotogrids' ),
            'videoOptions'                         => __( 'Video Options', 'fotogrids' ),
            'autoplay'                             => __( 'Autoplay', 'fotogrids' ),
            'autoplayNote'                         => __( 'Autoplay is subject to browser autoplay policies.', 'fotogrids' ),
            'mute'                                 => __( 'Mute', 'fotogrids' ),
            'loop'                                 => __( 'Loop', 'fotogrids' ),
            'playerControls'                       => __( 'Player Controls', 'fotogrids' ),
            'captions'                             => __( 'Captions', 'fotogrids' ),
            'privacyMode'                          => __( 'Privacy Mode', 'fotogrids' ),
            'privacyModeNote'                      => __( "When on, the platform won't store information about visitors unless they play the video.", 'fotogrids' ),
            'suggestedVideos'                      => __( 'Suggested Videos', 'fotogrids' ),
            'introTitle'                           => __( 'Intro Title', 'fotogrids' ),
            'introPortrait'                        => __( 'Intro Portrait', 'fotogrids' ),
            'introByline'                          => __( 'Intro Byline', 'fotogrids' ),
            'controlsColor'                        => __( 'Controls Color', 'fotogrids' ),
            'resetColor'                           => __( 'Reset to default', 'fotogrids' ),
            'optional'                             => __( '(optional)', 'fotogrids' ),
            'adding'                               => __( 'Adding…', 'fotogrids' ),
            'fromOtherSources'                     => __( 'Add from other sources', 'fotogrids' ),
            'fromOtherSourcesDescription'          => __( "Google Photos, Dropbox, Instagram, etc...", 'fotogrids' ),
            'instagram'                            => __( 'Instagram', 'fotogrids' ),
            'instagramDescription'                 => __( 'Import from Instagram', 'fotogrids' ),
            'noItems'                              => __( 'No items yet added.', 'fotogrids' ),
            'previewPlaceholder'                   => __( 'Gallery preview functionality will be implemented here.', 'fotogrids' ),
            'saving'                               => __( 'Saving...', 'fotogrids' ),
            'interactions'                         => __( 'Interactions', 'fotogrids' ),
            'setAsFeatured'                        => __( 'Set as featured item', 'fotogrids' ),
            'clearFeatured'                        => __( 'Clear featured item', 'fotogrids' ),
            'featuredItemSet'                      => __( 'Featured item set', 'fotogrids' ),
            'featuredItemCleared'                  => __( 'Featured item cleared', 'fotogrids' ),
            'errorSavingFeatured'                  => __( 'Error saving featured item', 'fotogrids' ),
            'copied'                               => __( 'Copied!', 'fotogrids' ),
            'copyFailed'                           => __( 'Copy failed', 'fotogrids' ),
            'seo'                                  => __( 'SEO', 'fotogrids' ),
            'advanced'                             => __( 'Advanced', 'fotogrids' ),
            'add'                                  => __( 'Add', 'fotogrids' ),
            'pro'                                  => __( 'Pro', 'fotogrids' ),
            'filename'                             => __( 'Filename', 'fotogrids' ),
            'fileSize'                             => __( 'File Size', 'fotogrids' ),
            'dimensions'                           => __( 'Dimensions', 'fotogrids' ),
            'fileType'                             => __( 'File Type', 'fotogrids' ),
            'notAvailable'                         => __( 'Not Available', 'fotogrids' ),
            'failedLoading'                        => __( 'Failed to load item data', 'fotogrids' ),
            'upgradeToPro'                         => __( 'Upgrade to Pro', 'fotogrids' ),
            'seoOptimization'                      => __( 'SEO Optimization', 'fotogrids' ),
            'seoOptimizationDesc'                  => __( 'Unlock powerful SEO features to help your website rank higher in search results and drive more organic traffic through your galleries.', 'fotogrids' ),
            'seoAiMetaOptimization'                => __( 'AI-Powered Meta Optimization', 'fotogrids' ),
            'seoAiMetaOptimizationDesc'            => __( 'Generate perfect meta titles, descriptions, alt text and tags using AI to maximize search engine visibility and accessibility for each gallery item.', 'fotogrids' ),
            'seoFileOptimization'                  => __( 'File Optimization for SEO', 'fotogrids' ),
            'seoFileOptimizationDesc'              => __( 'Automatically optimize image file names, sizes, and formats for best SEO performance and faster page load times.', 'fotogrids' ),
            'seoSchemaMarkup'                      => __( 'Schema.org Markup', 'fotogrids' ),
            'seoSchemaMarkupDesc'                  => __( 'Automatic structured data markup for images and galleries, helping search engines understand your content better.', 'fotogrids' ),
            'seoImageSitemaps'                     => __( 'Image Sitemaps', 'fotogrids' ),
            'seoImageSitemapsDesc'                 => __( 'Generate automatic XML sitemaps for all gallery images, ensuring search engines can discover and index your content.', 'fotogrids' ),
            'locationSmartSuggestions'             => __( 'Smart location suggestions', 'fotogrids' ),
            'locationSmartSuggestionsDesc'         => __( 'with map integration', 'fotogrids' ),
            'facialRecognition'                    => __( 'AI Facial Recognition', 'fotogrids' ),
            'facialRecognitionDesc'                => __( '- automatically detect and tag people', 'fotogrids' ),
            'exif'                                 => __( 'EXIF', 'fotogrids' ),
            'camera'                               => __( 'Camera', 'fotogrids' ),
            'aperture'                             => __( 'Aperture', 'fotogrids' ),
            'shutterSpeed'                         => __( 'Shutter Speed', 'fotogrids' ),
            'iso'                                  => __( 'ISO', 'fotogrids' ),
            'lens'                                 => __( 'Lens', 'fotogrids' ),
            'focalLength'                          => __( 'Focal Length', 'fotogrids' ),
            'dateTaken'                            => __( 'Date Taken', 'fotogrids' ),
            'copyright'                            => __( 'Copyright', 'fotogrids' ),
            'orientation'                          => __( 'Orientation', 'fotogrids' ),
            'flash'                                => __( 'Flash', 'fotogrids' ),
            'whiteBalance'                         => __( 'White Balance', 'fotogrids' ),
            'exposureMode'                         => __( 'Exposure Mode', 'fotogrids' ),
            'exifPerImageOverrides'                => __( 'Per-image EXIF overrides', 'fotogrids' ),
            'addTagsPlaceholder'                   => __( 'Add tags...', 'fotogrids' ),
            'addPeoplePlaceholder'                 => __( 'Add people...', 'fotogrids' ),
            'addLocationPlaceholder'               => __( 'Add location...', 'fotogrids' ),
        ];
    }
}
