<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Migration Source Interface
 *
 * A migration source reads galleries that live in another plugin (or in
 * WordPress core itself) and turns them into FotoGrids galleries. Every
 * source - WordPress core, a competitor gallery plugin, or a slider plugin -
 * implements this contract.
 *
 * A source is discoverable in two stages:
 *
 *   scan()   - read the foreign data and return a preview of what would be
 *              imported, without writing anything.
 *   import() - given a set of detected gallery references, create the
 *              corresponding FotoGrids galleries and items.
 *
 * A source that is registered but not yet able to import returns false from
 * is_available(); its scan()/import() are not called by the REST layer.
 *
 * @since 1.0.0
 */
interface Source_Interface {

	/**
	 * Unique source identifier, used as the ?source= REST param and the
	 * React card key.
	 *
	 * @since 1.0.0
	 * @return string e.g. 'wp-core'
	 */
	public function get_id(): string;

	/**
	 * Human-readable label shown on the source card.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_label(): string;

	/**
	 * Short description shown under the label on the source card.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_description(): string;

	/**
	 * Icon identifier - a FotoGrids icon id or dashicon slug.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_icon(): string;

	/**
	 * Brand colour for the source card icon, as a CSS colour value.
	 *
	 * The card tints the icon with this colour and uses a translucent shade
	 * of it as the icon background. Return a CSS custom property (e.g.
	 * 'var(--fg-blue)') when the source has no distinct brand colour.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_brand_color(): string;

	/**
	 * Logical grouping slug for the source picker: the core source, a
	 * gallery plugin, or a slider plugin.
	 *
	 * @since 1.0.0
	 * @return string
	 */
	public function get_group(): string;

	/**
	 * Whether import is implemented for this source.
	 *
	 * Sources that are registered for discoverability but cannot yet import
	 * return false; the picker shows a coming-soon state and the REST layer
	 * refuses scan/import for them.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public function is_available(): bool;

	/**
	 * Whether the source plugin's data is present on this site.
	 *
	 * For WordPress core this is always true. For a competitor plugin it
	 * reflects whether that plugin's posts, tables, or options exist - so
	 * the picker can show "Detected" against sources the user actually has.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public function is_detected(): bool;

	/**
	 * Scan the foreign data and return a preview of importable galleries.
	 *
	 * Each entry describes one gallery that would be created on import:
	 *
	 *   ref           - opaque string the source uses to identify this
	 *                   gallery on a subsequent import() call.
	 *   title         - proposed FotoGrids gallery title.
	 *   item_count    - number of images that would be imported.
	 *   thumbnail_url - optional preview image URL (first item).
	 *   origin        - optional human-readable origin (e.g. "Post: About").
	 *   origin_url    - optional edit/view link for the origin.
	 *
	 * Writes nothing.
	 *
	 * @since 1.0.0
	 * @return array<int, array<string, mixed>>
	 */
	public function scan(): array;

	/**
	 * Import the selected galleries into FotoGrids.
	 *
	 * @since 1.0.0
	 * @param array<int, string> $refs     Gallery refs returned by scan().
	 * @param string             $conflict Conflict mode: 'skip' | 'duplicate'.
	 * @return array{imported:int, skipped:int, galleries:array<int,int>, messages:array<int,string>}
	 */
	public function import( array $refs, string $conflict ): array;
}
