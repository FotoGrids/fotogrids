<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable render-time representation of an item.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Item_View {

	/**
	 * @param array<string, mixed> $meta Per-item metadata values.
	 * @param array<int, string> $classes Item classes.
	 * @param array<string, string> $data_attrs Item data attributes.
	 * @param array<string, string> $style Inline CSS declarations (property => value) emitted on the figure element. Used by layouts/decorators that need per-item CSS custom properties (e.g. Instant Photos per-item rotation/shadow).
	 * @param array<int, Item_Overlay> $thumb_overlays Thumbnail overlays.
	 * @param array<int, Item_Overlay> $lightbox_overlays Lightbox overlays.
	 * @param array<int, Item_Wrapper> $wrappers Wrappers applied around the media node (fg-item-media) only.
	 * @param array<int, Item_Wrapper> $figure_wrappers Wrappers applied around the entire figure contents (media + caption).
	 */
	public function __construct(
		public readonly int $id,
		public readonly string $thumb_url,
		public readonly string $full_url,
		public readonly string $alt,
		public readonly string $title,
		/** Raw attachment post_excerpt - source of truth for caption_title/caption_description resolution. */
		public readonly string $caption,
		/** Raw attachment post_content. Available as a caption source (item_description). */
		public readonly string $description,
		/**
		 * Resolved caption title text after applying caption_hide_title and
		 * caption_title_source settings.  Empty string when the title is hidden
		 * or the resolved source field is blank.  Set by Context_Builder.
		 */
		public readonly string $caption_title = '',
		/**
		 * Resolved caption description text after applying caption_hide_description
		 * and caption_description_source settings.  Empty string when hidden or blank.
		 * Set by Context_Builder.
		 */
		public readonly string $caption_description = '',
		public readonly ?int $width = null,
		public readonly ?int $height = null,
		public readonly array $meta = array(),
		public readonly array $classes = array(),
		public readonly array $data_attrs = array(),
		public readonly array $style = array(),
		public readonly array $thumb_overlays = array(),
		public readonly array $lightbox_overlays = array(),
		public readonly array $wrappers = array(),
		public readonly array $figure_wrappers = array(),
		/**
		 * The resolved WP size slug used for the thumbnail.
		 * Passed to wp_get_attachment_image_srcset() in Item_Renderer so srcset
		 * matches the actual displayed size rather than hardcoding 'large'.
		 */
		public readonly string $thumb_size = 'large',
		/**
		 * Intrinsic dimensions of full_url. Distinct from width/height which
		 * describe thumb_url's intrinsic dimensions.
		 */
		public readonly ?int $full_width = null,
		public readonly ?int $full_height = null,
		/**
		 * Item kind. 'image' for attachments that resolve to an image, or one
		 * of the video identifiers ('video_file', 'video_youtube',
		 * 'video_vimeo'). Drives the video render branch in Item_Renderer and
		 * the playback routing in the frontend modules.
		 */
		public readonly string $item_type = 'image',
		/**
		 * Poster image URL shown in the gallery grid for video items. Resolved
		 * through the poster chain (custom → WP poster → oEmbed → extracted
		 * frame → placeholder). Empty for image items, which use thumb_url.
		 */
		public readonly string $poster_url = '',
		/**
		 * Direct media URL for a Media Library video file (video_file items).
		 * Empty for images and for embed items, which carry embed_id instead.
		 */
		public readonly string $video_src = '',
		/**
		 * Embed provider slug for embed items ('youtube' | 'vimeo'). Empty for
		 * images and file videos.
		 */
		public readonly string $embed_provider = '',
		/**
		 * Platform video ID for embed items. Empty for images and file videos.
		 */
		public readonly string $embed_id = '',
		/**
		 * Per-item embed playback settings (autoplay, mute, loop, controls,
		 * start/end, etc.) as stored in fotogrids_item_meta.custom_data. Empty
		 * for images and file videos.
		 *
		 * @var array<string, mixed>
		 */
		public readonly array $embed_settings = array(),
	) {}

	/**
	 * Returns a cloned item with selected fields replaced.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $changes Replacement values.
	 * @return  self
	 */
	public function with( array $changes ): self {
		return new self(
			id: $changes['id'] ?? $this->id,
			thumb_url: $changes['thumb_url'] ?? $this->thumb_url,
			full_url: $changes['full_url'] ?? $this->full_url,
			alt: $changes['alt'] ?? $this->alt,
			title: $changes['title'] ?? $this->title,
			caption: $changes['caption'] ?? $this->caption,
			description: $changes['description'] ?? $this->description,
			caption_title: $changes['caption_title'] ?? $this->caption_title,
			caption_description: $changes['caption_description'] ?? $this->caption_description,
			width: $changes['width'] ?? $this->width,
			height: $changes['height'] ?? $this->height,
			meta: $changes['meta'] ?? $this->meta,
			classes: $changes['classes'] ?? $this->classes,
			data_attrs: $changes['data_attrs'] ?? $this->data_attrs,
			style: $changes['style'] ?? $this->style,
			thumb_overlays: $changes['thumb_overlays'] ?? $this->thumb_overlays,
			lightbox_overlays: $changes['lightbox_overlays'] ?? $this->lightbox_overlays,
			wrappers: $changes['wrappers'] ?? $this->wrappers,
			figure_wrappers: $changes['figure_wrappers'] ?? $this->figure_wrappers,
			thumb_size: $changes['thumb_size'] ?? $this->thumb_size,
			full_width: $changes['full_width'] ?? $this->full_width,
			full_height: $changes['full_height'] ?? $this->full_height,
			item_type: $changes['item_type'] ?? $this->item_type,
			poster_url: $changes['poster_url'] ?? $this->poster_url,
			video_src: $changes['video_src'] ?? $this->video_src,
			embed_provider: $changes['embed_provider'] ?? $this->embed_provider,
			embed_id: $changes['embed_id'] ?? $this->embed_id,
			embed_settings: $changes['embed_settings'] ?? $this->embed_settings,
		);
	}
}
