<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters;

use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Base class for sorters that need attachment metadata from wp_posts.
 *
 * Issues a single batch SELECT for post_title, post_date, post_modified, and
 * guid. Concrete sorters call batch_fetch() and receive a map they can sort
 * against without any further DB queries.
 *
 * IDs not returned by the query (trashed / deleted attachments) are separated
 * into an $unsortable list and appended after the sorted set, so Context_Builder
 * handles them the same way it always has.
 *
 * @package FotoGrids\Render\Sorters
 * @since   1.0.0
 */
abstract class Abstract_Db_Sorter {

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

	// -------------------------------------------------------------------------
	// Shared interface stubs - concrete sorters only need to override what
	// differs (id, origin, supports, sort).
	// -------------------------------------------------------------------------

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function assets( Render_Context $render_context ): Module_Assets { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		return new Module_Assets();
	}

	// -------------------------------------------------------------------------
	// Batch DB helpers
	// -------------------------------------------------------------------------

	/**
	 * Batch-fetch sort columns from wp_posts for the given attachment IDs.
	 *
	 * Returns a map of attachment_id → row array (ID, post_title, post_date,
	 * post_modified, guid). Only rows with post_type = 'attachment' are returned,
	 * so any non-attachment ID simply won't appear in the map.
	 *
	 * @since   1.0.0
	 * @param   array<int, int> $item_ids Attachment IDs to fetch.
	 * @return  array<int, array{ID: string, post_title: string, post_date: string, post_modified: string, guid: string}>
	 */
	protected function batch_fetch( array $item_ids ): array {
		if ( empty( $item_ids ) ) {
			return array();
		}

		global $wpdb;

		$placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, post_type, post_title, post_date, post_modified, guid
                 FROM {$wpdb->posts}
                 WHERE ID IN ({$placeholders})
                   AND post_type IN ('attachment', 'fotogrids_embed')",
				...$item_ids
			),
			ARRAY_A
		);

		if ( ! is_array( $rows ) ) {
			return array();
		}

		$map = array();
		foreach ( $rows as $row ) {
			$map[ (int) $row['ID'] ] = $row;
		}

		return $map;
	}

	/**
	 * Split $item_ids into two lists: those present in $row_map and those not.
	 *
	 * Returns [ $sortable, $unsortable ] where $sortable preserves original
	 * relative order before the caller applies usort().
	 *
	 * @since   1.0.0
	 * @param   array<int, int>   $item_ids Attachment IDs.
	 * @param   array<int, mixed> $row_map  Map keyed by attachment ID.
	 * @return  array{array<int, int>, array<int, int>}
	 */
	protected function split_sortable( array $item_ids, array $row_map ): array {
		$sortable   = array();
		$unsortable = array();

		foreach ( $item_ids as $id ) {
			if ( isset( $row_map[ $id ] ) ) {
				$sortable[] = $id;
			} else {
				$unsortable[] = $id;
			}
		}

		return array( $sortable, $unsortable );
	}

    // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
    // phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
    // phpcs:enable WordPress.DB.PreparedSQL.NotPrepared
    // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    // phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
    // phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
    // phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
