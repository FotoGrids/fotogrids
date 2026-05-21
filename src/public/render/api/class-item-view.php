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
        public readonly string $caption,
        public readonly ?int $width,
        public readonly ?int $height,
        public readonly array $meta = [],
        public readonly array $classes = [],
        public readonly array $data_attrs = [],
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
            width: $changes['width'] ?? $this->width,
            height: $changes['height'] ?? $this->height,
            meta: $changes['meta'] ?? $this->meta,
            classes: $changes['classes'] ?? $this->classes,
            data_attrs: $changes['data_attrs'] ?? $this->data_attrs,
            thumb_overlays: $changes['thumb_overlays'] ?? $this->thumb_overlays,
            lightbox_overlays: $changes['lightbox_overlays'] ?? $this->lightbox_overlays,
            wrappers: $changes['wrappers'] ?? $this->wrappers,
            figure_wrappers: $changes['figure_wrappers'] ?? $this->figure_wrappers,
            thumb_size: $changes['thumb_size'] ?? $this->thumb_size,
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
