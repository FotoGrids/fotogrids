<?php
/**
 * Builds the standalone view page shell around a collection.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Renders the regions of a collection view page.
 *
 * The gallery and album markup comes from the existing Public_Render pipeline;
 * this class only produces the surrounding shell (head, header, footer, share)
 * and exposes a filter at each region so Pro and third parties can extend it.
 *
 * @since 1.0.0
 */
class Renderer {

    /**
     * The collection being rendered.
     *
     * @var \WP_Post
     */
    private $post;

    /**
     * Resolved view page settings for the collection.
     *
     * @var array<string,mixed>
     */
    private $settings;

    /**
     * @since 1.0.0
     * @param \WP_Post $post The collection being rendered.
     */
    private function __construct( \WP_Post $post ) {
        $this->post     = $post;
        $this->settings = Settings::get( (int) $post->ID );
    }

    /**
     * Build a renderer for a collection.
     *
     * @since 1.0.0
     * @param \WP_Post $post The collection being rendered.
     * @return self
     */
    public static function for_post( \WP_Post $post ): self {
        return new self( $post );
    }

    /**
     * Whether the collection is an album.
     *
     * @since 1.0.0
     * @return bool
     */
    public function is_album(): bool {
        return $this->post->post_type === 'fotogrids_album';
    }

    /**
     * Whether the collection is being previewed as a draft by an editor.
     *
     * @since 1.0.0
     * @return bool
     */
    public function is_draft_preview(): bool {
        return $this->post->post_status !== 'publish';
    }

    /**
     * Document title for the view page.
     *
     * @since 1.0.0
     * @return string
     */
    public function page_title(): string {
        $title = get_the_title( $this->post ) . ' - ' . get_bloginfo( 'name' );

        /**
         * Filter the view page document title.
         *
         * @since 1.0.0
         * @param string   $title
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/page_title', $title, $this->post );
    }

    /**
     * Robots / canonical meta for the document head.
     *
     * @since 1.0.0
     * @return string
     */
    public function head_meta(): string {
        $noindex = ! empty( $this->settings['noindex'] ) || empty( $this->settings['index'] ) || $this->is_draft_preview();

        /**
         * Filter whether the view page is excluded from search engines.
         *
         * @since 1.0.0
         * @param bool     $noindex
         * @param \WP_Post $post
         */
        $noindex = (bool) apply_filters( 'fotogrids/view/robots', $noindex, $this->post );

        $meta = '';
        if ( $noindex ) {
            $meta .= '<meta name="robots" content="noindex, nofollow">' . "\n";
        }
        $meta .= '<link rel="canonical" href="' . esc_url( get_permalink( $this->post ) ) . '">' . "\n";
        $meta .= $this->open_graph_meta();

        /**
         * Filter the raw head meta markup (Pro injects OG and Twitter tags).
         *
         * @since 1.0.0
         * @param string   $meta
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/head_meta', $meta, $this->post );
    }

    /**
     * Open Graph and Twitter card markup.
     *
     * Emits collection-level tags by default. When a valid deep-linked item is
     * present in the request (?fg-item) and belongs to a gallery, emits per-item
     * tags so a shared image renders a rich preview.
     *
     * @since 1.0.0
     * @return string
     */
    private function open_graph_meta(): string {
        $title       = get_the_title( $this->post );
        $description = '';
        $image       = '';
        $url         = get_permalink( $this->post );

        $item = $this->deep_linked_item();
        if ( $item ) {
            $title       = $item['title'] !== '' ? $item['title'] : $title;
            $description = $item['caption'];
            $image       = $item['image'];
            $url         = add_query_arg( 'fg-item', $item['id'], $url );
        } elseif ( ! $this->is_album() ) {
            $thumb_id = get_post_thumbnail_id( $this->post->ID );
            if ( $thumb_id ) {
                $src = wp_get_attachment_image_src( $thumb_id, 'large' );
                $image = $src ? $src[0] : '';
            }
        }

        $tags  = '<meta property="og:type" content="website">' . "\n";
        $tags .= '<meta property="og:title" content="' . esc_attr( $title ) . '">' . "\n";
        $tags .= '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
        if ( $description !== '' ) {
            $tags .= '<meta property="og:description" content="' . esc_attr( $description ) . '">' . "\n";
        }
        if ( $image !== '' ) {
            $tags .= '<meta property="og:image" content="' . esc_url( $image ) . '">' . "\n";
            $tags .= '<meta name="twitter:card" content="summary_large_image">' . "\n";
            $tags .= '<meta name="twitter:image" content="' . esc_url( $image ) . '">' . "\n";
        }
        $tags .= '<meta name="twitter:title" content="' . esc_attr( $title ) . '">' . "\n";

        return $tags;
    }

    /**
     * Resolve the deep-linked item from the request, if it belongs to this
     * collection's gallery.
     *
     * @since 1.0.0
     * @return array{id:int,title:string,caption:string,image:string}|null
     */
    private function deep_linked_item(): ?array {
        $item_id = isset( $_GET['fg-item'] ) ? absint( wp_unslash( $_GET['fg-item'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        if ( $item_id <= 0 || $this->is_album() ) {
            return null;
        }

        $item_ids = fotogrids_get_gallery_item_ids( (int) $this->post->ID );
        if ( ! in_array( $item_id, array_map( 'absint', (array) $item_ids ), true ) ) {
            return null;
        }

        $caption = '';
        foreach ( fotogrids_get_gallery_items( (int) $this->post->ID ) as $item ) {
            if ( (int) ( $item['id'] ?? 0 ) === $item_id ) {
                $caption = (string) ( $item['caption'] ?? '' );
                break;
            }
        }

        $src = wp_get_attachment_image_src( $item_id, 'large' );

        return array(
            'id'      => $item_id,
            'title'   => get_the_title( $item_id ),
            'caption' => $caption,
            'image'   => $src ? $src[0] : '',
        );
    }

    /**
     * Body element attributes.
     *
     * @since 1.0.0
     * @return string
     */
    public function body_attrs(): string {
        $theme   = $this->settings['theme'] ?? 'light';
        $classes = array(
            'fotogrids-view',
            'fotogrids-view--' . ( $this->is_album() ? 'album' : 'gallery' ),
            'fotogrids-view--theme-' . ( $theme === 'dark' ? 'dark' : 'light' ),
        );

        /**
         * Filter the view page body classes.
         *
         * @since 1.0.0
         * @param string[] $classes
         * @param \WP_Post  $post
         */
        $classes = (array) apply_filters( 'fotogrids/view/body_classes', $classes, $this->post );
        $classes = array_map( 'sanitize_html_class', $classes );

        $accent     = $this->settings['accent_color'] ?? '#3c46f0';
        $max_width  = absint( $this->settings['max_width'] ?? 1200 );
        $style_vars = sprintf( '--fg-view-accent:%s;--fg-view-max-width:%dpx;', $accent, $max_width );

        return 'class="' . esc_attr( implode( ' ', $classes ) ) . '"'
            . ' style="' . esc_attr( $style_vars ) . '"';
    }

    /**
     * Whether the page header (title + count) should be shown.
     *
     * @since 1.0.0
     * @return bool
     */
    public function shows_header(): bool {
        $show = ! empty( $this->settings['show_header'] );

        /**
         * Filter whether the view page header is shown.
         *
         * @since 1.0.0
         * @param bool     $show
         * @param \WP_Post $post
         */
        return (bool) apply_filters( 'fotogrids/view/show_header', $show, $this->post );
    }

    /**
     * Header region markup.
     *
     * @since 1.0.0
     * @return string
     */
    public function header_html(): string {
        $count = $this->is_album()
            ? count( \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( (int) $this->post->ID ) )
            : fotogrids_get_gallery_item_count( (int) $this->post->ID );

        $meta_label = $this->is_album()
            ? sprintf( _n( '%d gallery', '%d galleries', $count, 'fotogrids' ), $count )
            : sprintf( _n( '%d item', '%d items', $count, 'fotogrids' ), $count );

        $html  = '<h1 class="fotogrids-view__title">' . esc_html( get_the_title( $this->post ) ) . '</h1>';
        $html .= '<div class="fotogrids-view__meta">' . esc_html( $meta_label ) . '</div>';

        /**
         * Filter the header region markup.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/header_html', $html, $this->post );
    }

    /**
     * Gallery or album markup from the existing render pipeline.
     *
     * @since 1.0.0
     * @return string
     */
    public function gallery_html(): string {
        if ( ! class_exists( '\FotoGrids\Public_Render' ) ) {
            require_once FOTOGRIDS_PLUGIN_DIR . 'public/public-render.php';
        }

        if ( $this->is_album() ) {
            $html = \FotoGrids\Public_Render::album_shortcode( array( 'id' => (int) $this->post->ID ) );
        } elseif ( $this->is_draft_preview() ) {
            $html = \FotoGrids\Public_Render::render_gallery_preview( (int) $this->post->ID );
        } else {
            $html = \FotoGrids\Public_Render::gallery_shortcode( array( 'id' => (int) $this->post->ID ) );
        }

        /**
         * Filter the gallery/album markup before it is placed in the shell.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/gallery_html', $html, $this->post );
    }

    /**
     * Share controls for the view page footer.
     *
     * Renders the resolved share network set when sharing is enabled for the
     * collection and the view_page placement applies; the frontend draws the
     * buttons from the config in the data attribute. Otherwise falls back to a
     * copy-link button so a shareable page always offers at least that.
     *
     * @since 1.0.0
     * @return string
     */
    public function share_html(): string {
        $url      = get_permalink( $this->post );
        $resolved = fotogrids_get_resolved_sharing( (int) $this->post->ID );

        $shows_footer_bar = ! empty( $resolved['enabled'] )
            && in_array( 'view_page', (array) $resolved['placements'], true );

        if ( $shows_footer_bar ) {
            $config = wp_json_encode(
                array(
                    'enabled'      => true,
                    'networks'     => $resolved['networks'],
                    'placements'   => $resolved['placements'],
                    'button_style' => $resolved['button_style'],
                    'button_size'  => $resolved['button_size'],
                )
            );
            $html = '<div class="fotogrids-view__share" data-fg-share-footer="' . esc_attr( $config ) . '"></div>';
        } else {
            $html = '<button type="button" class="fotogrids-view__share-copy"'
                . ' data-url="' . esc_url( $url ) . '"'
                . ' data-copied-label="' . esc_attr__( 'Copied!', 'fotogrids' ) . '">'
                . esc_html__( 'Copy link', 'fotogrids' )
                . '</button>';
        }

        /**
         * Filter the share controls markup.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/share_buttons', $html, $this->post );
    }

    /**
     * Footer credit markup.
     *
     * @since 1.0.0
     * @return string
     */
    public function footer_credit_html(): string {
        /**
         * Filter the footer credit markup. Empty by default; a seam for
         * optionally adding footer content.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( 'fotogrids/view/footer_credit', '', $this->post );
    }

    /**
     * Enqueue the assets the view page needs.
     *
     * Runs the frontend gallery assets and the standalone shell stylesheet. The
     * gallery render pipeline also registers its own per-render assets, which
     * flush through wp_head / wp_footer in the shell template.
     *
     * @since 1.0.0
     * @return void
     */
    public function enqueue_assets(): void {
        wp_enqueue_script(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/frontend.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-frontend',
            FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_enqueue_style(
            'fotogrids-view-collection',
            FOTOGRIDS_PLUGIN_URL . 'includes/modules/ViewCollections/assets/view-collection.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_enqueue_script(
            'fotogrids-view-collection-share',
            FOTOGRIDS_PLUGIN_URL . 'includes/modules/ViewCollections/assets/view-collection-share.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_script(
            'fotogrids-deep-linking',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/deep-linking.js',
            array( 'fotogrids-frontend' ),
            FOTOGRIDS_VERSION,
            true
        );

        wp_enqueue_style(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-tooltip.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_enqueue_script(
            'fotogrids-fg-tooltip',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/fg-tooltip.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        $sharing = \FotoGrids\Settings\Sharing_Settings_Store::get();

        wp_localize_script(
            'fotogrids-frontend',
            'fotogrids',
            array(
                'restUrl'               => rest_url( 'fotogrids/v1/' ),
                'nonce'                 => wp_create_nonce( 'wp_rest' ),
                'stats_tracking'        => true,
                'lazy_load'             => true,
                'deep_linking_enabled'  => (bool) $sharing['deep_linking_enabled'],
                'embedded_share_target' => $sharing['embedded_share_target'],
            )
        );
    }

    /**
     * Record a view against the collection's statistics.
     *
     * Draft previews are not counted.
     *
     * @since 1.0.0
     * @return void
     */
    public function track_view(): void {
        if ( $this->is_draft_preview() ) {
            return;
        }

        $object_type = $this->is_album() ? 'album' : 'gallery';
        \FotoGrids\Statistics::increment( $object_type, (int) $this->post->ID, 'views' );

        /**
         * Fires after a view page visit is recorded.
         *
         * @since 1.0.0
         * @param \WP_Post $post
         */
        do_action( 'fotogrids/view/tracked', $this->post );
    }
}
