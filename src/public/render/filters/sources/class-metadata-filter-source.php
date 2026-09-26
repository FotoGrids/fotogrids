<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Filter_Option;
use FotoGrids\Render\Api\Filter_Source;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared base for filter sources that key off `fotogrids_item_metadata`
 * + `fotogrids_tags` joined by `metadata_type` / `tags.type`.
 *
 * Metadata-backed filter sources share the same query shape and predicate
 * logic - only the metadata_type discriminator, arg key, label, and item
 * data attribute differ. Subclasses just declare those constants; everything
 * else lives here. Free ships the Tags source; Pro adds further sources
 * (e.g. People, Location) by extending this base.
 *
 * Pro filter sources that don't fit this schema (e.g. EXIF-based filters
 * with custom storage) should implement Filter_Source directly instead
 * of extending this base.
 *
 * @package FotoGrids\Render\Filters\Sources
 * @since   1.0.0
 */
abstract class Metadata_Filter_Source implements Filter_Source {

	/**
	 * Value the source contributes to the `filter_by` setting (e.g. 'tags',
	 * 'people', 'location'). The Filter_UI feature exposes a token-select
	 * with these values, and supports() only activates when this value is
	 * present in the saved setting.
	 */
	abstract protected function filter_by_token(): string;

	/**
	 * Value stored in the `metadata_type` column of
	 * fotogrids_item_metadata AND the `type` column of fotogrids_tags
	 * for rows belonging to this source. Singular: 'tag', 'person',
	 * 'location'.
	 */
	abstract protected function metadata_type(): string;

	/**
	 * Translated group label shown above this source's controls.
	 */
	abstract protected function group_label_string(): string;

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

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

		return is_array( $filter_by ) && in_array( $this->filter_by_token(), $filter_by, true );
	}

	public function group_label( Render_Context $render_context ): string {
		return $this->group_label_string();
	}

	public function get_options( Render_Context $render_context ): array {
		// Query the full gallery's item set, not the sliced page, so the bar lists
		// every tag with correct counts. supports() excludes albums.
		$gallery_id = (int) $render_context->meta->gallery_id;
		$all_ids    = $gallery_id > 0 && class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id )
			: array();

		$item_ids = is_array( $all_ids )
			? array_map( 'intval', $all_ids )
			: array_map( static fn( $item ) => (int) $item->id, $render_context->items );

		if ( empty( $item_ids ) ) {
			return array();
		}

		global $wpdb;
		$placeholders  = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );
		$metadata_type = $this->metadata_type();

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders is a generated list of %d tokens.
		$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom table; no core API or object cache applies.
			$wpdb->prepare(
				"SELECT t.name, t.slug, COUNT(DISTINCT im.attachment_id) AS item_count
                 FROM %i im
                 INNER JOIN %i t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)
                 GROUP BY t.id, t.name, t.slug
                 HAVING item_count > 0
                 ORDER BY t.name ASC",
				$wpdb->prefix . 'fotogrids_item_metadata',
				$wpdb->prefix . 'fotogrids_tags',
				$metadata_type,
				$metadata_type,
				...$item_ids
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		if ( empty( $rows ) ) {
			return array();
		}

		$options = array();
		foreach ( $rows as $row ) {
			$options[] = new Filter_Option(
				(string) $row['slug'],
				(string) $row['name'],
				(int) $row['item_count'],
			);
		}
		return $options;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}

	public function matches( int $item_id, array $values, Render_Context $render_context ): bool {
		if ( empty( $values ) ) {
			return true;
		}

		$map   = $this->ensure_slug_map( $render_context );
		$slugs = $map[ $item_id ] ?? array();
		if ( empty( $slugs ) ) {
			return false;
		}
		foreach ( $values as $v ) {
			if ( in_array( $v, $slugs, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Per-(instance, source) cache of attachment_id → [slug, …].
	 * Two sources can be active for the same gallery, so entries are keyed by
	 * both source id and instance id.
	 *
	 * @return array<int, array<int, string>>
	 */
	private function ensure_slug_map( Render_Context $render_context ): array {
		static $cache = array();
		$cache_key    = $this->id() . '@' . $render_context->meta->instance_id;

		if ( isset( $cache[ $cache_key ] ) ) {
			return $cache[ $cache_key ];
		}

		$item_ids = array_map(
			static fn( $item ) => (int) $item->id,
			$render_context->items
		);
		if ( empty( $item_ids ) ) {
			$cache[ $cache_key ] = array();
			return array();
		}

		global $wpdb;
		$placeholders  = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );
		$metadata_type = $this->metadata_type();

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $placeholders is a generated list of %d tokens.
		$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom table; no core API or object cache applies.
			$wpdb->prepare(
				"SELECT im.attachment_id, t.slug
                 FROM %i im
                 INNER JOIN %i t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)",
				$wpdb->prefix . 'fotogrids_item_metadata',
				$wpdb->prefix . 'fotogrids_tags',
				$metadata_type,
				$metadata_type,
				...$item_ids
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		$map = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$aid           = (int) $row['attachment_id'];
				$map[ $aid ][] = sanitize_html_class( (string) $row['slug'] );
			}
		}
		$cache[ $cache_key ] = $map;
		return $map;
	}
}
