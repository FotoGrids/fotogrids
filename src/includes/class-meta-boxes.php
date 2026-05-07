<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Meta Boxes Class
 *
 * Handles meta boxes for gallery and album editing
 */
class Meta_Boxes {

    /**
     * Initialize meta boxes
     */
    public static function init() {
        add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
        add_action( 'save_post', array( __CLASS__, 'save_meta_boxes' ) );

        add_action( 'wp_ajax_fotogrids_get_item_data', array( __CLASS__, 'ajax_get_item_data' ) );
        add_action( 'wp_ajax_fotogrids_save_item_data', array( __CLASS__, 'ajax_save_item_data' ) );
        add_action( 'wp_ajax_fotogrids_get_item_urls', array( __CLASS__, 'ajax_get_item_urls' ) );
        add_action( 'wp_ajax_fotogrids_update_item_url', array( __CLASS__, 'ajax_update_item_url' ) );
        add_action( 'wp_ajax_fotogrids_bulk_update_item_urls', array( __CLASS__, 'ajax_bulk_update_item_urls' ) );
        add_action( 'wp_ajax_fotogrids_reorder_gallery_items', array( __CLASS__, 'ajax_reorder_gallery_items' ) );
        add_action( 'wp_ajax_fotogrids_set_favorite_item', array( __CLASS__, 'ajax_set_favorite_item' ) );

        add_action( 'wp_ajax_fotogrids_save_collection', array( __CLASS__, 'ajax_save_collection' ) );

        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_meta_box_assets' ) );
    }

    /**
     * Add meta boxes for gallery and album editing
     */
    public static function add_meta_boxes() {
        add_meta_box(
            'fotogrids_gallery_items',
            __( 'Gallery Items', 'fotogrids' ),
            array( __CLASS__, 'gallery_items_meta_box' ),
            'fotogrids_gallery',
            'normal',
            'high'
        );

        foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
            $title = $post_type === 'fotogrids_gallery'
                ? __( 'Gallery Settings', 'fotogrids' )
                : __( 'Album Settings', 'fotogrids' );

            add_meta_box(
                'fotogrids_collection_settings',
                $title,
                array( __CLASS__, 'collection_settings_meta_box' ),
                $post_type,
                'normal',
                'default'
            );
        }

        add_meta_box(
            'fotogrids_gallery_albums',
            __( 'Album Assignment', 'fotogrids' ),
            array( __CLASS__, 'gallery_albums_meta_box' ),
            'fotogrids_gallery',
            'side',
            'default'
        );

        foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
            add_meta_box(
                $post_type . '_templates',
                __( 'Templates', 'fotogrids' ),
                array( __CLASS__, 'templates_meta_box' ),
                $post_type,
                'side',
                'default'
            );
        }
    }

    /**
     * Get common metabox strings
     *
     * @return array Common strings used across metaboxes
     */
    private static function get_common_metabox_strings() {
        return array(
            'selectItems' => __( 'Select Items for Gallery', 'fotogrids' ),
            'addToGallery' => __( 'Add to Gallery', 'fotogrids' ),
            'editItem' => __( 'Edit Item', 'fotogrids' ),
            'removeItem' => __( 'Remove Item', 'fotogrids' ),
            'confirmClear' => __( 'Are you sure you want to remove all items?', 'fotogrids' ),
            'mediaNotAvailable' => __( 'WordPress media library is not available. Please refresh the page.', 'fotogrids' ),
            'loading' => __( 'Loading...', 'fotogrids' ),
            'errorLoadingItem' => __( 'Error loading item data', 'fotogrids' ),
            'errorSaving' => __( 'Error saving item data', 'fotogrids' ),
            'itemSavedSuccessfully' => __( 'Item saved successfully!', 'fotogrids' ),
            'unsavedChangesConfirm' => __( 'You have unsaved changes. Are you sure you want to close without saving?', 'fotogrids' ),
            'unsavedChangesNavigate' => __( 'You have unsaved changes. Are you sure you want to navigate away without saving?', 'fotogrids' ),
            'title' => __( 'Title', 'fotogrids' ),
            'altText' => __( 'Alt Text', 'fotogrids' ),
            'caption' => __( 'Caption', 'fotogrids' ),
            'description' => __( 'Description', 'fotogrids' ),
            'saveChanges' => __( 'Save Changes', 'fotogrids' ),
            'cancel' => __( 'Cancel', 'fotogrids' ),
            'close' => __( 'Close', 'fotogrids' ),
            'prevItem' => __( 'Previous item', 'fotogrids' ),
            'nextItem' => __( 'Next item', 'fotogrids' ),
            'dropHere' => __( 'Drop here', 'fotogrids' ),
            'details' => __( 'Details', 'fotogrids' ),
            'tags' => __( 'Tags', 'fotogrids' ),
            'people' => __( 'People', 'fotogrids' ),
            'location' => __( 'Location', 'fotogrids' ),
            'manageItems' => __( 'Manage Items', 'fotogrids' ),
            'previewGallery' => __( 'Preview Gallery', 'fotogrids' ),
            'addNew' => __( 'Add New', 'fotogrids' ),
            'removeAll' => __( 'Remove All', 'fotogrids' ),
            'bulkEditor' => __( 'Bulk Editor', 'fotogrids' ),
            'upload' => __( 'Upload', 'fotogrids' ),
            'uploadDescription' => __( 'Choose files from your computer', 'fotogrids' ),
            'fromLibrary' => __( 'From Library', 'fotogrids' ),
            'addFromLibrary' => __( 'Add items from library', 'fotogrids' ),
            'fromLibraryDescription' => __( 'Choose from WordPress media library', 'fotogrids' ),
            'fromFolder' => __( 'From Folder', 'fotogrids' ),
            'fromFolderDescription' => __( 'Browse uploads folder structure', 'fotogrids' ),
            'fromZip' => __( 'From ZIP', 'fotogrids' ),
            'fromZipDescription' => __( 'Upload and extract ZIP file', 'fotogrids' ),
            'video' => __( 'Video', 'fotogrids' ),
            'videoDescription' => __( 'Add video files', 'fotogrids' ),
            'fromOtherSources' => __( 'Add from other sources', 'fotogrids' ),
            'fromOtherSourcesDescription' => __( "YouTube, Dropbox, Instagram, etc...", 'fotogrids' ),
            'instagram' => __( 'Instagram', 'fotogrids' ),
            'instagramDescription' => __( 'Import from Instagram', 'fotogrids' ),
            'noItems' => __( 'No items yet added.', 'fotogrids' ),
            'previewPlaceholder' => __( 'Gallery preview functionality will be implemented here.', 'fotogrids' ),
            'saving' => __( 'Saving...', 'fotogrids' ),
            'interactions' => __( 'Interactions', 'fotogrids' ),
            'toggleFavorite' => __( 'Make Favorite', 'fotogrids' ),
            'makeFavorite' => __( 'Make Favorite', 'fotogrids' ),
            'removeFavorite' => __( 'Remove Favorite', 'fotogrids' ),
            'favoriteItemSet' => __( 'Favorite item set successfully', 'fotogrids' ),
            'favoriteItemRemoved' => __( 'Favorite item removed successfully', 'fotogrids' ),
            'errorSavingFavorite' => __( 'Error saving favorite item', 'fotogrids' ),
            'copied' => __( 'Copied!', 'fotogrids' ),
            'copyFailed' => __( 'Copy failed', 'fotogrids' ),
            'seo' => __( 'SEO', 'fotogrids' ),
            'advanced' => __( 'Advanced', 'fotogrids' ),
            'add' => __( 'Add', 'fotogrids' ),
            'pro' => __( 'Pro', 'fotogrids' ),
            'filename' => __( 'Filename', 'fotogrids' ),
            'fileSize' => __( 'File Size', 'fotogrids' ),
            'dimensions' => __( 'Dimensions', 'fotogrids' ),
            'fileType' => __( 'File Type', 'fotogrids' ),
            'notAvailable' => __( 'Not Available', 'fotogrids' ),
            'failedLoading' => __( 'Failed to load item data', 'fotogrids' ),
            'upgradeToPro' => __( 'Upgrade to Pro', 'fotogrids' ),
            'seoOptimization' => __( 'SEO Optimization', 'fotogrids' ),
            'seoOptimizationDesc' => __( 'Unlock powerful SEO features to help your website rank higher in search results and drive more organic traffic through your galleries.', 'fotogrids' ),
            'seoAiMetaOptimization' => __( 'AI-Powered Meta Optimization', 'fotogrids' ),
            'seoAiMetaOptimizationDesc' => __( 'Generate perfect meta titles, descriptions, alt text and tags using AI to maximize search engine visibility and accessibility for each gallery item.', 'fotogrids' ),
            'seoFileOptimization' => __( 'File Optimization for SEO', 'fotogrids' ),
            'seoFileOptimizationDesc' => __( 'Automatically optimize image file names, sizes, and formats for best SEO performance and faster page load times.', 'fotogrids' ),
            'seoSchemaMarkup' => __( 'Schema.org Markup', 'fotogrids' ),
            'seoSchemaMarkupDesc' => __( 'Automatic structured data markup for images and galleries, helping search engines understand your content better.', 'fotogrids' ),
            'seoImageSitemaps' => __( 'Image Sitemaps', 'fotogrids' ),
            'seoImageSitemapsDesc' => __( 'Generate automatic XML sitemaps for all gallery images, ensuring search engines can discover and index your content.', 'fotogrids' ),
            'locationSmartSuggestions' => __( 'Smart location suggestions', 'fotogrids' ),
            'locationSmartSuggestionsDesc' => __( 'with map integration', 'fotogrids' ),
            'facialRecognition' => __( 'AI Facial Recognition', 'fotogrids' ),
            'facialRecognitionDesc' => __( '- automatically detect and tag people', 'fotogrids' ),
            'exif' => __( 'EXIF', 'fotogrids' ),
            'camera' => __( 'Camera', 'fotogrids' ),
            'aperture' => __( 'Aperture', 'fotogrids' ),
            'shutterSpeed' => __( 'Shutter Speed', 'fotogrids' ),
            'iso' => __( 'ISO', 'fotogrids' ),
            'lens' => __( 'Lens', 'fotogrids' ),
            'focalLength' => __( 'Focal Length', 'fotogrids' ),
            'dateTaken' => __( 'Date Taken', 'fotogrids' ),
            'copyright' => __( 'Copyright', 'fotogrids' ),
            'orientation' => __( 'Orientation', 'fotogrids' ),
            'flash' => __( 'Flash', 'fotogrids' ),
            'whiteBalance' => __( 'White Balance', 'fotogrids' ),
            'exposureMode' => __( 'Exposure Mode', 'fotogrids' ),
            'exifPerImageOverrides' => __( 'Per-image EXIF overrides', 'fotogrids' ),
            'addTagsPlaceholder' => __( 'Add tags...', 'fotogrids' ),
            'addPeoplePlaceholder' => __( 'Add people...', 'fotogrids' ),
            'addLocationPlaceholder' => __( 'Add location...', 'fotogrids' ),
        );
    }

    /**
     * Enqueue meta box specific assets
     */
    public static function enqueue_meta_box_assets( $hook ) {
        global $post_type;

        if ( ! in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            return;
        }

        if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ) ) ) {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_script( 'jquery-ui-sortable' );

        wp_enqueue_script( 'wp-element' );
        wp_enqueue_script( 'wp-components' );
        wp_enqueue_script( 'wp-i18n' );

        fotogrids_enqueue_collection_settings_scripts( true, true );

        wp_enqueue_script(
            'fotogrids-metabox',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/metabox.js',
            array( 'wp-element', 'wp-components', 'wp-i18n', 'jquery', 'media-upload', 'jquery-ui-sortable', 'fotogrids-icons' ),
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

        wp_localize_script( 'fotogrids-ajax-save', 'fotogridsAjaxSave', array(
            'strings' => array(
                'savingGallery' => __( 'Saving gallery...', 'fotogrids' ),
                'gallerySavedSuccessfully' => __( 'Gallery saved successfully!', 'fotogrids' ),
                'saveFailed' => __( 'Save failed. Please try again.', 'fotogrids' ),
                'fixValidationErrors' => __( 'Please fix validation errors before saving.', 'fotogrids' ),
                'fixErrors' => __( 'Fix Errors', 'fotogrids' ),
                'pleaseFixValidationErrors' => __( 'Please fix validation errors before saving', 'fotogrids' ),
                'youHaveUnsavedChanges' => __( 'You have unsaved changes', 'fotogrids' ),
                'lastSaved' => __( 'Last saved', 'fotogrids' ),
                'quickSave' => __( 'Quick Save', 'fotogrids' ),
                'quickSaveGallery' => __( 'Quick Save Gallery (Ctrl+S)', 'fotogrids' ),
                'editGallery' => __( 'Edit Gallery', 'fotogrids' ),
                'editAlbum' => __( 'Edit Album', 'fotogrids' ),
                'unsavedChangesConfirm' => __( 'You have unsaved changes. Are you sure you want to leave?', 'fotogrids' ),
            ),
        ) );

        if ( $post_type === 'fotogrids_gallery' ) {
            wp_enqueue_script(
                'fotogrids-album-assignment',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/album-assignment.js',
                array( 'wp-element', 'wp-api-fetch', 'fotogrids-ajax-save' ),
                FOTOGRIDS_VERSION,
                true
            );
        }

        if ( $post_type === 'fotogrids_album' ) {
            wp_enqueue_script(
                'fotogrids-album-galleries',
                FOTOGRIDS_PLUGIN_URL . 'assets/js/album-galleries.js',
                array( 'wp-element', 'wp-api-fetch' ),
                FOTOGRIDS_VERSION,
                true
            );

            global $post;
            if ( $post && $post->post_type === 'fotogrids_album' ) {
                $assigned_galleries = \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( $post->ID );
                $all_galleries = \FotoGrids\Gallery_Album_Relations::get_all_galleries();

                wp_localize_script( 'fotogrids-album-galleries', 'fotogridsAlbumGalleries', array(
                    'postId' => $post->ID,
                    'assignedGalleries' => $assigned_galleries,
                    'allGalleries' => $all_galleries,
                    'nonce' => wp_create_nonce( 'wp_rest' ),
                    'restUrl' => 'fotogrids/v1/',
                    'strings' => array(
                        'assignedGalleries' => __( 'Assigned Galleries', 'fotogrids' ),
                        'availableGalleries' => __( 'Available Galleries', 'fotogrids' ),
                        'searchPlaceholder' => __( 'Search galleries...', 'fotogrids' ),
                        'noGalleriesAssigned' => __( 'No galleries assigned to this album', 'fotogrids' ),
                        'noGalleriesAvailable' => __( 'No available galleries found', 'fotogrids' ),
                        'dragToReorder' => __( 'Drag to reorder galleries', 'fotogrids' ),
                        'removeFromAlbum' => __( 'Remove from album', 'fotogrids' ),
                        'addToAlbum' => __( 'Add to album', 'fotogrids' ),
                        'loading' => __( 'Loading...', 'fotogrids' ),
                        'saved' => __( 'Gallery assignments saved', 'fotogrids' ),
                        'error' => __( 'Error updating album', 'fotogrids' ),
                        'items' => __( 'items', 'fotogrids' ),
                        'noItems' => __( 'No items', 'fotogrids' ),
                        'galleryTitleMissing' => __( 'Gallery Title Missing', 'fotogrids' ),
                        'dropItemHere' => __( 'Drop item here', 'fotogrids' ),
                    ),
                ) );
            }
        }

        wp_enqueue_script(
            'fotogrids-templates-metabox',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/templates-metabox.js',
            array( 'wp-element', 'wp-api-fetch' ),
            FOTOGRIDS_VERSION,
            true
        );

        // Enqueue frontend CSS for preview
        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            array(),
            FOTOGRIDS_VERSION
        );
    }

    /**
     * Gallery items meta box
     */
    public static function gallery_items_meta_box( $post ) {
        wp_nonce_field( 'fotogrids_meta_box', 'fotogrids_meta_box_nonce' );

        $gallery_items = get_post_meta( $post->ID, 'fotogrids_gallery_items', true );
        $gallery_items = $gallery_items ? json_decode( $gallery_items, true ) : array();

        $favorite_item_id = get_post_meta( $post->ID, 'fotogrids_gallery_favorite_item', true );
        $favorite_item_id = $favorite_item_id ? intval( $favorite_item_id ) : null;

        if ( $favorite_item_id === null && ! empty( $gallery_items ) ) {
            $favorite_item_id = intval( $gallery_items[0] );
            update_post_meta( $post->ID, 'fotogrids_gallery_favorite_item', $favorite_item_id );
        }

        $items_data = array();
        foreach ( $gallery_items as $item_id ) {
            $item_url = wp_get_attachment_image_url( $item_id, 'full' );
            $thumbnail_url = wp_get_attachment_image_url( $item_id, 'thumbnail' );
            $item_title = get_the_title( $item_id );
            $item_alt = get_post_meta( $item_id, '_wp_attachment_item_alt', true );

            if ( $item_url ) {
                $items_data[] = array(
                    'id' => (int) $item_id,
                    'title' => $item_title ?: 'Untitled',
                    'url' => $item_url,
                    'thumbnail' => $thumbnail_url ?: $item_url,
                    'alt' => $item_alt ?: $item_title ?: '',
                    'favorite' => ( $favorite_item_id !== null && (int) $item_id === $favorite_item_id )
                );
            }
        }

        wp_localize_script( 'fotogrids-metabox', 'fotogridsMetaBoxes', array(
            'galleryItems' => $items_data,
            'canEditPosts' => current_user_can( 'edit_posts' ),
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'fotogrids_item_edit' ),
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'postId' => $post->ID,
            'strings' => self::get_common_metabox_strings(),
        ) );

        ?>
        <!-- React container for Gallery Metabox -->
        <div id="fotogrids-gallery-metabox-root"></div>
        <?php
    }

    /**
     * Collection settings meta box (galleries and albums)
     */
    public static function collection_settings_meta_box( $post ) {
        wp_nonce_field( 'fotogrids_meta_box', 'fotogrids_meta_box_nonce' );

        $localized_data = Admin_Helpers::get_collection_settings_localized_data( array(
            'post_id' => $post->ID,
            'post_type' => $post->post_type,
            'is_defaults' => false,
        ) );

        wp_localize_script( 'fotogrids-collection-settings', 'fotogridsSettings', $localized_data );
        ?>
        <div id="fotogrids-collection-settings-root"></div>
        <?php
    }

    /**
     * Gallery albums assignment meta box
     */
    public static function gallery_albums_meta_box( $post ) {
        wp_nonce_field( 'fotogrids_gallery_albums', 'fotogrids_gallery_albums_nonce' );

        $assigned_albums = \FotoGrids\Gallery_Album_Relations::get_albums_for_gallery( $post->ID );

        $all_albums = \FotoGrids\Gallery_Album_Relations::get_all_albums();

        wp_localize_script( 'fotogrids-album-assignment', 'fotogridsAlbumAssignment', array(
            'postId' => $post->ID,
            'assignedAlbums' => $assigned_albums,
            'allAlbums' => $all_albums,
            'nonce' => wp_create_nonce( 'wp_rest' ),
            'restUrl' => 'fotogrids/v1/',
            'strings' => array(
                'searchPlaceholder' => __( 'Search albums...', 'fotogrids' ),
                'noAvailableAlbumsFound' => __( 'No available albums found', 'fotogrids' ),
                'createNewAlbum' => __( 'Create New Album', 'fotogrids' ),
                'assignedTo' => __( 'Assigned to', 'fotogrids' ),
                'notAssignedTo' => __( 'Not assigned to any', 'fotogrids' ),
                'albums' => __( 'albums', 'fotogrids' ),
                'loading' => __( 'Loading...', 'fotogrids' ),
                'error' => __( 'Error loading albums', 'fotogrids' ),
                'saved' => __( 'Album assignments saved', 'fotogrids' ),
            ),
        ) );
        ?>
        <div id="fotogrids-gallery-albums-root">
            <!-- React Album Assignment component will mount here -->
            <div class="fotogrids-loading">
                <span class="spinner fg-is-active"></span>
                <?php _e( 'Loading albums...', 'fotogrids' ); ?>
            </div>
        </div>
        <?php
    }

    /**
     * Templates meta box for both galleries and albums
     */
    public static function templates_meta_box( $post ) {
        $post_type = $post->post_type === 'fotogrids_gallery' ? 'gallery' : 'album';

        $save_as_template_button = apply_filters(
            'fotogrids/templates/save_as_template_button',
            null,
            $post
        );

        wp_localize_script( 'fotogrids-templates-metabox', 'fotogridsTemplatesMetabox', array(
            'postId' => $post->ID,
            'postType' => $post_type,
            'isPro' => fotogrids_has_pro(),
            'nonce' => wp_create_nonce( 'wp_rest' ),
            'restUrl' => 'fotogrids/v1/',
            'templatesUrl' => admin_url( 'admin.php?page=fotogrids-templates' ),
            'saveAsTemplateButton' => $save_as_template_button,
            'strings' => array(
                'selectTemplate' => __( 'Select Template', 'fotogrids' ),
                'saveAsTemplate' => __( 'Save current settings as Template', 'fotogrids' ),
                'applyTemplate' => __( 'Apply Template', 'fotogrids' ),
                'templatesNoticeDescription' => __( 'Apply beautiful, ready-to-use designs to your galleries and albums instantly. Browse the Templates Library to explore what\'s available.', 'fotogrids' ),
                'proSaveDescriptionGallery' => __( 'With a {pro_badge} license, you will be able to save the current gallery settings as a reusable template and apply it across multiple galleries.', 'fotogrids' ),
                'proSaveDescriptionAlbum' => __( 'With a {pro_badge} license, you will be able to save the current album settings as a reusable template and apply it across multiple albums.', 'fotogrids' ),
                'dismiss' => __( 'Dismiss', 'fotogrids' ),
                'upgradeToPro' => __( 'Upgrade to Pro', 'fotogrids' ),
                'loading' => __( 'Loading templates...', 'fotogrids' ),
                'noTemplates' => __( 'No templates available', 'fotogrids' ),
                'templateApplied' => __( 'Template applied successfully', 'fotogrids' ),
                'templateSaved' => __( 'Template saved successfully', 'fotogrids' ),
                'confirmApply' => __( 'This will override your current settings. Are you sure?', 'fotogrids' ),
                'templateName' => __( 'Template Name', 'fotogrids' ),
                'templateDescription' => __( 'Description (optional)', 'fotogrids' ),
                'save' => __( 'Save', 'fotogrids' ),
                'saving' => __( 'Saving...', 'fotogrids' ),
                'cancel' => __( 'Cancel', 'fotogrids' ),
                'applying' => __( 'Applying...', 'fotogrids' ),
                'myTemplate' => __( 'My Template', 'fotogrids' ),
                'userTemplates' => __( 'User Templates', 'fotogrids' ),
                'fotogridsTemplates' => __( 'FotoGrids Templates', 'fotogrids' ),
                'templatesLibrary' => __( 'Templates Library', 'fotogrids' ),
                'templateNameRequired' => __( 'Template name is required.', 'fotogrids' ),
                'failedToLoadTemplates' => __( 'Failed to load templates.', 'fotogrids' ),
                'failedToApplyTemplate' => __( 'Failed to apply template.', 'fotogrids' ),
                'failedToSaveTemplate' => __( 'Failed to save template.', 'fotogrids' ),
            ),
        ) );
        ?>
        <div id="fotogrids-templates-metabox"></div>
        <?php
    }

    /**
     * Save meta box data
     */
    public static function save_meta_boxes( $post_id ) {
        if ( ! isset( $_POST['fotogrids_meta_box_nonce'] ) || ! wp_verify_nonce( $_POST['fotogrids_meta_box_nonce'], 'fotogrids_meta_box' ) ) {
            return;
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }

        $post_type = get_post_type( $post_id );

        if ( $post_type === 'fotogrids_gallery' ) {
            if ( isset( $_POST['fotogrids_gallery_items'] ) && is_array( $_POST['fotogrids_gallery_items'] ) ) {
                $gallery_items = array_map( 'intval', $_POST['fotogrids_gallery_items'] );
                update_post_meta( $post_id, 'fotogrids_gallery_items', json_encode( $gallery_items ) );
            } else {
                delete_post_meta( $post_id, 'fotogrids_gallery_items' );
            }

            $defaults = fotogrids_get_default_gallery_settings();

            foreach ( $defaults as $setting_key => $default_value ) {
                $post_key = 'fotogrids_' . $setting_key;

                if ( isset( $_POST[$post_key] ) ) {
                    $value = $_POST[$post_key];

                    if ( is_array( $default_value ) ) {
                        if ( is_string( $value ) ) {
                            $decoded = json_decode( $value, true );
                            if ( json_last_error() === JSON_ERROR_NONE ) {
                                update_post_meta( $post_id, $post_key, $value );
                            }
                        } else if ( is_array( $value ) ) {
                            update_post_meta( $post_id, $post_key, json_encode( $value ) );
                        }
                    } else if ( is_bool( $default_value ) ) {
                        $bool_value = ( $value === '1' || $value === 'true' || $value === true ) ? '1' : '0';
                        update_post_meta( $post_id, $post_key, $bool_value );
                    } else if ( is_numeric( $default_value ) ) {
                        update_post_meta( $post_id, $post_key, sanitize_text_field( $value ) );
                    } else {
                        update_post_meta( $post_id, $post_key, sanitize_text_field( $value ) );
                    }
                }
            }
        }
    }

    /**
     * AJAX handler to get item data for editing
     */
    public static function ajax_get_item_data() {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'upload_files' ) ) {
            wp_die( -1 );
        }

        $item_id = intval( $_POST['item_id'] );

        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        $attachment = get_post( $item_id );
        if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
            wp_send_json_error( 'Item not found' );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $custom_meta = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table WHERE attachment_id = %d AND gallery_id = 0",
                $item_id
            )
        );

        $custom_data = array();
        $location = '';
        $external_url = '';
        $link_target = 'global';
        $exif_data = null;

        if ( $custom_meta ) {
            $location = $custom_meta->location;
            $external_url = $custom_meta->external_url ?? '';
            $link_target = $custom_meta->link_target ?? 'global';
            if ( ! empty( $custom_meta->custom_data ) ) {
                $decoded_data = json_decode( $custom_meta->custom_data, true );
                if ( is_array( $decoded_data ) ) {
                    $custom_data = $decoded_data;
                }
            }
            if ( ! empty( $custom_meta->exif_data ) ) {
                $decoded_exif = json_decode( $custom_meta->exif_data, true );
                if ( is_array( $decoded_exif ) ) {
                    $exif_data = $decoded_exif;
                }
            }
        }

        $attachment_meta = wp_get_attachment_metadata( $item_id );
        $file_path = get_attached_file( $item_id );
        $filename = $file_path ? basename( $file_path ) : '';
        $filesize = '';
        $width = '';
        $height = '';
        $mime_type = get_post_mime_type( $item_id );

        if ( $file_path && file_exists( $file_path ) ) {
            $filesize = size_format( filesize( $file_path ) );
        }

        if ( $attachment_meta && isset( $attachment_meta['width'], $attachment_meta['height'] ) ) {
            $width = $attachment_meta['width'];
            $height = $attachment_meta['height'];
        }

        $item_data = array(
            'id' => $item_id,
            'title' => $attachment->post_title,
            'alt' => get_post_meta( $item_id, '_wp_attachment_item_alt', true ),
            'caption' => $attachment->post_excerpt,
            'description' => $attachment->post_content,
            'location' => $location,
            'external_url' => $external_url,
            'link_target' => $link_target,
            'custom_data' => $custom_data,
            'exif' => $exif_data,
            'medium_url' => wp_get_attachment_image_url( $item_id, 'medium' ),
            'full_url' => wp_get_attachment_image_url( $item_id, 'full' ),
            'filename' => $filename,
            'filesize' => $filesize,
            'width' => $width,
            'height' => $height,
            'mime_type' => $mime_type,
        );

        wp_send_json_success( $item_data );
    }

    /**
     * AJAX handler to save item data
     */
    public static function ajax_save_item_data() {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'upload_files' ) ) {
            wp_die( -1 );
        }

        $item_id = intval( $_POST['item_id'] );
        $title = sanitize_text_field( $_POST['title'] );
        $alt = sanitize_text_field( $_POST['alt'] );
        $caption = sanitize_textarea_field( $_POST['caption'] );
        $description = sanitize_textarea_field( $_POST['description'] );
        $location = sanitize_text_field( $_POST['location'] ?? '' );
        $external_url = sanitize_url( $_POST['external_url'] ?? '' );
        $link_target = sanitize_text_field( $_POST['link_target'] ?? 'global' );

        $exif_data = array();
        if ( isset( $_POST['exif'] ) ) {
            $exif_raw = json_decode( stripslashes( $_POST['exif'] ), true );
            if ( is_array( $exif_raw ) ) {
                $exif_data = array_map( 'sanitize_text_field', $exif_raw );
            }
        }

        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        $attachment_data = array(
            'ID' => $item_id,
            'post_title' => $title,
            'post_excerpt' => $caption,
            'post_content' => $description,
        );

        $result = wp_update_post( $attachment_data );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( 'Failed to update item data' );
        }

        update_post_meta( $item_id, '_wp_attachment_item_alt', $alt );

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        $existing = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table WHERE attachment_id = %d AND gallery_id = 0",
                $item_id
            )
        );

        $data = array(
            'attachment_id' => $item_id,
            'gallery_id' => 0, // Global item data (not gallery-specific)
            'location' => $location,
            'external_url' => $external_url,
            'link_target' => $link_target,
            'exif_data' => ! empty( $exif_data ) ? wp_json_encode( $exif_data ) : null,
            'updated_at' => current_time( 'mysql', true ),
        );

        if ( $existing ) {
            $wpdb->update(
                $table,
                $data,
                array( 'id' => $existing->id ),
                array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' ),
                array( '%d' )
            );
        } else {
            $data['created_at'] = current_time( 'mysql', true );
            $wpdb->insert(
                $table,
                $data,
                array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
            );
        }

        wp_send_json_success( 'Item data updated successfully' );
    }

    /**
     * AJAX handler to get item URLs for multiple items (for External URL Manager)
     */
    public static function ajax_get_item_urls() {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $item_ids = isset( $_POST['item_ids'] ) ? array_map( 'intval', $_POST['item_ids'] ) : array();

        if ( empty( $item_ids ) ) {
            wp_send_json_success( array() );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        $sql = "SELECT attachment_id, external_url, link_target FROM $table WHERE attachment_id IN ($placeholders)";
        $results = $wpdb->get_results( $wpdb->prepare( $sql, $item_ids ), ARRAY_A );

        $item_data = array();
        foreach ( $results as $row ) {
            $attachment_id = $row['attachment_id'];
            $attachment = get_post( $attachment_id );

            $item_data[ $attachment_id ] = array(
                'url' => $row['external_url'] ?: '',
                'target' => $row['link_target'] ?: 'global',
                'thumbnail' => wp_get_attachment_image_url( $attachment_id, 'medium' ),
                'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                'title' => $attachment ? $attachment->post_title : ''
            );
        }

        // Fill in missing items with empty data
        foreach ( $item_ids as $item_id ) {
            if ( ! isset( $item_data[ $item_id ] ) ) {
                $attachment = get_post( $item_id );
                $item_data[ $item_id ] = array(
                    'url' => '',
                    'target' => 'global',
                    'thumbnail' => wp_get_attachment_image_url( $item_id, 'medium' ),
                    'alt' => get_post_meta( $item_id, '_wp_attachment_image_alt', true ),
                    'title' => $attachment ? $attachment->post_title : ''
                );
            }
        }

        wp_send_json_success( $item_data );
    }

    /**
     * AJAX handler to update a single item URL
     */
    public static function ajax_update_item_url() {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $item_id = intval( $_POST['item_id'] ?? 0 );
        $url = sanitize_url( $_POST['url'] ?? '' );
        $target = sanitize_text_field( $_POST['target'] ?? 'global' );

        if ( ! $item_id ) {
            wp_send_json_error( 'Invalid item ID' );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';

        // Check if record exists
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE attachment_id = %d",
            $item_id
        ) );

        if ( $exists ) {
            $result = $wpdb->update(
                $table,
                array(
                    'external_url' => $url,
                    'link_target' => $target
                ),
                array( 'attachment_id' => $item_id ),
                array( '%s', '%s' ),
                array( '%d' )
            );
        } else {
            // Create new record
            $attachment = get_post( $item_id );
            if ( ! $attachment ) {
                wp_send_json_error( 'Attachment not found' );
            }

            $result = $wpdb->insert(
                $table,
                array(
                    'attachment_id' => $item_id,
                    'gallery_id' => 0, // Global item data
                    'external_url' => $url,
                    'link_target' => $target,
                    'position' => 0
                ),
                array( '%d', '%d', '%s', '%s', '%d' )
            );
        }

        if ( $result !== false ) {
            wp_send_json_success( 'Item URL updated successfully' );
        } else {
            wp_send_json_error( 'Failed to update item URL' );
        }
    }

    /**
     * AJAX handler for bulk item URL operations
     */
    public static function ajax_bulk_update_item_urls() {
        check_ajax_referer( 'fotogrids_settings', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_die( -1 );
        }

        $action = sanitize_text_field( $_POST['bulk_action'] ?? '' );
        $item_ids = isset( $_POST['item_ids'] ) ? array_map( 'intval', $_POST['item_ids'] ) : array();
        $url = sanitize_url( $_POST['url'] ?? '' );
        $target = sanitize_text_field( $_POST['target'] ?? 'global' );

        if ( empty( $item_ids ) ) {
            wp_send_json_error( 'No item IDs provided' );
        }

        if ( ! in_array( $action, array( 'apply_to_all', 'clear_all' ) ) ) {
            wp_send_json_error( 'Invalid action' );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'fotogrids_item_meta';
        $updated = 0;

        if ( $action === 'apply_to_all' ) {
            foreach ( $item_ids as $item_id ) {
                // Check if record exists
                $exists = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM $table WHERE attachment_id = %d",
                    $item_id
                ) );

                if ( $exists ) {
                    $result = $wpdb->update(
                        $table,
                        array(
                            'external_url' => $url,
                            'link_target' => $target
                        ),
                        array( 'attachment_id' => $item_id ),
                        array( '%s', '%s' ),
                        array( '%d' )
                    );
                } else {
                    // Create new record
                    $attachment = get_post( $item_id );
                    if ( ! $attachment ) {
                        continue;
                    }

                    $result = $wpdb->insert(
                        $table,
                        array(
                            'attachment_id' => $item_id,
                            'gallery_id' => 0,
                            'external_url' => $url,
                            'link_target' => $target,
                            'position' => 0
                        ),
                        array( '%d', '%d', '%s', '%s', '%d' )
                    );
                }

                if ( $result !== false ) {
                    $updated++;
                }
            }
        } elseif ( $action === 'clear_all' ) {
            foreach ( $item_ids as $item_id ) {
                $result = $wpdb->update(
                    $table,
                    array(
                        'external_url' => '',
                        'link_target' => 'global'
                    ),
                    array( 'attachment_id' => $item_id ),
                    array( '%s', '%s' ),
                    array( '%d' )
                );

                if ( $result !== false ) {
                    $updated++;
                }
            }
        }

        wp_send_json_success( array(
            'updated' => $updated,
            'action' => $action,
            'message' => sprintf( __( 'Bulk action completed. Updated %d items.', 'fotogrids' ), $updated )
        ) );
    }

    /**
     * AJAX handler for saving collection data (galleries and albums)
     */
    public static function ajax_save_collection() {
        $nonce = $_POST['nonce'] ?? $_POST['fotogrids_meta_box_nonce'] ?? '';
        if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'fotogrids_meta_box' ) ) {
            wp_send_json_error( array( 'message' => __( 'Security check failed', 'fotogrids' ) ) );
        }

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( array( 'message' => __( 'Insufficient permissions', 'fotogrids' ) ) );
        }

        $post_id = intval( $_POST['post_id'] ?? 0 );
        if ( ! $post_id ) {
            wp_send_json_error( array( 'message' => __( 'Invalid post ID', 'fotogrids' ) ) );
        }

        $post = get_post( $post_id );
        if ( ! $post || ! in_array( $post->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid collection', 'fotogrids' ) ) );
        }

        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Cannot edit this gallery', 'fotogrids' ) ) );
        }

        $post_data = array( 'ID' => $post_id );
        $post_updated = false;

        if ( isset( $_POST['post_title'] ) && ! empty( $_POST['post_title'] ) ) {
            $post_data['post_title'] = sanitize_text_field( $_POST['post_title'] );
            $post_updated = true;
        }

        if ( isset( $_POST['content'] ) ) {
            $post_data['post_content'] = wp_kses_post( $_POST['content'] );
            $post_updated = true;
        }

        if ( isset( $_POST['post_status'] ) ) {
            $post_data['post_status'] = sanitize_text_field( $_POST['post_status'] );
            $post_updated = true;
        }

        if ( $post_updated ) {
            $result = wp_update_post( $post_data );
            if ( is_wp_error( $result ) ) {
                wp_send_json_error( array( 'message' => __( 'Failed to update gallery', 'fotogrids' ) ) );
            }
        }

        if ( isset( $_POST['fotogrids_gallery_items'] ) && is_array( $_POST['fotogrids_gallery_items'] ) ) {
            $gallery_items = array_map( 'intval', $_POST['fotogrids_gallery_items'] );
            update_post_meta( $post_id, 'fotogrids_gallery_items', json_encode( $gallery_items ) );
        }

        $defaults = fotogrids_get_default_gallery_settings();

        $settings_saved = 0;
        foreach ( $defaults as $setting_key => $default_value ) {
            $post_key = 'fotogrids_' . $setting_key;

            if ( isset( $_POST[$post_key] ) ) {
                $value = $_POST[$post_key];
                $settings_saved++;

                if ( is_array( $default_value ) ) {
                    if ( is_string( $value ) ) {
                        $decoded = json_decode( $value, true );
                        if ( json_last_error() === JSON_ERROR_NONE ) {
                            update_post_meta( $post_id, $post_key, $value );
                        }
                    } else if ( is_array( $value ) ) {
                        update_post_meta( $post_id, $post_key, json_encode( $value ) );
                    }
                } else if ( is_bool( $default_value ) ) {
                    $bool_value = ( $value === '1' || $value === 'true' || $value === true ) ? '1' : '0';
                    update_post_meta( $post_id, $post_key, $bool_value );
                } else if ( is_numeric( $default_value ) ) {
                    update_post_meta( $post_id, $post_key, sanitize_text_field( $value ) );
                } else {
                    update_post_meta( $post_id, $post_key, sanitize_text_field( $value ) );
                }
            }
        }

        $collection_type = $post->post_type === 'fotogrids_album' ? __( 'Album', 'fotogrids' ) : __( 'Gallery', 'fotogrids' );
        wp_send_json_success( array(
            'message' => sprintf( __( '%s saved successfully', 'fotogrids' ), $collection_type ),
            'post_id' => $post_id,
            'post_title' => get_the_title( $post_id ),
            'post_type' => $post->post_type,
            'redirect_url' => get_edit_post_link( $post_id, 'raw' )
        ) );
    }

    /**
     * AJAX handler for reordering gallery items
     */
    public static function ajax_reorder_gallery_items() {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( array( 'message' => __( 'Insufficient permissions', 'fotogrids' ) ) );
        }

        $gallery_id = intval( $_POST['gallery_id'] ?? 0 );
        if ( ! $gallery_id ) {
            wp_send_json_error( array( 'message' => __( 'Invalid gallery ID', 'fotogrids' ) ) );
        }

        $post = get_post( $gallery_id );
        if ( ! $post || $post->post_type !== 'fotogrids_gallery' ) {
            wp_send_json_error( array( 'message' => __( 'Invalid gallery', 'fotogrids' ) ) );
        }

        if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Cannot edit this gallery', 'fotogrids' ) ) );
        }

        $item_order = isset( $_POST['item_order'] ) ? json_decode( stripslashes( $_POST['item_order'] ), true ) : array();
        if ( ! is_array( $item_order ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid item order data', 'fotogrids' ) ) );
        }

        // Use the helper function to reorder items
        $result = fotogrids_reorder_gallery_items( $gallery_id, $item_order );

        if ( $result ) {
            wp_send_json_success( array(
                'message' => __( 'Items reordered successfully', 'fotogrids' ),
                'gallery_id' => $gallery_id,
                'item_order' => $item_order
            ) );
        } else {
            wp_send_json_error( array( 'message' => __( 'Failed to reorder items', 'fotogrids' ) ) );
        }
    }

    /**
     * AJAX handler to set favorite item for gallery
     */
    public static function ajax_set_favorite_item() {
        check_ajax_referer( 'fotogrids_item_edit', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( array( 'message' => __( 'Insufficient permissions', 'fotogrids' ) ) );
        }

        $gallery_id = intval( $_POST['gallery_id'] ?? 0 );
        if ( ! $gallery_id ) {
            wp_send_json_error( array( 'message' => __( 'Invalid gallery ID', 'fotogrids' ) ) );
        }

        $post = get_post( $gallery_id );
        if ( ! $post || $post->post_type !== 'fotogrids_gallery' ) {
            wp_send_json_error( array( 'message' => __( 'Invalid gallery', 'fotogrids' ) ) );
        }

        if ( ! current_user_can( 'edit_post', $gallery_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Cannot edit this gallery', 'fotogrids' ) ) );
        }

        $item_id = isset( $_POST['item_id'] ) && $_POST['item_id'] !== '' ? intval( $_POST['item_id'] ) : null;

        if ( $item_id !== null ) {
            $gallery_items = get_post_meta( $gallery_id, 'fotogrids_gallery_items', true );
            $gallery_items = $gallery_items ? json_decode( $gallery_items, true ) : array();

            if ( ! in_array( $item_id, $gallery_items ) ) {
                wp_send_json_error( array( 'message' => __( 'Item not found in gallery', 'fotogrids' ) ) );
            }
        }

        if ( $item_id !== null ) {
            update_post_meta( $gallery_id, 'fotogrids_gallery_favorite_item', $item_id );
        } else {
            delete_post_meta( $gallery_id, 'fotogrids_gallery_favorite_item' );
        }

        wp_send_json_success( array(
            'message' => __( 'Favorite item updated successfully', 'fotogrids' ),
            'favorite_item_id' => $item_id
        ) );
    }
}
