<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable metadata describing the render request.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Meta {

	public int $gallery_id;
	public ?int $album_id;
	public string $instance_id;
	public string $source;
	public bool $is_preview;
	public string $mode;
	public int $schema_version;
	public string $collection_kind;
	public ?int $requested_page;
	public ?int $requested_per_page;
	public ?string $breakpoint;
	public ?string $partial;
	public ?int $total_item_count;
	public array $active_filters;
	public ?int $random_seed;
	public bool $view_page;
	public bool $is_ajax_swap;
	public ?int $container_width;
	public ?int $pagination_page_size;
	public ?int $pagination_total_pages;

	/**
	 * @since   1.0.0
	 * @param   int             $gallery_id Gallery identifier. Zero when rendering an album-as-collection.
	 * @param   int|null        $album_id Album identifier. Non-null when rendering a gallery inside an album, OR when collection_kind === ALBUM (in which case this IS the album being rendered).
	 * @param   string          $instance_id Unique instance ID.
	 * @param   Request_Source  $source Render source.
	 * @param   bool            $is_preview Whether this is preview mode.
	 * @param   Render_Mode     $mode Request mode.
	 * @param   int             $schema_version Request schema version.
	 * @param   Collection_Kind $collection_kind Whether this render is a gallery (default) or an album-as-collection.
	 * @param   int|null        $requested_page The 1-based page number requested by the caller (pagination). Null = page 1 / no pagination.
	 * @param   int|null        $requested_per_page Caller-supplied items_per_page override (pagination REST requests). Null = use saved setting.
	 * @param   string|null     $breakpoint Active breakpoint hint from the caller ('desktop' | 'tablet' | 'mobile'). Null = unknown.
	 * @param   string|null     $partial Partial-render hint. 'items_only' = return only the layout's inner HTML (no wrapper, no chrome). Null = full render.
	 * @param   int|null        $total_item_count Total item count BEFORE pagination slicing — set by Context_Builder so pagination chrome can emit data-fg-page-total correctly. Null = unknown.
	 * @param   array<string, array<int, string>> $active_filters Selected filter values per source arg key (e.g. ['tags' => ['nature', 'sky']]). Empty array = no filter.
	 * @param   int|null        $random_seed Seed for deterministic random sorting. Set on initial render and sent back by the client on paginated requests so each page draws from the same shuffle. Null = unseeded (initial paint with no inherited seed).
	 * @param   bool            $view_page True when rendered on a standalone Gallery/Album View Page (ViewCollections renderer); false on embedded shortcode/block renders. Read by Collection_Header to gate the 'view_pages' breadcrumb placement.
	 * @param   bool            $is_ajax_swap True when the render is being produced specifically for an Album → Gallery AJAX swap. Used to suppress BreadcrumbList JSON-LD on swaps (the page URL has not changed, so emitting fresh schema would describe content that does not match the canonical URL).
	 * @param   int|null        $container_width Measured gallery container width in CSS pixels, sent by the client on later renders. Used by the justified snap-pagination resolver. Null = no measurement; the resolver falls back to a per-breakpoint assumed width.
	 * @param   int|null        $pagination_page_size Authoritative page size for THIS page, set after Context_Builder runs pagination (including snap). Null = no pagination ran.
	 * @param   int|null        $pagination_total_pages Authoritative total page count, set after Context_Builder runs pagination. Null = no pagination ran.
	 * @return  void
	 */
	public function __construct(
		int $gallery_id,
		?int $album_id,
		string $instance_id,
		string $source,
		bool $is_preview,
		string $mode,
		int $schema_version = 2,
		string $collection_kind = Collection_Kind::GALLERY,
		?int $requested_page = null,
		?int $requested_per_page = null,
		?string $breakpoint = null,
		?string $partial = null,
		?int $total_item_count = null,
		array $active_filters = array(),
		?int $random_seed = null,
		bool $view_page = false,
		bool $is_ajax_swap = false,
		?int $container_width = null,
		?int $pagination_page_size = null,
		?int $pagination_total_pages = null
	) {
		$this->gallery_id = $gallery_id;
		$this->album_id = $album_id;
		$this->instance_id = $instance_id;
		$this->source = $source;
		$this->is_preview = $is_preview;
		$this->mode = $mode;
		$this->schema_version = $schema_version;
		$this->collection_kind = $collection_kind;
		$this->requested_page = $requested_page;
		$this->requested_per_page = $requested_per_page;
		$this->breakpoint = $breakpoint;
		$this->partial = $partial;
		$this->total_item_count = $total_item_count;
		$this->active_filters = $active_filters;
		$this->random_seed = $random_seed;
		$this->view_page = $view_page;
		$this->is_ajax_swap = $is_ajax_swap;
		$this->container_width = $container_width;
		$this->pagination_page_size = $pagination_page_size;
		$this->pagination_total_pages = $pagination_total_pages;
	}

	/**
	 * Returns a new Render_Meta with the given fields overridden.
	 *
	 * Mirrors Render_Context::with(). Used by Context_Builder to set
	 * total_item_count after sorter selection but before pagination
	 * slicing.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $changes
	 * @return self
	 */
	public function with( array $changes ): self {
		return new self(
			array_key_exists( 'gallery_id', $changes ) ? $changes['gallery_id'] : $this->gallery_id,
			array_key_exists( 'album_id', $changes ) ? $changes['album_id'] : $this->album_id,
			array_key_exists( 'instance_id', $changes ) ? $changes['instance_id'] : $this->instance_id,
			array_key_exists( 'source', $changes ) ? $changes['source'] : $this->source,
			array_key_exists( 'is_preview', $changes ) ? $changes['is_preview'] : $this->is_preview,
			array_key_exists( 'mode', $changes ) ? $changes['mode'] : $this->mode,
			array_key_exists( 'schema_version', $changes ) ? $changes['schema_version'] : $this->schema_version,
			array_key_exists( 'collection_kind', $changes ) ? $changes['collection_kind'] : $this->collection_kind,
			array_key_exists( 'requested_page', $changes ) ? $changes['requested_page'] : $this->requested_page,
			array_key_exists( 'requested_per_page', $changes ) ? $changes['requested_per_page'] : $this->requested_per_page,
			array_key_exists( 'breakpoint', $changes ) ? $changes['breakpoint'] : $this->breakpoint,
			array_key_exists( 'partial', $changes ) ? $changes['partial'] : $this->partial,
			array_key_exists( 'total_item_count', $changes ) ? $changes['total_item_count'] : $this->total_item_count,
			array_key_exists( 'active_filters', $changes ) ? $changes['active_filters'] : $this->active_filters,
			array_key_exists( 'random_seed', $changes ) ? $changes['random_seed'] : $this->random_seed,
			array_key_exists( 'view_page', $changes ) ? $changes['view_page'] : $this->view_page,
			array_key_exists( 'is_ajax_swap', $changes ) ? $changes['is_ajax_swap'] : $this->is_ajax_swap,
			array_key_exists( 'container_width', $changes ) ? $changes['container_width'] : $this->container_width,
			array_key_exists( 'pagination_page_size', $changes ) ? $changes['pagination_page_size'] : $this->pagination_page_size,
			array_key_exists( 'pagination_total_pages', $changes ) ? $changes['pagination_total_pages'] : $this->pagination_total_pages,
		);
	}
}
