<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Formatted_Text\Entities;
use FotoGrids\Formatted_Text\Formatted_Text;
use FotoGrids\Render\Api\Item_Overlay;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Item_Wrapper;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Sanitization\Attribute_Value;

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
	 * Per-request counter for loader SVG IDs of items with id 0 (template previews).
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
		$item_classes    = array_unique( array_merge( array( 'fg-item' ), $item_view->classes ) );
		$class_attribute = esc_attr( implode( ' ', $item_classes ) );

		// JS sets "loaded" on img load/error; items with no image start loaded.
		$is_video        = \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type );
		$state_attr      = ( $is_video || $this->is_placeholder( $item_view ) )
			? ' data-fg-media-state="loaded"'
			: ' data-fg-media-state="loading"';
		$style_attribute = $this->serialize_style( $item_view->style );

		$data_attrs = $item_view->data_attrs;

		$image_html          = $this->render_img( $item_view, $render_context );
		$image_with_overlays = $this->wrap_with_overlays( $image_html, $item_view->thumb_overlays, $item_view, $render_context );
		$image_with_wrappers = $this->apply_wrappers( $image_with_overlays, $item_view->wrappers );

		// An overlay caption would cover a video playing inline.
		$caption_placement = $render_context->settings['caption_placement'] ?? 'overlay';
		$playback_mode     = $render_context->settings['video_playback_mode'] ?? 'inline';

		// Image Viewer shows the title in its control bar instead of a figcaption.
		$is_image_viewer = 'image-viewer' === $render_context->layout->layout_id;

		$suppress_caption = $is_image_viewer
			|| (
				$is_video
				&& 'overlay' === $caption_placement
				&& 'inline' === $playback_mode
			);

		if ( $is_image_viewer && '' !== $item_view->caption_title ) {
			$data_attrs['data-fg-caption-title'] = Attribute_Value::text( $item_view->caption_title );
		}

		$data_attributes = $this->serialize_data_attrs( $data_attrs );

		$caption_html = '';
		if ( ! $suppress_caption && ( '' !== $item_view->caption_title || '' !== $item_view->caption_description ) ) {
			$content = '';
			if ( '' !== $item_view->caption_title ) {
				$content .= '<span class="fg-caption-title">' . Entities::escape_text( $item_view->caption_title, true ) . '</span>';
			}
			if ( '' !== $item_view->caption_description ) {
				$content .= '<span class="fg-caption-description">' . $this->description_html( $item_view, $render_context ) . '</span>';
			}
			$caption_html = '<figcaption class="fg-caption">'
				. '<span class="fg-caption-bg" aria-hidden="true"></span>'
				. '<span class="fg-caption-content">' . $content . '</span>'
				. '</figcaption>';
		}

		// figure_wrappers enclose the caption too, so it is part of the link.
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
	 * Returns the caption description as safe HTML.
	 *
	 * A description the caption pipeline resolved is formatted; any other
	 * value set on the item is shown as plain text.
	 *
	 * @since   1.3.0
	 * @param   Item_View      $item_view      Item data.
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function description_html( Item_View $item_view, Render_Context $render_context ): string {
		$content = ( new Caption_Content_Builder() )->resolve_display( $item_view, $render_context );
		if ( $content->description === $item_view->caption_description ) {
			return $content->description_html;
		}
		return nl2br( Entities::escape_text( $item_view->caption_description, true ), false );
	}

	/**
	 * Returns the alt text, falling back to the title as one line of plain text.
	 *
	 * @since   1.3.0
	 * @param   Item_View $item_view Item data.
	 * @return  string Attribute-ready value.
	 */
	private function alt_attribute( Item_View $item_view ): string {
		if ( '' !== $item_view->alt ) {
			return esc_attr( $item_view->alt );
		}
		return Attribute_Value::text(
			Formatted_Text::single_line(
				$item_view->title,
				array(
					'use'     => 'aria',
					'item_id' => $item_view->id,
				)
			)
		);
	}

	/**
	 * Serializes inline CSS declarations to a `style` attribute, or '' when empty.
	 *
	 * @since   1.0.0
	 * @param   array<string, string> $declarations Property => value map.
	 * @return  string
	 */
	private function serialize_style( array $declarations ): string {
		if ( empty( $declarations ) ) {
			return '';
		}
		$pairs = array();
		foreach ( $declarations as $property => $value ) {
			$pairs[] = $property . ':' . $value;
		}
		return ' style="' . esc_attr( implode( ';', $pairs ) ) . '"';
	}

	/**
	 * Whether a non-video item has no image to show and renders a placeholder tile.
	 *
	 * @since   1.3.0
	 * @param   Item_View $item_view Item data.
	 * @return  bool
	 */
	private function is_placeholder( Item_View $item_view ): bool {
		return '' === $item_view->thumb_url
			&& ! \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type );
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

		if ( $this->is_placeholder( $item_view ) ) {
			$label = '' !== $item_view->alt ? $item_view->alt : $item_view->title;
			return '' !== $label
				? '<span class="fg-item-placeholder" role="img" aria-label="' . esc_attr( $label ) . '"></span>'
				: '<span class="fg-item-placeholder" aria-hidden="true"></span>';
		}

		$srcset = '';
		$sizes  = '';
		if ( $item_view->id > 0 ) {
			$srcset_size     = '' !== $item_view->thumb_size ? $item_view->thumb_size : 'large';
			$resolved_srcset = wp_get_attachment_image_srcset( $item_view->id, $srcset_size );
			$resolved_sizes  = wp_get_attachment_image_sizes( $item_view->id, $srcset_size );

			if ( is_string( $resolved_srcset ) ) {
				$srcset = $resolved_srcset;
			}

			if ( is_string( $resolved_sizes ) ) {
				$sizes = $resolved_sizes;
			}
		}

		$lazy_load = (bool) ( $render_context->settings['lazy_load'] ?? true );

		// Watermarked variants, when the collection has watermarking on.
		$thumb_url = \FotoGrids\Watermark\Watermark_Render_Filter::rewrite_url( $item_view->thumb_url );
		$full_url  = \FotoGrids\Watermark\Watermark_Render_Filter::rewrite_url( $item_view->full_url );

		$image_attributes = array(
			'src'               => esc_url( $thumb_url ),
			'alt'               => $this->alt_attribute( $item_view ),
			'data-fg-thumb-src' => esc_url( $thumb_url ),
			'data-fg-full-src'  => esc_url( $full_url ),
			'data-id'           => (string) $item_view->id,
		);

		if ( null !== $item_view->width ) {
			$image_attributes['data-fg-thumb-w'] = (string) $item_view->width;
		}
		if ( null !== $item_view->height ) {
			$image_attributes['data-fg-thumb-h'] = (string) $item_view->height;
		}
		if ( null !== $item_view->full_width ) {
			$image_attributes['data-fg-full-w'] = (string) $item_view->full_width;
		}
		if ( null !== $item_view->full_height ) {
			$image_attributes['data-fg-full-h'] = (string) $item_view->full_height;
		}

		if ( $lazy_load ) {
			$image_attributes['loading']  = 'lazy';
			$image_attributes['decoding'] = 'async';
		}

		if ( '' !== $srcset ) {
			$image_attributes['srcset'] = esc_attr( $srcset );
		}

		if ( '' !== $sizes ) {
			$image_attributes['sizes'] = esc_attr( $sizes );
		}

		if ( null !== $item_view->width ) {
			$image_attributes['width'] = (string) $item_view->width;
		}

		if ( null !== $item_view->height ) {
			$image_attributes['height'] = (string) $item_view->height;
		}

		$serialized_attributes = array();
		foreach ( $image_attributes as $attribute_name => $attribute_value ) {
			$serialized_attributes[] = sprintf( '%s="%s"', $attribute_name, $attribute_value );
		}

		$image_html = '<img ' . implode( ' ', $serialized_attributes ) . ' />';
		if ( '' === $srcset ) {
			return $image_html;
		}

		$source_attrs = sprintf(
			'srcset="%s"%s',
			esc_attr( $srcset ),
			'' !== $sizes ? ' sizes="' . esc_attr( $sizes ) . '"' : ''
		);

		return '<picture><source ' . $source_attrs . ' />' . $image_html . '</picture>';
	}

	/**
	 * Renders a video item's poster (or placeholder) and the data-fg-* playback
	 * attributes; the player itself is injected client-side.
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

		$poster_attrs = array(
			'class'             => 'fg-video-poster',
			'src'               => esc_url( $item_view->poster_url ),
			'alt'               => $this->alt_attribute( $item_view ),
			'data-fg-thumb-src' => esc_url( $item_view->poster_url ),
			'data-id'           => (string) $item_view->id,
		);

		if ( $lazy_load ) {
			$poster_attrs['loading']  = 'lazy';
			$poster_attrs['decoding'] = 'async';
		}

		if ( '' !== $item_view->poster_url ) {
			$serialized = array();
			foreach ( $poster_attrs as $name => $value ) {
				$serialized[] = sprintf( '%s="%s"', $name, $value );
			}
			$poster_html = '<img ' . implode( ' ', $serialized ) . ' />';
		} else {
			$poster_html = '<span class="fg-video-poster fg-video-poster--placeholder" aria-hidden="true"></span>';
		}

		$badge_html = \FotoGrids\Render\Video\Video_Item_Helpers::needs_play_badge(
			$item_view->item_type,
			$playback_mode,
			$item_view->embed_settings
		) ? '<span class="fg-video-badge" aria-hidden="true"></span>' : '';

		$video_attrs = array(
			'class'                 => 'fg-video',
			'data-fg-item-type'     => esc_attr( $item_view->item_type ),
			'data-fg-playback-mode' => esc_attr( $playback_mode ),
		);

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
			$encoded = \FotoGrids\Sanitization\Attribute_Value::json( $item_view->embed_settings );
			if ( '' !== $encoded ) {
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
	 * Wraps item media with its overlays and the loading icon.
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

		// Nothing to wait on without an image.
		$loader_html = ( \FotoGrids\Render\Video\Video_Item_Helpers::is_video( $item_view->item_type ) || $this->is_placeholder( $item_view ) )
			? ''
			: $this->render_loader( $item_view, $render_context );

		return '<div class="fg-item-media">' . $image_html . $overlay_html . $loader_html . '</div>';
	}

	/**
	 * Renders the inline loading-icon SVG for one item, with IDs unique per item and gallery instance.
	 *
	 * @since   1.0.0
	 * @param   Item_View      $item_view Item data.
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function render_loader( Item_View $item_view, Render_Context $render_context ): string {
		$icon_name = $render_context->settings['loading_icon'] ?? '';
		if ( ! is_string( $icon_name ) || '' === $icon_name ) {
			$icon_name = '12-dots';
		}

		if ( $item_view->id > 0 ) {
			$instance_id = $render_context->meta->instance_id . '-i' . $item_view->id;
		} else {
			++$this->loader_counter;
			$instance_id = 'fgic' . $this->loader_counter;
		}

		$svg = \FotoGrids\Assets\Loading_Icon_Library::svg( $icon_name, $instance_id );

		if ( '' === $svg ) {
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
			$wrapped_html  = sprintf( '<%s%s>%s</%s>', $safe_tag_name, $attribute_pairs, $wrapped_html, $safe_tag_name );
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
