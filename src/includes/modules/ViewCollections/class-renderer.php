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
use FotoGrids\Post_Types;
use FotoGrids\Render\Api\Breakpoint_Config;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;
use FotoGrids\Render\Internal\Style_Var_Builder;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders the shell regions of a collection view page; each region is filterable.
 *
 * @since 1.0.0
 */
class Renderer {

	use Setting_Helpers;

	/**
	 * The view page <body> id; scopes the CSS-variable block.
	 *
	 * @var string
	 */
	const BODY_ID = 'fotogrids-view';

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
	 * Creates a renderer for a collection.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post The collection being rendered.
	 */
	private function __construct( \WP_Post $post ) {
		$this->post     = $post;
		$this->settings = Settings::get( (int) $post->ID );
	}

	/**
	 * Builds a renderer for a collection.
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
		return Post_Types::ALBUM === $this->post->post_type;
	}

	/**
	 * Whether the collection is neither published nor private (a draft preview).
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public function is_draft_preview(): bool {
		return ! in_array( $this->post->post_status, array( 'publish', 'private' ), true );
	}

	/**
	 * Returns the document title for the view page.
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
	 * Whether the site hands the view page head over to its SEO plugin.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public function defers_to_seo_plugins(): bool {
		$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );

		return ! empty( $seo['defer_to_seo_plugins'] );
	}

	/**
	 * Whether the standalone shell prints its own `<title>`.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public function prints_document_title(): bool {
		return ! $this->defers_to_seo_plugins()
			|| ( ! current_theme_supports( 'title-tag' ) && ! has_action( 'wp_head', '_block_template_render_title_tag' ) );
	}

	/**
	 * Whether the view page is excluded from search engines.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public function is_noindex(): bool {
		$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );

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
		return (bool) apply_filters( Filters_View::ROBOTS, $noindex, $this->post );
	}

	/**
	 * Adds the view page's noindex to `wp_robots`; no-op when deferring to an SEO plugin.
	 *
	 * @since 1.3.0
	 * @param array<string,bool|string> $robots Robots directives.
	 * @return array<string,bool|string>
	 */
	public static function filter_robots( array $robots ): array {
		$post = Router::current_post();
		if ( ! $post instanceof \WP_Post ) {
			return $robots;
		}

		$view = self::for_post( $post );
		if ( ! $view->defers_to_seo_plugins() && $view->is_noindex() ) {
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}

		return $robots;
	}

	/**
	 * Returns canonical and Open Graph meta for the document head.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function head_meta(): string {
		$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );

		$canonical = '' !== $seo['canonical_override'] ? $seo['canonical_override'] : get_permalink( $this->post );

		/**
		 * Filter the canonical URL emitted on the view page.
		 *
		 * @since 1.0.0
		 * @param string   $canonical Override or permalink of the view page.
		 * @param \WP_Post $post
		 */
		$canonical = (string) apply_filters( Filters_View::CANONICAL, $canonical, $this->post );

		$meta = '';
		if ( '' !== $canonical && ! $this->defers_to_seo_plugins() ) {
			$meta .= '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\n";
		}
		$meta .= $this->open_graph_meta( $seo );

		/**
		 * Filter the complete head-meta markup the view page emits.
		 *
		 * Runs after all granular canonical and OG filters.
		 *
		 * @since 1.0.0
		 * @param string   $meta
		 * @param \WP_Post $post
		 */
		return (string) apply_filters( Filters_View::HEAD_META, $meta, $this->post );
	}

	/**
	 * Returns Open Graph and Twitter card markup.
	 *
	 * Uses per-item tags when ?fg-item names an item of this gallery and no gate applies.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	private function open_graph_meta( ?array $seo = null ): string {
		if ( null === $seo ) {
			$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );
		}

		$gated = $this->has_active_gates();
		$item  = $gated ? null : $this->deep_linked_item();

		if ( empty( $seo['enable_open_graph'] ) || ! empty( $seo['defer_to_seo_plugins'] ) ) {
			return (string) apply_filters( Filters_View::OG_ENABLED, '', $this->post, $item );
		}

		/**
		 * Filter whether OG/Twitter tags are emitted on this view page.
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

		$title       = (string) get_the_title( $this->post );
		$url         = (string) get_permalink( $this->post );
		$image       = array(
			'id'     => 0,
			'url'    => '',
			'width'  => 0,
			'height' => 0,
			'alt'    => '',
		);
		$description = '';

		if ( $item ) {
			$title       = '' !== $item['title'] ? $item['title'] : $title;
			$description = (string) $item['caption'];
			$image       = array(
				'id'     => (int) $item['id'],
				'url'    => (string) $item['image'],
				'width'  => (int) ( $item['image_width'] ?? 0 ),
				'height' => (int) ( $item['image_height'] ?? 0 ),
				'alt'    => (string) ( $item['image_alt'] ?? '' ),
			);
			$url         = add_query_arg( 'fg-item', $item['id'], $url );
		} else {
			if ( '' !== $seo['og_title_override'] ) {
				$title = $seo['og_title_override'];
			}

			$description = '' !== $seo['og_description_override']
				? $seo['og_description_override']
				: $this->collection_description();

			// Image order: custom image, collection cover, plugin-wide fallback.
			$image_id = 0;
			if ( 'custom' === $seo['og_image_source'] && $seo['og_image_custom_id'] > 0 ) {
				$image_id = (int) $seo['og_image_custom_id'];
			}
			$poster_url = '';
			if ( $image_id <= 0 && ! $gated ) {
				$descriptor = \FotoGrids\Galleries\Cover_Resolver::descriptor_for_collection(
					(int) $this->post->ID,
					'large'
				);
				if ( 'attachment' === $descriptor['kind'] && wp_attachment_is_image( $descriptor['id'] ) ) {
					$image_id = (int) $descriptor['id'];
				} else {
					$poster_url = $descriptor['url'];
				}
			}
			if ( $image_id <= 0 && '' === $poster_url && $seo['og_image_fallback_id'] > 0 ) {
				$image_id = (int) $seo['og_image_fallback_id'];
			}

			if ( $image_id ) {
				$src   = wp_get_attachment_image_src( $image_id, 'large' );
				$image = array(
					'id'     => $image_id,
					'url'    => $src ? (string) $src[0] : '',
					'width'  => $src ? (int) ( $src[1] ?? 0 ) : 0,
					'height' => $src ? (int) ( $src[2] ?? 0 ) : 0,
					'alt'    => (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true ),
				);
			}

			if ( '' !== $poster_url ) {
				$image = array(
					'id'     => 0,
					'url'    => $poster_url,
					'width'  => 0,
					'height' => 0,
					'alt'    => '',
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
		 * Filter the og:image data emitted for a view page.
		 *
		 * Shape: array{id:int,url:string,width:int,height:int,alt:string}.
		 * An empty `url` suppresses the image and the Twitter image tags.
		 *
		 * @since 1.0.0
		 * @param array      $image
		 * @param \WP_Post   $post
		 * @param array|null $item Deep-linked item context (or null).
		 */
		$image = (array) apply_filters( Filters_View::OG_IMAGE, $image, $this->post, $item );

		$image_url    = isset( $image['url'] ) ? (string) $image['url'] : '';
		$image_width  = isset( $image['width'] ) ? (int) $image['width'] : 0;
		$image_height = isset( $image['height'] ) ? (int) $image['height'] : 0;
		$image_alt    = isset( $image['alt'] ) ? (string) $image['alt'] : '';

		$emit_twitter = ! empty( $seo['enable_twitter_card'] );

		$tags  = '<meta property="og:type" content="' . esc_attr( $type ) . '">' . "\n";
		$tags .= '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\n";
		$tags .= '<meta property="og:locale" content="' . esc_attr( str_replace( '-', '_', get_locale() ) ) . '">' . "\n";
		$tags .= '<meta property="og:title" content="' . esc_attr( $title ) . '">' . "\n";
		$tags .= '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
		if ( '' !== $description ) {
			$tags .= '<meta property="og:description" content="' . esc_attr( $description ) . '">' . "\n";
		}
		if ( ! empty( $seo['facebook_app_id'] ) ) {
			$tags .= '<meta property="fb:app_id" content="' . esc_attr( (string) $seo['facebook_app_id'] ) . '">' . "\n";
		}
		if ( '' !== $image_url ) {
			$tags .= '<meta property="og:image" content="' . esc_url( $image_url ) . '">' . "\n";
			if ( $image_width > 0 && $image_height > 0 ) {
				$tags .= '<meta property="og:image:width" content="' . esc_attr( (string) $image_width ) . '">' . "\n";
				$tags .= '<meta property="og:image:height" content="' . esc_attr( (string) $image_height ) . '">' . "\n";
			}
			if ( '' !== $image_alt ) {
				$tags .= '<meta property="og:image:alt" content="' . esc_attr( $image_alt ) . '">' . "\n";
			}
			if ( $emit_twitter ) {
				$tags .= '<meta name="twitter:card" content="summary_large_image">' . "\n";
				$tags .= '<meta name="twitter:image" content="' . esc_url( $image_url ) . '">' . "\n";
				if ( '' !== $image_alt ) {
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

		if ( 'article' === $type && ! $item ) {
			$tags .= $this->article_meta();
		}

		return $tags;
	}

	/**
	 * Builds the og:description for a collection: excerpt, else content, else a count summary.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	private function collection_description(): string {
		$excerpt = trim( wp_strip_all_tags( (string) $this->post->post_excerpt ) );
		if ( '' !== $excerpt ) {
			return $this->trim_description( $excerpt );
		}

		$content = trim( wp_strip_all_tags( (string) $this->post->post_content ) );
		if ( '' !== $content ) {
			return $this->trim_description( $content );
		}

		return $this->auto_description();
	}

	/**
	 * Builds the count-based fallback description, or '' when the collection is empty.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	private function auto_description(): string {
		$title = (string) get_the_title( $this->post );

		if ( $this->is_album() ) {
			$count = count( \FotoGrids\Gallery_Album_Relations::get_visible_galleries_for_album( (int) $this->post->ID ) );
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
	 * Caps a description at 300 characters, ending in '...' when cut.
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
	 * Builds the article:* meta tags that pair with og:type=article.
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
		if ( $author && '' !== $author->display_name ) {
			$tags .= '<meta property="article:author" content="' . esc_attr( $author->display_name ) . '">' . "\n";
		}

		return $tags;
	}

	/**
	 * Resolves the og:type for the current collection.
	 *
	 * @since 1.0.0
	 * @param array|null $seo Resolved SEO settings, or null to look them up.
	 * @return string
	 */
	private function og_type( ?array $seo = null ): string {
		if ( null === $seo ) {
			$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $this->post->ID );
		}
		$type = isset( $seo['og_type'] ) && in_array( $seo['og_type'], \FotoGrids\Settings\SEO_Settings_Store::OG_TYPES, true )
			? $seo['og_type']
			: 'article';

		/**
		 * Filter the og:type emitted for a view page.
		 *
		 * @since 1.0.0
		 * @param string   $type From the SEO settings, else 'article'.
		 * @param \WP_Post $post
		 */
		return (string) apply_filters( Filters_View::OG_TYPE, $type, $this->post );
	}

	/**
	 * Resolves the ?fg-item item when it belongs to this gallery.
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
	 * Returns the space-separated class list for the view page <body>.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function body_class(): string {
		$theme   = $this->settings['theme'] ?? 'light';
		$classes = array(
			'fotogrids-view',
			'fotogrids-view--' . ( $this->is_album() ? 'album' : 'gallery' ),
			'fotogrids-view--theme-' . ( 'dark' === $theme ? 'dark' : 'light' ),
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

		return implode( ' ', $classes );
	}

	/**
	 * Returns the CSS-variable rules scoped to #fotogrids-view, as bare CSS (no <style> tags).
	 *
	 * @since  1.0.0
	 * @return string The CSS rules, or '' when no variables apply.
	 */
	public function body_vars_css(): string {
		$vars = array();

		$accent = (string) ( $this->settings['accent_color'] ?? '#3c46f0' );
		if ( '' !== $accent ) {
			$vars['--fg-view-accent'] = $accent;
		}

		$collection = $this->collection_settings();
		if ( $this->setting_to_bool( $collection['view_page_override_defaults'] ?? false ) ) {
			$raw_max_width = $collection['view_page_max_width'] ?? array();
			$desktop       = $this->resolve_responsive_value( $raw_max_width, 'desktop', 'vw' );
			$tablet        = $this->resolve_responsive_value( $raw_max_width, 'tablet', 'vw' );
			$mobile        = $this->resolve_responsive_value( $raw_max_width, 'mobile', 'vw' );

			if ( '' !== $desktop || '' !== $tablet || '' !== $mobile ) {
				$vars['--fg-view-max-width'] = new Responsive_Var( $desktop, $tablet, $mobile );
			}

			$background_color = isset( $collection['view_page_background_color'] )
				? (string) $collection['view_page_background_color']
				: '';
			if ( '' !== $background_color ) {
				$vars['--fg-view-bg'] = $background_color;
			}
		}

		if ( empty( $vars ) ) {
			return '';
		}

		$builder = new Style_Var_Builder();

		return $builder->build_css(
			$vars,
			self::BODY_ID,
			Breakpoint_Config::from_settings()
		);
	}

	/**
	 * Whether a gate (password, members only) applies to this collection.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	private function has_active_gates(): bool {
		$collection_id = (int) $this->post->ID;
		$settings      = $this->collection_settings();

		$context = $this->is_album()
			? \FotoGrids\Render\Internal\Context_Builder::for_public()->build_for_album(
				$collection_id,
				$settings,
				array(),
				\FotoGrids\Render\Api\Request_Source::SHORTCODE,
				'fg-' . $collection_id . '-head'
			)
			: \FotoGrids\Render\Internal\Gallery_Item_Sequence::stub_context( $collection_id, $settings );

		return \FotoGrids\Render\Internal\Render_Controller::has_active_gates( $context );
	}

	/**
	 * Returns the saved gallery or album settings for this collection.
	 *
	 * @since 1.0.0
	 * @return array<string,mixed>
	 */
	private function collection_settings(): array {
		if ( $this->is_album() ) {
			return \FotoGrids\Albums\Album_Repository::get_settings( (int) $this->post->ID );
		}

		return \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $this->post->ID );
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
	 * Whether the page footer (sharing + credit) should be shown.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public function shows_footer(): bool {
		$show = ! empty( $this->settings['show_footer'] );

		/**
		 * Filter whether the view page footer is shown.
		 *
		 * @since 1.0.0
		 * @param bool     $show
		 * @param \WP_Post $post
		 */
		return (bool) apply_filters( Filters_View::SHOW_FOOTER, $show, $this->post );
	}

	/**
	 * Returns the header region markup.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function header_html(): string {
		$count = $this->is_album()
			? count( \FotoGrids\Gallery_Album_Relations::get_visible_galleries_for_album( (int) $this->post->ID ) )
			: \FotoGrids\Galleries\Gallery_Repository::get_item_count( (int) $this->post->ID );

		$meta_label = $this->is_album()
			/* translators: %d: number of galleries in the album. */
			? sprintf( _n( '%d gallery', '%d galleries', $count, 'fotogrids' ), $count )
			/* translators: %d: number of items in the gallery. */
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
	 * Returns the gallery or album markup from the render pipeline.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function gallery_html(): string {
		if ( ! class_exists( '\FotoGrids\Public_Render' ) ) {
			require_once FOTOGRIDS_PLUGIN_DIR . 'public/class-public-render.php';
		}

		// Must be set before rendering; Render_Meta::view_page reads it.
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
	 * Returns the share container for the view page footer.
	 *
	 * The [data-fg-share-footer] JSON config is rendered client-side by the Sharing
	 * module; it falls back to copy-link only unless the view_page placement is on.
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
			$config = array(
				'enabled'      => true,
				'networks'     => array( 'copy_link' => true ),
				'placements'   => array( 'view_footer' ),
				'button_style' => 'icons_and_labels',
				'button_size'  => 'medium',
			);
		}

		$config['labels']      = \FotoGrids\Render\Decorators\Sharing\Sharing_Decorator::client_labels();
		$config['object_type'] = $this->is_album() ? 'album' : 'gallery';
		$config['object_id']   = (int) $this->post->ID;

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
	 * Returns the footer credit markup.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function footer_credit_html(): string {
		/**
		 * Filter the footer credit markup. Empty by default.
		 *
		 * @since 1.0.0
		 * @param string   $html
		 * @param \WP_Post $post
		 */
		return (string) apply_filters( Filters_View::FOOTER_CREDIT, '', $this->post );
	}

	/**
	 * Enqueues the view page assets and its scoped CSS variables.
	 *
	 * Must run before wp_head() so the inline variables print in <head>.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function enqueue_assets(): void {
		// Registered only; Runtime_Bootstrap::localize() needs the handle and the render enqueues it.
		wp_register_script(
			'fotogrids-runtime',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/fotogrids-runtime.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_script(
			'fotogrids-deep-linking',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/deep-linking.js',
			array( 'fotogrids-runtime' ),
			FOTOGRIDS_VERSION,
			true
		);

		// Always enqueued: the footer shows at least a copy-link button.
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

		$body_vars_css = $this->body_vars_css();
		if ( '' !== $body_vars_css ) {
			wp_add_inline_style( 'fotogrids-view-collection', $body_vars_css );
		}

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
	}

	/**
	 * Announces a view page visit; skipped for draft previews.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function track_view(): void {
		if ( $this->is_draft_preview() ) {
			return;
		}

		/**
		 * Fires when a published or private collection's view page is visited.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $post
		 */
		do_action( Actions_View::TRACKED, $this->post );
	}
}
