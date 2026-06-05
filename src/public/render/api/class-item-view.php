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
        public readonly array $meta = [],
        public readonly array $classes = [],
        public readonly array $data_attrs = [],
        public readonly array $style = [],
        public readonly array $thumb_overlays = [],
        public readonly array $lightbox_overlays = [],
        public readonly array $wrappers = [],
        public readonly array $figure_wrappers = [],
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
        );
    }
}

/**
 * Overlay fragments rendered on item media.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Item_Overlay {

    /**
     * @param array<int, string> $extra_classes Additional classes for overlay node.
     */
    public function __construct(
        public readonly string $html,
        public readonly string $position_class,
        public readonly array $extra_classes = [],
    ) {}
}

/**
 * Wrapper metadata applied around an item image.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Item_Wrapper {

    /**
     * @param array<string, string> $attrs Wrapper attributes.
     */
    public function __construct(
        public readonly string $tag,
        public readonly array $attrs,
    ) {}
}
