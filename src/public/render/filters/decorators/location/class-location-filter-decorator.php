<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Decorators\Location;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Location filter decorator.
 *
 * Stamps a space-separated list of location slugs onto each item as the
 * `data-fg-location` attribute. The JS filter engine reads this attribute to
 * determine which items match an active location filter.
 *
 * Active when:
 *   - filtering_enabled is truthy
 *   - filter_by (token_select) contains 'location'
 *
 * Uses a single batch SELECT against fotogrids_item_metadata + fotogrids_tags
 * (type = 'location') for all items - no N+1.
 *
 * @package FotoGrids\Render\Filters\Decorators\Location
 * @since   1.0.0
 */
final class Location_Filter_Decorator implements Decorator {

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * This class is part of the FotoGrids custom-table data layer. Every
	 * interpolated table name is built as `$wpdb->prefix . 'fotogrids_*'`
	 * (or a WP core table such as $wpdb->posts) -- a trusted identifier that
	 * WP placeholders cannot bind. All user-supplied *values* are passed
	 * through $wpdb->prepare(); where SQL is assembled incrementally or uses
	 * a generated %d IN() list, the prepare call is a separate statement the
	 * sniff cannot follow. Custom tables have no WP_Query / core-API
	 * equivalent and no object-cache layer applies at this level.
	 * ---------------------------------------------------------------------
	 */
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:disable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	public function id(): string {
		return 'fotogrids/decorator/filter-location';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		if ( ! ( $render_context->settings['filtering_enabled'] ?? false ) ) {
			return false;
		}

		$filter_by = $render_context->settings['filter_by'] ?? array();
		if ( is_string( $filter_by ) ) {
			$decoded   = json_decode( $filter_by, true );
			$filter_by = is_array( $decoded ) ? $decoded : array( $filter_by );
		}

		return is_array( $filter_by ) && in_array( 'location', $filter_by, true );
	}

	/**
	 * @since  1.0.0
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		if ( empty( $collection_items ) ) {
			return $collection_items;
		}

		$item_ids     = array_map( static fn( Item_View $item ) => $item->id, $collection_items );
		$location_map = $this->batch_fetch_locations( $item_ids );

		return array_map(
			static function ( Item_View $item ) use ( $location_map ): Item_View {
				$slugs          = $location_map[ $item->id ] ?? array();
				$location_value = implode( ' ', $slugs );

				return $item->with(
					array(
						'data_attrs' => array_merge(
							$item->data_attrs,
							array( 'data-fg-location' => $location_value )
						),
					)
				);
			},
			$collection_items
		);
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}

	/**
	 * @param  array<int, int> $item_ids
	 * @return array<int, array<int, string>>
	 */
	private function batch_fetch_locations( array $item_ids ): array {
		if ( empty( $item_ids ) ) {
			return array();
		}

		global $wpdb;

		$placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT im.attachment_id, t.slug
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = 'location'
                 WHERE im.metadata_type = 'location'
                   AND im.attachment_id IN ($placeholders)
                 ORDER BY t.name ASC",
				...$item_ids
			),
			ARRAY_A
		);
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( empty( $rows ) ) {
			return array();
		}

		$location_map = array();
		foreach ( $rows as $row ) {
			$attachment_id                    = (int) $row['attachment_id'];
			$location_map[ $attachment_id ][] = sanitize_html_class( (string) $row['slug'] );
		}

		return $location_map;
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
