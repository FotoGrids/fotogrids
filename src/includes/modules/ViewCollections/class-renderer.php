<?php
/**
 * Builds the standalone view page shell around a collection.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Actions_View;
use FotoGrids\Hooks\Filters_View;

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
        return (string) apply_filters( Filters_View::PAGE_TITLE, $title, $this->post );
    }

    /**
     * Robots / canonical meta for the document head.
     *
     * @since 1.0.0
     * @return string
     */
    public function head_meta(): string {
        $seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );

        // Noindex chain (lowest to highest precedence):
        //   1. legacy view settings (`noindex` / `index`) for backwards-
        //      compatible behaviour with collections that pre-date the SEO tab
        //   2. the SEO tab's per-collection `fotogrids_noindex` toggle (true
        //      forces noindex; false alone does NOT override a draft preview)
        //   3. draft preview always wins — never index unsaved work
        //   4. the `fotogrids/view/robots` filter for code-level overrides
        $noindex = ! empty( $this->settings['noindex'] )
            || empty( $this->settings['index'] )
            || ! empty( $seo['noindex'] )
            || $this->is_draft_preview();

        /**
         * Filter whether the view page is excluded from search engines.
         *
         * @since 1.0.0
         * @param bool     $noindex
         * @param \WP_Post $post
         */
        $noindex = (bool) apply_filters( Filters_View::ROBOTS, $noindex, $this->post );

        // Canonical: per-collection override wins; otherwise the permalink.
        $canonical = $seo['canonical_override'] !== '' ? $seo['canonical_override'] : get_permalink( $this->post );

        /**
         * Filter the canonical URL emitted on the view page.
         *
         * Use this to inject a custom canonical (for example, on sites that
         * present the same gallery under multiple URLs and want a single
         * canonical pointer).
         *
         * @since 1.0.0
         * @param string   $canonical Default: permalink of the view page.
         * @param \WP_Post $post
         */
        $canonical = (string) apply_filters( Filters_View::CANONICAL, $canonical, $this->post );

        $meta = '';
        if ( $noindex ) {
            $meta .= '<meta name="robots" content="noindex, nofollow">' . "\n";
        }
        if ( $canonical !== '' ) {
            $meta .= '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\n";
        }
        $meta .= $this->open_graph_meta( $seo );

        /**
         * Filter the complete head-meta markup the view page emits.
         *
         * This is the catch-all string filter that runs after every granular
         * filter (og/title, og/description, og/image, og/url, og/type,
         * og/enabled, view/robots, view/canonical). Prefer the granular
         * filters for targeted changes — this one is for sites that need to
         * rewrite or completely replace the markup.
         *
         * @since 1.0.0
         * @param string   $meta
         * @param \WP_Post $post
         */
        return (string) apply_filters( Filters_View::HEAD_META, $meta, $this->post );
    }

    /**
     * Open Graph and Twitter card markup.
     *
     * Emits collection-level tags by default. When a valid deep-linked item is
     * present in the request (?fg-item) and belongs to a gallery, emits per-item
     * tags so a shared image renders a rich preview.
     *
     * Every field passes through a granular filter (fotogrids/view/og/title,
     * /og/description, /og/image, /og/url, /og/type, /og/enabled) so themes
     * and other plugins can adjust individual values without rewriting the
     * whole markup. The `fotogrids/view/og/enabled` filter is the conflict-
     * guard escape hatch for sites whose SEO plugin already emits OG tags.
     *
     * @since 1.0.0
     * @return string
     */
    private function open_graph_meta( ?array $seo = null ): string {
        if ( $seo === null ) {
            $seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );
        }

        $item = $this->deep_linked_item();

        // Master switch: site-wide "OG off" or per-collection "defer to other
        // SEO plugins" both kill OG emission before any filter runs.
        if ( empty( $seo['enable_open_graph'] ) || ! empty( $seo['defer_to_seo_plugins'] ) ) {
            return (string) apply_filters( Filters_View::OG_ENABLED, '', $this->post, $item );
        }

        /**
         * Filter whether OG/Twitter tags are emitted on this view page.
         *
         * Default true. Return false to suppress every OG and Twitter tag
         * (e.g. when another SEO plugin owns the head and FotoGrids should
         * stay out of the way for this specific page).
         *
         * @since 1.0.0
         * @param bool       $enabled  Default true.
         * @param \WP_Post   $post
         * @param array|null $item     Deep-linked item context (or null).
         */
        $enabled = (bool) apply_filters( Filters_View::OG_ENABLED, true, $this->post, $item );
        if ( ! $enabled ) {
            return '';
        }

        $title = (string) get_the_title( $this->post );
        $url   = (string) get_permalink( $this->post );
        $image = array(
            'id'     => 0,
            'url'    => '',
            'width'  => 0,
            'height' => 0,
            'alt'    => '',
        );
        $description = '';

        if ( $item ) {
            $title       = $item['title'] !== '' ? $item['title'] : $title;
            $description = (string) $item['caption'];
            $image = array(
                'id'     => (int) $item['id'],
                'url'    => (string) $item['image'],
                'width'  => (int) ( $item['image_width']  ?? 0 ),
                'height' => (int) ( $item['image_height'] ?? 0 ),
                'alt'    => (string) ( $item['image_alt'] ?? '' ),
            );
            $url = add_query_arg( 'fg-item', $item['id'], $url );
        } else {
            // Per-collection title override wins; else post title (already set).
            if ( $seo['og_title_override'] !== '' ) {
                $title = $seo['og_title_override'];
            }

            // Per-collection description override wins; else the layered chain.
            $description = $seo['og_description_override'] !== ''
                ? $seo['og_description_override']
                : $this->collection_description();

            // Image: custom > featured > plugin-wide fallback.
            $image_id = 0;
            if ( $seo['og_image_source'] === 'custom' && $seo['og_image_custom_id'] > 0 ) {
                $image_id = (int) $seo['og_image_custom_id'];
            }
            if ( $image_id <= 0 ) {
                $image_id = \FotoGrids\Galleries\Cover_Resolver::for_collection( (int) $this->post->ID );
            }
            if ( $image_id <= 0 && $seo['og_image_fallback_id'] > 0 ) {
                $image_id = (int) $seo['og_image_fallback_id'];
            }

            if ( $image_id ) {
                $src = wp_get_attachment_image_src( $image_id, 'large' );
                $image = array(
                    'id'     => $image_id,
                    'url'    => $src ? (string) $src[0] : '',
                    'width'  => $src ? (int) ( $src[1] ?? 0 ) : 0,
                    'height' => $src ? (int) ( $src[2] ?? 0 ) : 0,
                    'alt'    => (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true ),
                );
            }
        }

        $type = $this->og_type( $seo );

        /**
         * Filter the og:title emitted for a view page.
         *
         * @since 1.0.0
         * @param string     $title
         * @param \WP_Post   $post
         * @param array|null $item Deep-linked item context (or null).
         */
        $title = (string) apply_filters( Filters_View::OG_TITLE, $title, $this->post, $item );

        /**
         * Filter the og:description emitted for a view page.
         *
         * @since 1.0.0
         * @param string     $description
         * @param \WP_Post   $post
         * @param array|null $item Deep-linked item context (or null).
         */
        $description = (string) apply_filters( Filters_View::OG_DESCRIPTION, $description, $this->post, $item );

        /**
         * Filter the og:url emitted for a view page.
         *
         * @since 1.0.0
         * @param string     $url
         * @param \WP_Post   $post
         * @param array|null $item Deep-linked item context (or null).
         */
        $url = (string) apply_filters( Filters_View::OG_URL, $url, $this->post, $item );

        /**
         * Filter the og:image data structure emitted for a view page.
         *
         * Shape: array{id:int,url:string,width:int,height:int,alt:string}.
         * Return an array with an empty `url` to suppress the image (and the
         * Twitter card, which depends on the image).
         *
         * @since 1.0.0
         * @param array      $image
         * @param \WP_Post   $post
         * @param array|null $item Deep-linked item context (or null).
         */
        $image = (array) apply_filters( Filters_View::OG_IMAGE, $image, $this->post, $item );

        $image_url    = isset( $image['url'] )    ? (string) $image['url']    : '';
        $image_width  = isset( $image['width'] )  ? (int)    $image['width']  : 0;
        $image_height = isset( $image['height'] ) ? (int)    $image['height'] : 0;
        $image_alt    = isset( $image['alt'] )    ? (string) $image['alt']    : '';

        $emit_twitter = ! empty( $seo['enable_twitter_card'] );

        $tags  = '<meta property="og:type" content="' . esc_attr( $type ) . '">' . "\n";
        $tags .= '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\n";
        $tags .= '<meta property="og:locale" content="' . esc_attr( str_replace( '-', '_', get_locale() ) ) . '">' . "\n";
        $tags .= '<meta property="og:title" content="' . esc_attr( $title ) . '">' . "\n";
        $tags .= '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
        if ( $description !== '' ) {
            $tags .= '<meta property="og:description" content="' . esc_attr( $description ) . '">' . "\n";
        }
        if ( ! empty( $seo['facebook_app_id'] ) ) {
            $tags .= '<meta property="fb:app_id" content="' . esc_attr( (string) $seo['facebook_app_id'] ) . '">' . "\n";
        }
        if ( $image_url !== '' ) {
            $tags .= '<meta property="og:image" content="' . esc_url( $image_url ) . '">' . "\n";
            if ( $image_width > 0 && $image_height > 0 ) {
                $tags .= '<meta property="og:image:width" content="' . esc_attr( (string) $image_width ) . '">' . "\n";
                $tags .= '<meta property="og:image:height" content="' . esc_attr( (string) $image_height ) . '">' . "\n";
            }
            if ( $image_alt !== '' ) {
                $tags .= '<meta property="og:image:alt" content="' . esc_attr( $image_alt ) . '">' . "\n";
            }
            if ( $emit_twitter ) {
                $tags .= '<meta name="twitter:card" content="summary_large_image">' . "\n";
                $tags .= '<meta name="twitter:image" content="' . esc_url( $image_url ) . '">' . "\n";
                if ( $image_alt !== '' ) {
                    $tags .= '<meta name="twitter:image:alt" content="' . esc_attr( $image_alt ) . '">' . "\n";
                }
            }
        }
        if ( $emit_twitter ) {
            $tags .= '<meta name="twitter:title" content="' . esc_attr( $title ) . '">' . "\n";
            if ( ! empty( $seo['twitter_handle'] ) ) {
                $tags .= '<meta name="twitter:site" content="' . esc_attr( (string) $seo['twitter_handle'] ) . '">' . "\n";
            }
        }

        // article:* tags pair with og:type=article (the default). Skip them
        // when a filter has rewritten og:type to something else (e.g.
        // 'website', 'profile') because article:published_time on a
        // non-article would be malformed.
        if ( $type === 'article' && ! $item ) {
            $tags .= $this->article_meta();
        }

        return $tags;
    }

    /**
     * Build the description used for og:description on a collection page.
     *
     * Layered fallback: post excerpt → trimmed post content → auto-built
     * count summary (e.g. "24 photos in 'Tuscany 2024'"). The site tagline
     * is intentionally NOT in the chain — it would put the same generic
     * string on every gallery and actively hurt link previews.
     *
     * @since 1.0.0
     * @return string
     */
    private function collection_description(): string {
        $excerpt = trim( wp_strip_all_tags( (string) $this->post->post_excerpt ) );
        if ( $excerpt !== '' ) {
            return $this->trim_description( $excerpt );
        }

        $content = trim( wp_strip_all_tags( (string) $this->post->post_content ) );
        if ( $content !== '' ) {
            return $this->trim_description( $content );
        }

        return $this->auto_description();
    }

    /**
     * Build the count-based fallback description for a collection.
     *
     * Examples:
     *   "24 photos in 'Tuscany 2024'."
     *   "3 galleries in 'Weddings 2024'."
     *
     * @since 1.0.0
     * @return string
     */
    private function auto_description(): string {
        $title = (string) get_the_title( $this->post );

        if ( $this->is_album() ) {
            $count = count( \FotoGrids\Gallery_Album_Relations::get_galleries_for_album( (int) $this->post->ID ) );
            if ( $count <= 0 ) {
                return '';
            }
            return sprintf(
                /* translators: 1: gallery count, 2: album title */
                _n( '%1$d gallery in %2$s.', '%1$d galleries in %2$s.', $count, 'fotogrids' ),
                $count,
                '"' . $title . '"'
            );
        }

        $count = \FotoGrids\Galleries\Gallery_Repository::get_item_count( (int) $this->post->ID );
        if ( $count <= 0 ) {
            return '';
        }
        return sprintf(
            /* translators: 1: item count, 2: gallery title */
            _n( '%1$d photo in %2$s.', '%1$d photos in %2$s.', $count, 'fotogrids' ),
            $count,
            '"' . $title . '"'
        );
    }

    /**
     * Cap a description string at a safe length for OG/social previews.
     *
     * Most platforms truncate around 200 characters in card previews. We
     * cap at 300 to give a generous buffer while keeping the tag small.
     *
     * @since 1.0.0
     * @param string $text
     * @return string
     */
    private function trim_description( string $text ): string {
        if ( function_exists( 'mb_strlen' ) ) {
            if ( mb_strlen( $text ) <= 300 ) {
                return $text;
            }
            return rtrim( mb_substr( $text, 0, 297 ) ) . '...';
        }
        if ( strlen( $text ) <= 300 ) {
            return $text;
        }
        return rtrim( substr( $text, 0, 297 ) ) . '...';
    }

    /**
     * Build the article:* meta tags that pair with og:type=article.
     *
     * @since 1.0.0
     * @return string
     */
    private function article_meta(): string {
        $tags = '';

        $published = mysql2date( 'c', $this->post->post_date_gmt ?: $this->post->post_date, false );
        if ( $published ) {
            $tags .= '<meta property="article:published_time" content="' . esc_attr( $published ) . '">' . "\n";
        }

        $modified = mysql2date( 'c', $this->post->post_modified_gmt ?: $this->post->post_modified, false );
        if ( $modified ) {
            $tags .= '<meta property="article:modified_time" content="' . esc_attr( $modified ) . '">' . "\n";
        }

        $author = get_userdata( (int) $this->post->post_author );
        if ( $author && $author->display_name !== '' ) {
            $tags .= '<meta property="article:author" content="' . esc_attr( $author->display_name ) . '">' . "\n";
        }

        return $tags;
    }

    /**
     * Resolve the og:type for the current collection.
     *
     * @since 1.0.0
     * @param array|null $seo Resolved SEO settings (avoids a second store
     *                        lookup when the caller has them).
     * @return string
     */
    private function og_type( ?array $seo = null ): string {
        if ( $seo === null ) {
            $seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );
        }
        $type = isset( $seo['og_type'] ) && in_array( $seo['og_type'], \FotoGrids\Settings\SEO_Settings_Store::OG_TYPES, true )
            ? $seo['og_type']
            : 'article';

        /**
         * Filter the og:type emitted for a view page.
         *
         * @since 1.0.0
         * @param string   $type Default from `fotogrids/seo/settings`.
         * @param \WP_Post $post
         */
        return (string) apply_filters( Filters_View::OG_TYPE, $type, $this->post );
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

        $item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( (int) $this->post->ID );
        if ( ! in_array( $item_id, array_map( 'absint', (array) $item_ids ), true ) ) {
            return null;
        }

        $caption = '';
        foreach ( \FotoGrids\Galleries\Gallery_Repository::get_items( (int) $this->post->ID ) as $item ) {
            if ( (int) ( $item['id'] ?? 0 ) === $item_id ) {
                $caption = (string) ( $item['caption'] ?? '' );
                break;
            }
        }

        $src = wp_get_attachment_image_src( $item_id, 'large' );
        $alt = (string) get_post_meta( $item_id, '_wp_attachment_image_alt', true );

        return array(
            'id'           => $item_id,
            'title'        => get_the_title( $item_id ),
            'caption'      => $caption,
            'image'        => $src ? $src[0] : '',
            'image_width'  => $src ? (int) ( $src[1] ?? 0 ) : 0,
            'image_height' => $src ? (int) ( $src[2] ?? 0 ) : 0,
            'image_alt'    => $alt,
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
        $classes = (array) apply_filters( Filters_View::BODY_CLASSES, $classes, $this->post );
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
        return (bool) apply_filters( Filters_View::SHOW_HEADER, $show, $this->post );
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
            : \FotoGrids\Galleries\Gallery_Repository::get_item_count( (int) $this->post->ID );

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
        return (string) apply_filters( Filters_View::HEADER_HTML, $html, $this->post );
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

        // Flag this request as a View Page render so Render_Meta::view_page
        // turns true. Collection_Header reads that flag to decide whether
        // the parent album's "View Pages" breadcrumb placement applies.
        \FotoGrids\Public_Render::set_view_page_context( true );

        try {
            if ( $this->is_album() ) {
                $html = \FotoGrids\Public_Render::album_shortcode( array( 'id' => (int) $this->post->ID ) );
            } elseif ( $this->is_draft_preview() ) {
                $html = \FotoGrids\Public_Render::render_gallery_preview( (int) $this->post->ID );
            } else {
                $html = \FotoGrids\Public_Render::gallery_shortcode( array( 'id' => (int) $this->post->ID ) );
            }
        } finally {
            \FotoGrids\Public_Render::set_view_page_context( false );
        }

        /**
         * Filter the gallery/album markup before it is placed in the shell.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( Filters_View::GALLERY_HTML, $html, $this->post );
    }

    /**
     * Share controls for the view page footer.
     *
     * Both code paths emit a [data-fg-share-footer] container with a JSON
     * sharing config. The Sharing module's attachFooterBars() handler
     * (public/render/decorators/sharing/sharing.js) picks the container
     * up and renders the buttons from the config — no view-specific JS.
     *
     * When sharing is enabled for the collection and the view_page
     * placement applies, the full resolved network set is used. Otherwise
     * we fall back to a copy-link-only config so every shareable page
     * still offers at least the copy button.
     *
     * @since 1.0.0
     * @return string
     */
    public function share_html(): string {
        $resolved = \FotoGrids\Settings\Sharing_Settings_Store::resolve( (int) $this->post->ID );

        $shows_footer_bar = ! empty( $resolved['enabled'] )
            && in_array( 'view_page', (array) $resolved['placements'], true );

        if ( $shows_footer_bar ) {
            $config = array(
                'enabled'      => true,
                'networks'     => $resolved['networks'],
                'placements'   => $resolved['placements'],
                'button_style' => $resolved['button_style'],
                'button_size'  => $resolved['button_size'],
            );
        } else {
            // Copy-link-only fallback. Same payload shape so the Sharing
            // module renders this just like any other share bar — just
            // with a single network active.
            $config = array(
                'enabled'      => true,
                'networks'     => array( 'copy_link' => true ),
                'placements'   => array( 'view_footer' ),
                'button_style' => 'icons_and_labels',
                'button_size'  => 'medium',
            );
        }

        $html = '<div class="fotogrids-view__share" data-fg-share-footer="'
            . esc_attr( wp_json_encode( $config ) ) . '"></div>';

        /**
         * Filter the share controls markup.
         *
         * @since 1.0.0
         * @param string   $html
         * @param \WP_Post $post
         */
        return (string) apply_filters( Filters_View::SHARE_BUTTONS, $html, $this->post );
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
        return (string) apply_filters( Filters_View::FOOTER_CREDIT, '', $this->post );
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
        // Pre-register fotogrids-runtime so wp_localize_script can attach the
        // shared settings payload. The runtime asset itself is enqueued by
        // Asset_Resolver during the gallery/album render that happens inside
        // this view page; this registration just makes the handle known.
        wp_register_script(
            'fotogrids-runtime',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/fotogrids-runtime.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        // Deep-linking is essential on the view page — the URL might
        // carry ?fg-item={id} which we resolve into a lightbox open.
        wp_enqueue_script(
            'fotogrids-deep-linking',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/deep-linking.js',
            array( 'fotogrids-runtime' ),
            FOTOGRIDS_VERSION,
            true
        );

        // Sharing module — needed unconditionally because the View Page
        // footer always shows at least a copy-link button via the
        // Sharing module's attachFooterBars() (see share_html()). The
        // Sharing_Decorator's render-pipeline assets() only enqueues
        // this when sharing is enabled for the gallery being rendered;
        // here we need it regardless of the gallery's sharing setting.
        wp_enqueue_style(
            'fotogrids-sharing',
            FOTOGRIDS_PLUGIN_URL . 'public/render/decorators/sharing/sharing.css',
            array(),
            FOTOGRIDS_VERSION
        );
        wp_enqueue_script(
            'fotogrids-sharing',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/sharing.js',
            array( 'fotogrids-runtime' ),
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

        // window.fotogrids carries only the sharing-related deep-link
        // settings — same shape as the public render path.
        wp_localize_script(
            'fotogrids-runtime',
            'fotogrids',
            array(
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
        do_action( Actions_View::TRACKED, $this->post );
    }
}
