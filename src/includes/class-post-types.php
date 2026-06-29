<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Custom Post Types Class
 *
 * Registers and manages FotoGrids custom post types
 */
class Post_Types {

	/**
	 * Initialize the class
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_cpts' ) );
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
		add_action( 'add_meta_boxes', array( __CLASS__, 'hide_featured_image_metabox' ), 99 );
		add_action( 'save_post_fotogrids_gallery', array( __CLASS__, 'save_featured_image' ), 10, 2 );
		add_action( 'save_post_fotogrids_album', array( __CLASS__, 'save_featured_image' ), 10, 2 );

		add_filter( 'use_block_editor_for_post_type', array( __CLASS__, 'disable_gutenberg' ), 10, 2 );
	}

	/**
	 * Meta key holding the collection's custom Featured / Share Image.
	 *
	 * An attachment ID chosen through the Featured / Share Image metabox. The
	 * image need not be part of the gallery, which is why it cannot share
	 * `_thumbnail_id` (that slot backs the in-gallery "Featured Item" star
	 * picker and is validated against the gallery's item list). When set, it
	 * is the top tier of `Cover_Resolver`'s resolution chain.
	 *
	 * @since 1.0.0
	 * @var string
	 */
	const FEATURED_IMAGE_META_KEY = 'fotogrids_featured_image_id';

	/**
	 * Register the custom Featured / Share Image meta on both collection CPTs.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register_meta() {
		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			register_post_meta(
				$post_type,
				self::FEATURED_IMAGE_META_KEY,
				array(
					'type'              => 'integer',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'absint',
					'auth_callback'     => static function ( $allowed, $meta_key, $post_id ) {
						return current_user_can( 'manage_fotogrids', $post_id );
					},
				)
			);
		}
	}

	/**
	 * Hide the native WordPress Featured Image metabox for FotoGrids CPTs.
	 *
	 * The gallery CPT declares 'thumbnail' support so that `_thumbnail_id`
	 * is a first-class field (read by `get_post_thumbnail_id()` from REST
	 * handlers, statistics, OG, etc.), but the user-facing way to choose
	 * the cover is the in-metabox "Featured Item" star picker on each
	 * gallery item - not the generic media-library Featured Image picker.
	 * Showing both pickers would confuse users.
	 *
	 * Albums don't declare 'thumbnail' support (their cover is resolved
	 * at runtime from the chosen child gallery), so this is a no-op for
	 * them - included for safety in case that ever changes.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function hide_featured_image_metabox() {
		remove_meta_box( 'postimagediv', 'fotogrids_gallery', 'side' );
		remove_meta_box( 'postimagediv', 'fotogrids_album', 'side' );
	}

	/**
	 * Register custom post types
	 *
	 * Registers both Gallery and Album custom post types with their
	 * respective labels, capabilities, and settings.
	 *
	 * @since 1.0.0
	 */
	public static function register_cpts() {
		self::register_gallery_cpt();

		self::register_album_cpt();

		self::register_embed_cpt();
	}

	/**
	 * Register Gallery Custom Post Type
	 *
	 * Creates the fotogrids_gallery post type with appropriate labels,
	 * capabilities, and REST API support. Post type is private but
	 * accessible through the admin interface.
	 *
	 * @since 1.0.0
	 */
	private static function register_gallery_cpt() {
		$labels = array(
			'name'                  => _x( 'Galleries', 'Post type general name', 'fotogrids' ),
			'singular_name'         => _x( 'Gallery', 'Post type singular name', 'fotogrids' ),
			'menu_name'             => _x( 'Galleries', 'Admin Menu text', 'fotogrids' ),
			'name_admin_bar'        => _x( 'Gallery', 'Add New on Toolbar', 'fotogrids' ),
			'add_new'               => __( 'Add New', 'fotogrids' ),
			'add_new_item'          => __( 'Add New Gallery', 'fotogrids' ),
			'new_item'              => __( 'New Gallery', 'fotogrids' ),
			'edit_item'             => __( 'Edit Gallery', 'fotogrids' ),
			'view_item'             => __( 'View Gallery', 'fotogrids' ),
			'all_items'             => __( 'All Galleries', 'fotogrids' ),
			'search_items'          => __( 'Search Galleries', 'fotogrids' ),
			'parent_item_colon'     => __( 'Parent Galleries:', 'fotogrids' ),
			'not_found'             => __( 'No galleries found.', 'fotogrids' ),
			'not_found_in_trash'    => __( 'No galleries found in Trash.', 'fotogrids' ),
			'featured_item'         => _x( 'Gallery Featured Item', 'Overrides the "Featured Item" phrase', 'fotogrids' ),
			'set_featured_item'     => _x( 'Set featured item', 'Overrides the "Set featured item" phrase', 'fotogrids' ),
			'remove_featured_item'  => _x( 'Remove featured item', 'Overrides the "Remove featured item" phrase', 'fotogrids' ),
			'use_featured_item'     => _x( 'Use as featured item', 'Overrides the "Use as featured item" phrase', 'fotogrids' ),
			'archives'              => _x( 'Gallery archives', 'The post type archive label', 'fotogrids' ),
			'insert_into_item'      => _x( 'Insert into gallery', 'Overrides the "Insert into post" phrase', 'fotogrids' ),
			'uploaded_to_this_item' => _x( 'Uploaded to this gallery', 'Overrides the "Uploaded to this post" phrase', 'fotogrids' ),
			'filter_items_list'     => _x( 'Filter galleries list', 'Screen reader text for the filter links', 'fotogrids' ),
			'items_list_navigation' => _x( 'Galleries list navigation', 'Screen reader text for the pagination', 'fotogrids' ),
			'items_list'            => _x( 'Galleries list', 'Screen reader text for the items list', 'fotogrids' ),
		);

		$args = array(
			'labels'                => $labels,
			'public'                => false,
			// The View Collections module may override publicly_queryable and
			// rewrite via the register_post_type_args filter.
			'publicly_queryable'    => false,
			'show_ui'               => true,
			'show_in_menu'          => false,
			'query_var'             => true,
			'rewrite'               => array( 'slug' => 'fotogrids-gallery' ),
			'capability_type'       => array( 'fotogrids_gallery', 'fotogrids_galleries' ),
			'map_meta_cap'          => true,
			'has_archive'           => false,
			'hierarchical'          => false,
			'menu_position'         => null,
			'menu_icon'             => 'dashicons-format-gallery',
			// 'title'    - gallery name shown in lists and as the page <title>.
			// 'thumbnail' - backs the Featured Item picker via WP-native
			//               `_thumbnail_id`. The native Featured Image
			//               metabox is hidden in `hide_featured_image_metabox()`.
			// 'excerpt'  - backs the `og:description` fallback chain. The
			//               native Excerpt metabox renders below the title
			//               unless the user has hidden it via Screen Options.
			'supports'              => array( 'title', 'thumbnail', 'excerpt' ),
			'show_in_rest'          => true,
			'rest_base'             => 'fotogrids-galleries',
			'rest_controller_class' => 'WP_REST_Posts_Controller',
		);

		register_post_type( 'fotogrids_gallery', $args );
	}

	/**
	 * Register Album Custom Post Type
	 *
	 * Creates the fotogrids_album post type with appropriate labels,
	 * capabilities, and REST API support. Albums serve as containers
	 * for organizing multiple galleries.
	 *
	 * @since 1.0.0
	 */
	private static function register_album_cpt() {
		$labels = array(
			'name'                  => _x( 'Albums', 'Post type general name', 'fotogrids' ),
			'singular_name'         => _x( 'Album', 'Post type singular name', 'fotogrids' ),
			'menu_name'             => _x( 'Albums', 'Admin Menu text', 'fotogrids' ),
			'name_admin_bar'        => _x( 'Album', 'Add New on Toolbar', 'fotogrids' ),
			'add_new'               => __( 'Add New', 'fotogrids' ),
			'add_new_item'          => __( 'Add New Album', 'fotogrids' ),
			'new_item'              => __( 'New Album', 'fotogrids' ),
			'edit_item'             => __( 'Edit Album', 'fotogrids' ),
			'view_item'             => __( 'View Album', 'fotogrids' ),
			'all_items'             => __( 'All Albums', 'fotogrids' ),
			'search_items'          => __( 'Search Albums', 'fotogrids' ),
			'parent_item_colon'     => __( 'Parent Albums:', 'fotogrids' ),
			'not_found'             => __( 'No albums found.', 'fotogrids' ),
			'not_found_in_trash'    => __( 'No albums found in Trash.', 'fotogrids' ),
			'featured_item'         => _x( 'Album Featured Item', 'Overrides the "Featured Item" phrase', 'fotogrids' ),
			'set_featured_item'     => _x( 'Set featured item', 'Overrides the "Set featured item" phrase', 'fotogrids' ),
			'remove_featured_item'  => _x( 'Remove featured item', 'Overrides the "Remove featured item" phrase', 'fotogrids' ),
			'use_featured_item'     => _x( 'Use as featured item', 'Overrides the "Use as featured item" phrase', 'fotogrids' ),
			'archives'              => _x( 'Album archives', 'The post type archive label', 'fotogrids' ),
			'insert_into_item'      => _x( 'Insert into album', 'Overrides the "Insert into post" phrase', 'fotogrids' ),
			'uploaded_to_this_item' => _x( 'Uploaded to this album', 'Overrides the "Uploaded to this post" phrase', 'fotogrids' ),
			'filter_items_list'     => _x( 'Filter albums list', 'Screen reader text for the filter links', 'fotogrids' ),
			'items_list_navigation' => _x( 'Albums list navigation', 'Screen reader text for the pagination', 'fotogrids' ),
			'items_list'            => _x( 'Albums list', 'Screen reader text for the items list', 'fotogrids' ),
		);

		$args = array(
			'labels'                => $labels,
			'public'                => false,
			// The View Collections module may override publicly_queryable and
			// rewrite via the register_post_type_args filter.
			'publicly_queryable'    => false,
			'show_ui'               => true,
			'show_in_menu'          => false,
			'query_var'             => true,
			'rewrite'               => array( 'slug' => 'fotogrids-album' ),
			'capability_type'       => array( 'fotogrids_album', 'fotogrids_albums' ),
			'map_meta_cap'          => true,
			'has_archive'           => false,
			'hierarchical'          => false,
			'menu_position'         => null,
			'menu_icon'             => 'dashicons-album',
			// 'title'   - album name shown in lists and as the page <title>.
			// 'excerpt' - backs the `og:description` fallback chain for albums.
			// Albums intentionally do NOT declare 'thumbnail' support - the
			// album cover is resolved at runtime from the Featured Gallery
			// (see `Cover_Resolver::for_album()`), not stored
			// as a native `_thumbnail_id` on the album post.
			'supports'              => array( 'title', 'excerpt' ),
			'show_in_rest'          => true,
			'rest_base'             => 'fotogrids-albums',
			'rest_controller_class' => 'WP_REST_Posts_Controller',
		);

		register_post_type( 'fotogrids_album', $args );
	}

	/**
	 * Register Embed Custom Post Type
	 *
	 * Creates the fotogrids_embed post type used to represent virtual video
	 * embed items (YouTube / Vimeo). Embeds are real posts so their IDs can
	 * live in a gallery's item list alongside attachment IDs (post IDs are
	 * globally unique, so there is no collision), which lets them participate
	 * in manual ordering and sorting exactly like attachments.
	 *
	 * The type has no admin UI of its own - embeds are created, edited, and
	 * deleted entirely through the gallery items metabox. It declares 'title'
	 * (the caption) and 'thumbnail' (the custom poster via _thumbnail_id).
	 *
	 * @since 1.1.0
	 */
	private static function register_embed_cpt() {
		$args = array(
			'labels'              => array(
				'name'          => _x( 'Video Embeds', 'Post type general name', 'fotogrids' ),
				'singular_name' => _x( 'Video Embed', 'Post type singular name', 'fotogrids' ),
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			'exclude_from_search' => true,
			'query_var'           => false,
			'rewrite'             => false,
			// Embeds have no admin screen and are created only through the
			// gallery items REST endpoints, which already gate on
			// `manage_fotogrids`. The CPT itself uses standard 'post'
			// capabilities (which admins and editors already hold) so embed
			// posts can be written without remapping caps - remapping primitive
			// caps to `manage_fotogrids` interferes with map_meta_cap when that
			// capability is itself checked.
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'has_archive'         => false,
			'hierarchical'        => false,
			// 'title'     - the embed caption.
			// 'thumbnail' - backs the custom poster via WP-native _thumbnail_id.
			'supports'            => array( 'title', 'thumbnail' ),
			'show_in_rest'        => false,
		);

		register_post_type( 'fotogrids_embed', $args );
	}

	/**
	 * Add meta boxes to post edit screens
	 *
	 * Registers meta boxes for both gallery and album post types.
	 * Gallery meta boxes include shortcode display, while album meta boxes
	 * include gallery management, settings, and shortcode display.
	 *
	 * @since 1.0.0
	 */
	public static function add_meta_boxes() {
		global $post;

		$is_saved = $post && $post->ID > 0 && 'auto-draft' !== $post->post_status;

		if ( $is_saved ) {
			add_meta_box(
				'fotogrids_gallery_shortcode',
				__( 'Gallery Shortcode', 'fotogrids' ),
				array( __CLASS__, 'shortcode_meta_box' ),
				'fotogrids_gallery',
				'side',
				'high'
			);

			add_meta_box(
				'fotogrids_album_shortcode',
				__( 'Album Shortcode', 'fotogrids' ),
				array( __CLASS__, 'shortcode_meta_box' ),
				'fotogrids_album',
				'side',
				'high'
			);
		}

		add_meta_box(
			'fotogrids_album_galleries',
			__( 'Galleries', 'fotogrids' ),
			array( __CLASS__, 'album_galleries_meta_box' ),
			'fotogrids_album',
			'normal',
			'high'
		);

		foreach ( array( 'fotogrids_gallery', 'fotogrids_album' ) as $post_type ) {
			add_meta_box(
				'fotogrids_featured_image',
				__( 'Featured / Share Image', 'fotogrids' ),
				array( __CLASS__, 'featured_image_meta_box' ),
				$post_type,
				'side',
				'low'
			);
		}
	}

	/**
	 * Featured / Share Image metabox callback.
	 *
	 * A media-library picker that writes `fotogrids_featured_image_id`. This is
	 * the collection-level cover and default social-share image; it may point
	 * at any attachment, including one that is not in the gallery. When unset,
	 * `Cover_Resolver` falls back to the in-gallery Featured Item (or the album's
	 * featured child gallery) and finally the first item.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Current collection post.
	 * @return void
	 */
	public static function featured_image_meta_box( $post ) {
		wp_nonce_field( 'fotogrids_featured_image', 'fotogrids_featured_image_nonce' );

		$attachment_id = (int) get_post_meta( $post->ID, self::FEATURED_IMAGE_META_KEY, true );
		$thumb_url     = $attachment_id > 0 ? (string) wp_get_attachment_image_url( $attachment_id, 'medium' ) : '';
		$has_image     = '' !== $thumb_url;

		$is_album    = 'fotogrids_album' === $post->post_type;
		$description = $is_album
			? __( 'Used as the album cover and social-share image. If left empty, FotoGrids uses the featured gallery’s cover, then the first available image.', 'fotogrids' )
			: __( 'Used as the gallery cover and social-share image. If left empty, FotoGrids uses the featured item, then the first image in the gallery.', 'fotogrids' );
		?>
		<div class="fotogrids-featured-image" data-fg-featured-image>
			<div class="fotogrids-featured-image__preview"<?php echo $has_image ? '' : ' hidden'; ?> data-fg-featured-image-preview>
				<?php if ( $has_image ) : ?>
					<img src="<?php echo esc_url( $thumb_url ); ?>" alt="" />
				<?php endif; ?>
			</div>
			<input type="hidden"
				name="fotogrids_featured_image_id"
				value="<?php echo esc_attr( (string) ( $attachment_id > 0 ? $attachment_id : '' ) ); ?>"
				data-fg-featured-image-input />
			<p class="fotogrids-featured-image__actions">
				<button type="button" class="button fotogrids-featured-image__set" data-fg-featured-image-set>
					<?php echo $has_image ? esc_html__( 'Replace image', 'fotogrids' ) : esc_html__( 'Set featured image', 'fotogrids' ); ?>
				</button>
				<button type="button" class="button-link fotogrids-featured-image__remove"<?php echo $has_image ? '' : ' hidden'; ?> data-fg-featured-image-remove>
					<?php esc_html_e( 'Remove', 'fotogrids' ); ?>
				</button>
			</p>
			<p class="description"><?php echo esc_html( $description ); ?></p>
		</div>
		<?php
	}

	/**
	 * Persist the Featured / Share Image attachment ID.
	 *
	 * @since 1.0.0
	 * @param int      $post_id Post ID being saved.
	 * @param \WP_Post $post    Post object being saved.
	 * @return void
	 */
	public static function save_featured_image( $post_id, $post ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by the save_post_{type} hook contract; $post intentionally unused.
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( ! isset( $_POST['fotogrids_featured_image_nonce'] )
			|| ! wp_verify_nonce(
				sanitize_text_field( wp_unslash( $_POST['fotogrids_featured_image_nonce'] ) ),
				'fotogrids_featured_image'
			)
		) {
			return;
		}

		if ( ! current_user_can( 'manage_fotogrids', $post_id ) ) {
			return;
		}

		$raw           = isset( $_POST['fotogrids_featured_image_id'] )
			? absint( wp_unslash( $_POST['fotogrids_featured_image_id'] ) )
			: 0;
		$attachment_id = 0;

		if ( $raw > 0 ) {
			$attachment = get_post( $raw );
			if ( $attachment && 'attachment' === $attachment->post_type && wp_attachment_is_image( $raw ) ) {
				$attachment_id = $raw;
			}
		}

		if ( $attachment_id > 0 ) {
			update_post_meta( $post_id, self::FEATURED_IMAGE_META_KEY, $attachment_id );
		} else {
			delete_post_meta( $post_id, self::FEATURED_IMAGE_META_KEY );
		}
	}

	/**
	 * Shared shortcode meta box callback
	 *
	 * Displays the appropriate shortcode for both galleries and albums.
	 * Shown for any saved post status (draft, publish, pending, etc.) so users
	 * can copy the shortcode as soon as the post has been saved once.
	 * Determines the post type and generates the correct shortcode format.
	 * Includes copy functionality for easy shortcode usage.
	 *
	 * @since 1.0.0
	 *
	 * @param WP_Post $post The post object
	 */
	public static function shortcode_meta_box( $post ) {
		$post_id   = (int) $post->ID;
		$post_type = get_post_type( $post );

		if ( 'fotogrids_gallery' === $post_type ) {
			$shortcode  = '[fotogrids_gallery id="' . $post_id . '"]';
			$type_label = __( 'gallery', 'fotogrids' );
		} else {
			$shortcode  = '[fotogrids_album id="' . $post_id . '"]';
			$type_label = __( 'album', 'fotogrids' );
		}

		?>
		<?php /* translators: %s: collection type label (gallery or album). */ ?>
		<p class="fotogrids-shortcode-title"><?php printf( esc_html__( 'Use this shortcode to display the %s', 'fotogrids' ), esc_html( $type_label ) ); ?></p>
		<div class="fotogrids-shortcode-container">
			<input type="text" value="<?php echo esc_attr( $shortcode ); ?>"
				readonly onclick="this.select();" class="fotogrids-shortcode-input" />
			<button type="button" class="fg-button fg-button--outline fg-button--variant-primary fg-button--icon-only fotogrids-shortcode-copy"
				data-shortcode="<?php echo esc_attr( $shortcode ); ?>"
				data-fg-tooltip="<?php esc_attr_e( 'Copy shortcode to clipboard', 'fotogrids' ); ?>"
				data-fg-tooltip-dir="below"
				aria-label="<?php esc_attr_e( 'Copy shortcode to clipboard', 'fotogrids' ); ?>">
				<span class="fotogrids-icon" data-icon="clipboard"></span>
			</button>
		</div>
		<?php if ( 'publish' !== $post->post_status ) : ?>
		<p class="description"><?php esc_html_e( 'Publish to display on the frontend.', 'fotogrids' ); ?></p>
		<?php endif; ?>
		<?php
	}

	/**
	 * Album galleries meta box callback
	 *
	 * Renders the React component container for managing gallery assignments
	 * within an album. The actual functionality is handled by the React component.
	 *
	 * @since 1.0.0
	 *
	 * @param WP_Post $post The album post object
	 */
	public static function album_galleries_meta_box( $post ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		wp_nonce_field( 'fotogrids_album_galleries', 'fotogrids_album_galleries_nonce' );

		?>
		<div id="fotogrids-album-galleries-root">
			<div class="fotogrids-loading">
				<span class="spinner fg-is-active"></span>
				<?php esc_html_e( 'Loading gallery manager...', 'fotogrids' ); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Disable Gutenberg block editor for FotoGrids post types
	 *
	 * Prevents the block editor from being used on FotoGrids custom post types
	 * since they use custom meta boxes and React components for content management.
	 *
	 * @since 1.0.0
	 *
	 * @param bool   $current_status Current block editor status
	 * @param string $post_type      Post type being checked
	 * @return bool Whether to use block editor
	 */
	public static function disable_gutenberg( $current_status, $post_type ) {
		if ( in_array( $post_type, array( 'fotogrids_gallery', 'fotogrids_album', 'fotogrids_embed' ), true ) ) {
			return false;
		}

		return $current_status;
	}
}
