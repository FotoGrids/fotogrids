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

        // data-fg-media-state drives both the loader visibility (CSS) and the
        // pointer-events block (CSS) until the image settles. JS sets it to
        // "loaded" on img load/error; it starts as "loading" here so the loader
        // is visible from the moment the HTML is parsed.
        $state_attr      = ' data-fg-media-state="loading"';
        $data_attributes = $this->serialize_data_attrs( $item_view->data_attrs );
        $style_attribute = $this->serialize_style( $item_view->style );

        $image_html          = $this->render_img( $item_view, $render_context );
        $image_with_overlays = $this->wrap_with_overlays( $image_html, $item_view->thumb_overlays, $item_view, $render_context );
        $image_with_wrappers = $this->apply_wrappers( $image_with_overlays, $item_view->wrappers );

        $caption_html = '';
        if ( $item_view->caption_title !== '' || $item_view->caption_description !== '' ) {
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

        $image_attributes = [
            'src'                => esc_url( $item_view->thumb_url ),
            'alt'                => esc_attr( $item_view->alt !== '' ? $item_view->alt : $item_view->title ),
            'data-fg-thumb-src'  => esc_url( $item_view->thumb_url ),
            'data-fg-full-src'   => esc_url( $item_view->full_url ),
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

        $loader_html = $this->render_loader( $item_view, $render_context );

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
