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

	public int $id;
	public string $thumb_url;
	public string $full_url;
	public string $alt;
	public string $title;
	public string $caption;
	public string $description;
	public string $caption_title;
	public string $caption_description;
	public ?int $width;
	public ?int $height;
	public array $meta;
	public array $classes;
	public array $data_attrs;
	public array $style;
	public array $thumb_overlays;
	public array $lightbox_overlays;
	public array $wrappers;
	public array $figure_wrappers;
	public string $thumb_size;
	public ?int $full_width;
	public ?int $full_height;
	public string $item_type;
	public string $poster_url;
	public string $video_src;
	public string $embed_provider;
	public string $embed_id;
	public array $embed_settings;

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
		int $id,
		string $thumb_url,
		string $full_url,
		string $alt,
		string $title,
		/** Raw attachment post_excerpt - source of truth for caption_title/caption_description resolution. */
		string $caption,
		/** Raw attachment post_content. Available as a caption source (item_description). */
		string $description,
		/**
		 * Resolved caption title text after applying caption_hide_title and
		 * caption_title_source settings.  Empty string when the title is hidden
		 * or the resolved source field is blank.  Set by Context_Builder.
		 */
		string $caption_title = '',
		/**
		 * Resolved caption description text after applying caption_hide_description
		 * and caption_description_source settings.  Empty string when hidden or blank.
		 * Set by Context_Builder.
		 */
		string $caption_description = '',
		?int $width = null,
		?int $height = null,
		array $meta = array(),
		array $classes = array(),
		array $data_attrs = array(),
		array $style = array(),
		array $thumb_overlays = array(),
		array $lightbox_overlays = array(),
		array $wrappers = array(),
		array $figure_wrappers = array(),
		/**
		 * The resolved WP size slug used for the thumbnail.
		 * Passed to wp_get_attachment_image_srcset() in Item_Renderer so srcset
		 * matches the actual displayed size rather than hardcoding 'large'.
		 */
		string $thumb_size = 'large',
		/**
		 * Intrinsic dimensions of full_url. Distinct from width/height which
		 * describe thumb_url's intrinsic dimensions.
		 */
		?int $full_width = null,
		?int $full_height = null,
		/**
		 * Item kind. 'image' for attachments that resolve to an image, or one
		 * of the video identifiers ('video_file', 'video_youtube',
		 * 'video_vimeo'). Drives the video render branch in Item_Renderer and
		 * the playback routing in the frontend modules.
		 */
		string $item_type = 'image',
		/**
		 * Poster image URL shown in the gallery grid for video items. Resolved
		 * through the poster chain (custom → WP poster → oEmbed → extracted
		 * frame → placeholder). Empty for image items, which use thumb_url.
		 */
		string $poster_url = '',
		/**
		 * Direct media URL for a Media Library video file (video_file items).
		 * Empty for images and for embed items, which carry embed_id instead.
		 */
		string $video_src = '',
		/**
		 * Embed provider slug for embed items ('youtube' | 'vimeo'). Empty for
		 * images and file videos.
		 */
		string $embed_provider = '',
		/**
		 * Platform video ID for embed items. Empty for images and file videos.
		 */
		string $embed_id = '',
		/**
		 * Per-item embed playback settings (autoplay, mute, loop, controls,
		 * start/end, etc.) as stored in fotogrids_item_meta.custom_data. Empty
		 * for images and file videos.
		 *
		 * @var array<string, mixed>
		 */
		array $embed_settings = array()
	) {
		$this->id                  = $id;
		$this->thumb_url           = $thumb_url;
		$this->full_url            = $full_url;
		$this->alt                 = $alt;
		$this->title               = $title;
		$this->caption             = $caption;
		$this->description         = $description;
		$this->caption_title       = $caption_title;
		$this->caption_description = $caption_description;
		$this->width               = $width;
		$this->height              = $height;
		$this->meta                = $meta;
		$this->classes             = $classes;
		$this->data_attrs          = $data_attrs;
		$this->style               = $style;
		$this->thumb_overlays      = $thumb_overlays;
		$this->lightbox_overlays   = $lightbox_overlays;
		$this->wrappers            = $wrappers;
		$this->figure_wrappers     = $figure_wrappers;
		$this->thumb_size          = $thumb_size;
		$this->full_width          = $full_width;
		$this->full_height         = $full_height;
		$this->item_type           = $item_type;
		$this->poster_url          = $poster_url;
		$this->video_src           = $video_src;
		$this->embed_provider      = $embed_provider;
		$this->embed_id            = $embed_id;
		$this->embed_settings      = $embed_settings;
	}

	/**
	 * Returns a cloned item with selected fields replaced.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $changes Replacement values.
	 * @return  self
	 */
	public function with( array $changes ): self {
		return new self(
			$changes['id'] ?? $this->id,
			$changes['thumb_url'] ?? $this->thumb_url,
			$changes['full_url'] ?? $this->full_url,
			$changes['alt'] ?? $this->alt,
			$changes['title'] ?? $this->title,
			$changes['caption'] ?? $this->caption,
			$changes['description'] ?? $this->description,
			$changes['caption_title'] ?? $this->caption_title,
			$changes['caption_description'] ?? $this->caption_description,
			$changes['width'] ?? $this->width,
			$changes['height'] ?? $this->height,
			$changes['meta'] ?? $this->meta,
			$changes['classes'] ?? $this->classes,
			$changes['data_attrs'] ?? $this->data_attrs,
			$changes['style'] ?? $this->style,
			$changes['thumb_overlays'] ?? $this->thumb_overlays,
			$changes['lightbox_overlays'] ?? $this->lightbox_overlays,
			$changes['wrappers'] ?? $this->wrappers,
			$changes['figure_wrappers'] ?? $this->figure_wrappers,
			$changes['thumb_size'] ?? $this->thumb_size,
			$changes['full_width'] ?? $this->full_width,
			$changes['full_height'] ?? $this->full_height,
			$changes['item_type'] ?? $this->item_type,
			$changes['poster_url'] ?? $this->poster_url,
			$changes['video_src'] ?? $this->video_src,
			$changes['embed_provider'] ?? $this->embed_provider,
			$changes['embed_id'] ?? $this->embed_id,
			$changes['embed_settings'] ?? $this->embed_settings,
		);
	}
}
