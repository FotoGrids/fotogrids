<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Item_Overlay;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Item_Wrapper;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Renders individual collection items in layout modules.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Item_Renderer {

    /**
     * Per-request counter for fallback loader SVG IDs.
     *
     * Used only for template-preview items where id = 0 (no attachment ID
     * available). Real gallery items use the attachment ID as their unique suffix.
     *
     * @since 1.0.0
     * @var int
     */
    private int $loader_counter = 0;

    /**
     * Renders one item as figure markup.
     *
     * @since   1.0.0
     * @param   Item_View      $item_view Item data.
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function render( Item_View $item_view, Render_Context $render_context ): string {
        $item_classes    = array_unique( array_merge( [ 'fg-item' ], $item_view->classes ) );
        $class_attribute = esc_attr( implode( ' ', $item_classes ) );

        // data-fg-media-state drives the loader visibility and the reveal
        // animation. JS flips it to "loaded" on img load/error; it starts as
        // "loading" here so the loader is visible from the moment the HTML is
        // parsed. Video items carry no loadable image (poster aside), so they
        // start "loaded" to avoid a stuck loader on posterless embeds.
        $is_video        = \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type );
        $state_attr      = $is_video
            ? ' data-fg-media-state="loaded"'
            : ' data-fg-media-state="loading"';
        $style_attribute = $this->serialize_style( $item_view->style );

        $data_attrs = $item_view->data_attrs;

        $image_html          = $this->render_img( $item_view, $render_context );
        $image_with_overlays = $this->wrap_with_overlays( $image_html, $item_view->thumb_overlays, $item_view, $render_context );
        $image_with_wrappers = $this->apply_wrappers( $image_with_overlays, $item_view->wrappers );

        // An overlay caption is absolutely positioned over the media. For a
        // video that plays inline, the player replaces the poster in place, so
        // the overlay caption would sit on top of the playing video. Omit it
        // from the thumbnail grid for inline-video items with overlay captions.
        $caption_placement = $render_context->settings['caption_placement'] ?? 'overlay';
        $playback_mode     = $render_context->settings['video_playback_mode'] ?? 'inline';

        // Image Viewer renders the caption title in its control bar, not as a
        // per-item caption. Suppress the figcaption here and expose the title
        // on a data attribute the layout's bar JS reads. The Item Description
        // and per-item placement settings are hidden for this layout, so only
        // the title travels to the bar.
        $is_image_viewer = $render_context->layout->layout_id === 'image-viewer';

        $suppress_caption = $is_image_viewer
            || (
                $is_video
                && 'overlay' === $caption_placement
                && 'inline' === $playback_mode
            );

        if ( $is_image_viewer && $item_view->caption_title !== '' ) {
            $data_attrs['data-fg-caption-title'] = $item_view->caption_title;
        }

        $data_attributes = $this->serialize_data_attrs( $data_attrs );

        $caption_html = '';
        if ( ! $suppress_caption && ( $item_view->caption_title !== '' || $item_view->caption_description !== '' ) ) {
            $inner = '';
            if ( $item_view->caption_title !== '' ) {
                $inner .= '<span class="fg-caption-title">' . esc_html( $item_view->caption_title ) . '</span>';
            }
            if ( $item_view->caption_description !== '' ) {
                $inner .= '<span class="fg-caption-description">' . esc_html( $item_view->caption_description ) . '</span>';
            }
            $caption_html = '<figcaption class="fg-caption">' . $inner . '</figcaption>';
        }

        // figure_wrappers enclose both the media block and the caption, so the
        // entire clickable surface includes the caption text.
        $figure_inner = $this->apply_wrappers( $image_with_wrappers . $caption_html, $item_view->figure_wrappers );

        return sprintf(
            '<figure class="%s"%s%s%s>%s</figure>',
            $class_attribute,
            $state_attr,
            $data_attributes,
            $style_attribute,
            $figure_inner
        );
    }

    /**
     * Serializes inline CSS declarations to a `style="..."` attribute string.
     * Returns an empty string when the declarations array is empty so the
     * attribute is omitted altogether.
     *
     * @since   1.0.0
     * @param   array<string, string> $declarations Property => value map.
     * @return  string
     */
    private function serialize_style( array $declarations ): string {
        if ( empty( $declarations ) ) {
            return '';
        }
        $pairs = [];
        foreach ( $declarations as $property => $value ) {
            $pairs[] = $property . ':' . $value;
        }
        return ' style="' . esc_attr( implode( ';', $pairs ) ) . '"';
    }

    /**
     * Renders image markup for an item.
     *
     * @since   1.0.0
     * @param   Item_View      $item_view      Item data.
     * @param   Render_Context $render_context Render context (used for lazy_load setting).
     * @return  string
     */
    private function render_img( Item_View $item_view, Render_Context $render_context ): string {
        if ( \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type ) ) {
            return $this->render_video_poster( $item_view, $render_context );
        }

        $srcset = '';
        $sizes = '';
        if ( $item_view->id > 0 ) {
            // Use the resolved size from Item_View so srcset candidates match
            // the actual thumbnail size displayed in the gallery grid.
            $srcset_size     = $item_view->thumb_size !== '' ? $item_view->thumb_size : 'large';
            $resolved_srcset = wp_get_attachment_image_srcset( $item_view->id, $srcset_size );
            $resolved_sizes  = wp_get_attachment_image_sizes(  $item_view->id, $srcset_size );

            if ( is_string( $resolved_srcset ) ) {
                $srcset = $resolved_srcset;
            }

            if ( is_string( $resolved_sizes ) ) {
                $sizes = $resolved_sizes;
            }
        }

        $lazy_load = (bool) ( $render_context->settings['lazy_load'] ?? true );

        // When the collection being rendered is watermark-enabled, serve the
        // watermarked sibling for the thumbnail and full image. The filter
        // returns the clean URL unchanged when watermarking is off for this
        // collection or the variant file does not exist.
        $thumb_url = \FotoGrids\Watermark\Watermark_Render_Filter::rewrite_url( $item_view->thumb_url );
        $full_url  = \FotoGrids\Watermark\Watermark_Render_Filter::rewrite_url( $item_view->full_url );

        $image_attributes = [
            'src'                => esc_url( $thumb_url ),
            'alt'                => esc_attr( $item_view->alt !== '' ? $item_view->alt : $item_view->title ),
            'data-fg-thumb-src'  => esc_url( $thumb_url ),
            'data-fg-full-src'   => esc_url( $full_url ),
            'data-id'            => (string) $item_view->id,
        ];

        if ( $item_view->width !== null ) {
            $image_attributes['data-fg-thumb-w'] = (string) $item_view->width;
        }
        if ( $item_view->height !== null ) {
            $image_attributes['data-fg-thumb-h'] = (string) $item_view->height;
        }
        if ( $item_view->full_width !== null ) {
            $image_attributes['data-fg-full-w'] = (string) $item_view->full_width;
        }
        if ( $item_view->full_height !== null ) {
            $image_attributes['data-fg-full-h'] = (string) $item_view->full_height;
        }

        if ( $lazy_load ) {
            $image_attributes['loading']  = 'lazy';
            $image_attributes['decoding'] = 'async';
        }

        if ( $srcset !== '' ) {
            $image_attributes['srcset'] = esc_attr( $srcset );
        }

        if ( $sizes !== '' ) {
            $image_attributes['sizes'] = esc_attr( $sizes );
        }

        if ( $item_view->width !== null ) {
            $image_attributes['width'] = (string) $item_view->width;
        }

        if ( $item_view->height !== null ) {
            $image_attributes['height'] = (string) $item_view->height;
        }

        $serialized_attributes = [];
        foreach ( $image_attributes as $attribute_name => $attribute_value ) {
            $serialized_attributes[] = sprintf( '%s="%s"', $attribute_name, $attribute_value );
        }

        $image_html = '<img ' . implode( ' ', $serialized_attributes ) . ' />';
        if ( $srcset === '' ) {
            return $image_html;
        }

        $source_attrs = sprintf(
            'srcset="%s"%s',
            esc_attr( $srcset ),
            $sizes !== '' ? ' sizes="' . esc_attr( $sizes ) . '"' : ''
        );

        return '<picture><source ' . $source_attrs . ' />' . $image_html . '</picture>';
    }

    /**
     * Renders the poster markup for a video item.
     *
     * Emits the poster image (or a placeholder when no poster resolved) plus a
     * play badge and the data-fg-* attributes the inline-playback and lightbox
     * frontend modules read to know how to play the item. The actual player
     * (<video> / <iframe>) is injected client-side on interaction.
     *
     * @since   1.1.0
     * @param   Item_View      $item_view      Item data.
     * @param   Render_Context $render_context Render context (used for playback mode).
     * @return  string
     */
    private function render_video_poster( Item_View $item_view, Render_Context $render_context ): string {
        $playback_mode = $render_context->settings['video_playback_mode'] ?? 'inline';
        if ( ! is_string( $playback_mode ) || '' === $playback_mode ) {
            $playback_mode = 'inline';
        }

        $lazy_load = (bool) ( $render_context->settings['lazy_load'] ?? true );

        $poster_attrs = [
            'class'              => 'fg-video-poster',
            'src'                => esc_url( $item_view->poster_url ),
            'alt'                => esc_attr( $item_view->alt !== '' ? $item_view->alt : $item_view->title ),
            'data-fg-thumb-src'  => esc_url( $item_view->poster_url ),
            'data-id'            => (string) $item_view->id,
        ];

        if ( $lazy_load ) {
            $poster_attrs['loading']  = 'lazy';
            $poster_attrs['decoding'] = 'async';
        }

        if ( '' !== $item_view->poster_url ) {
            $serialized = [];
            foreach ( $poster_attrs as $name => $value ) {
                $serialized[] = sprintf( '%s="%s"', $name, $value );
            }
            $poster_html = '<img ' . implode( ' ', $serialized ) . ' />';
        } else {
            $poster_html = '<span class="fg-video-poster fg-video-poster--placeholder" aria-hidden="true"></span>';
        }

        $badge_html = '<span class="fg-video-badge" aria-hidden="true"></span>';

        $video_attrs = [
            'class'                  => 'fg-video',
            'data-fg-item-type'      => esc_attr( $item_view->item_type ),
            'data-fg-playback-mode'  => esc_attr( $playback_mode ),
        ];

        if ( '' !== $item_view->video_src ) {
            $video_attrs['data-fg-video-src'] = esc_url( $item_view->video_src );
        }
        if ( '' !== $item_view->embed_provider ) {
            $video_attrs['data-fg-embed-provider'] = esc_attr( $item_view->embed_provider );
        }
        if ( '' !== $item_view->embed_id ) {
            $video_attrs['data-fg-embed-id'] = esc_attr( $item_view->embed_id );
        }
        if ( ! empty( $item_view->embed_settings ) ) {
            $encoded = wp_json_encode( $item_view->embed_settings );
            if ( is_string( $encoded ) ) {
                $video_attrs['data-fg-embed-settings'] = esc_attr( $encoded );
            }
        }

        $serialized_video = '';
        foreach ( $video_attrs as $name => $value ) {
            $serialized_video .= sprintf( ' %s="%s"', $name, $value );
        }

        return '<span' . $serialized_video . '>' . $poster_html . $badge_html . '</span>';
    }

    /**
     * Wraps item media in overlay containers and injects the loading icon.
     *
     * The loading icon is a full inline SVG (not a <symbol>/<use> reference)
     * so CSS transitions can target individual SVG child elements directly.
     * Inlining one SVG per item costs ~900 bytes of markup per item - a
     * negligible tradeoff for a gallery page.
     *
     * __FG_ID__ in the SVG is replaced with a per-item unique suffix so any
     * gradient or clipPath IDs referenced by multiple items on the same page
     * don't collide. Animations are driven by WAAPI (loading-icon.js); there
     * are no SMIL tags in the inlined markup.
     *
     * @since   1.0.0
     * @param   string                   $image_html Base image markup.
     * @param   array<int, Item_Overlay> $thumb_overlays Overlay definitions.
     * @param   Item_View                $item_view Item data (used for unique ID).
     * @param   Render_Context           $render_context Render context (used for icon name).
     * @return  string
     */
    private function wrap_with_overlays( string $image_html, array $thumb_overlays, Item_View $item_view, Render_Context $render_context ): string {
        $overlay_html = '';
        foreach ( $thumb_overlays as $thumb_overlay ) {
            $extra_classes = '';
            if ( ! empty( $thumb_overlay->extra_classes ) ) {
                $extra_classes = ' ' . esc_attr( implode( ' ', $thumb_overlay->extra_classes ) );
            }

            $overlay_html .= sprintf(
                '<span class="fg-overlay %s%s">%s</span>',
                esc_attr( $thumb_overlay->position_class ),
                $extra_classes,
                $thumb_overlay->html
            );
        }

        // Video items show their own play badge and have no loadable image to
        // wait on, so the loading-icon loader is omitted for them.
        $loader_html = \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type )
            ? ''
            : $this->render_loader( $item_view, $render_context );

        return '<div class="fg-item-media">' . $image_html . $overlay_html . $loader_html . '</div>';
    }

    /**
     * Renders the loading icon element for one item.
     *
     * Uses the icon name from settings (falling back to '12-dots') and replaces
     * __FG_ID__ in the SVG with a per-item unique suffix so gradient and clipPath
     * IDs don't collide across multiple items on the same page. The inlined SVG
     * contains no SMIL tags - animations are started by WAAPI in loading-icon.js.
     *
     * @since   1.0.0
     * @param   Item_View      $item_view Item data.
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    private function render_loader( Item_View $item_view, Render_Context $render_context ): string {
        $icon_name = $render_context->settings['loading_icon'] ?? '';
        if ( ! is_string( $icon_name ) || $icon_name === '' ) {
            $icon_name = '12-dots';
        }

        // Attachment ID is naturally unique per page; fall back to a per-request
        // counter for template-preview items that carry id = 0.
        if ( $item_view->id > 0 ) {
            $instance_id = 'fgi' . $item_view->id;
        } else {
            $this->loader_counter++;
            $instance_id = 'fgic' . $this->loader_counter;
        }

        $svg = \FotoGrids\Assets\Loading_Icon_Library::svg( $icon_name, $instance_id );

        if ( $svg === '' ) {
            return '';
        }

        return '<div class="fg-item-loader" aria-hidden="true">' . $svg . '</div>';
    }

    /**
     * Applies nested wrappers around item content.
     *
     * @since   1.0.0
     * @param   string                    $inner_html Inner markup.
     * @param   array<int, Item_Wrapper>  $item_wrappers Wrapper definitions.
     * @return  string
     */
    private function apply_wrappers( string $inner_html, array $item_wrappers ): string {
        $wrapped_html = $inner_html;

        foreach ( $item_wrappers as $item_wrapper ) {
            $attribute_pairs = '';
            foreach ( $item_wrapper->attrs as $attribute_name => $attribute_value ) {
                $attribute_pairs .= ' ' . esc_attr( $attribute_name ) . '="' . esc_attr( $attribute_value ) . '"';
            }

            $safe_tag_name = esc_attr( $item_wrapper->tag );
            $wrapped_html = sprintf( '<%s%s>%s</%s>', $safe_tag_name, $attribute_pairs, $wrapped_html, $safe_tag_name );
        }

        return $wrapped_html;
    }

    /**
     * Serializes data attributes to HTML.
     *
     * @since   1.0.0
     * @param   array<string, string> $data_attributes Data attributes.
     * @return  string
     */
    private function serialize_data_attrs( array $data_attributes ): string {
        $serialized_attributes = '';
        foreach ( $data_attributes as $attribute_name => $attribute_value ) {
            $serialized_attributes .= sprintf( ' %s="%s"', esc_attr( $attribute_name ), esc_attr( $attribute_value ) );
        }

        return $serialized_attributes;
    }
}
