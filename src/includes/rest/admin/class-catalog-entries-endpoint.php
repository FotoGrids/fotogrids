<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

use FotoGrids\Catalog\Catalog;
use FotoGrids\Catalog\Catalog_Assembler;
use FotoGrids\Render\Internal\Hover_Effect_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * REST endpoint that returns the assembled settings tree for the admin UI.
 *
 * The endpoint reads every contributed catalog file (Free + Pro + any third-party
 * extension that registered via the `fotogrids/catalog/json_files` filter), runs
 * it through Catalog_Assembler, and returns the final tab/subtab/section tree
 * the JS settings panel renders.
 *
 * Replaces the legacy approach of fetching individual JSON files from the
 * browser - Pro/third-party files were never reachable that way because they
 * live in different plugin directories.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */
final class Catalog_Entries_Endpoint {

	/**
	 * Build the assembled settings tree response.
	 *
	 * @since   1.0.0
	 * @param   \WP_REST_Request $request Request object.
	 * @return  \WP_REST_Response
	 */
	public static function get_entries( \WP_REST_Request $request ): \WP_REST_Response {
		$post_type = sanitize_text_field( (string) ( $request->get_param( 'post_type' ) ?? 'gallery' ) );
		if ( 'fotogrids_gallery' === $post_type ) {
			$post_type = 'gallery';
		} elseif ( 'fotogrids_album' === $post_type ) {
			$post_type = 'album';
		}

		$raw_files = Catalog::raw_files();

		$assembler       = new Catalog_Assembler();
		$assembly_result = $assembler->assemble( $raw_files );

		$tree = self::filter_tree_by_post_type( $assembly_result['tree'], $post_type );
		self::inject_hover_effect_options( $tree );

		return rest_ensure_response(
			array(
				'groups'    => $tree,
				'warnings'  => $assembly_result['warnings'],
				'post_type' => $post_type,
			)
		);
	}

	/**
	 * Drop top-level tabs whose `postTypes` array excludes the requested post type.
	 *
	 * The JS layer also applies per-setting and per-subtab postType filtering,
	 * but tab-level filtering happens server-side so we don't ship tabs the user
	 * can never see.
	 *
	 * @since   1.0.0
	 * @param   array<string, array<string, mixed>> $tree Assembled tree.
	 * @param   string                              $post_type Normalized post type slug.
	 * @return  array<string, array<string, mixed>>
	 */
	private static function filter_tree_by_post_type( array $tree, string $post_type ): array {
		$filtered = array();

		foreach ( $tree as $tab_id => $tab_node ) {
			$allowed_post_types = $tab_node['postTypes'] ?? null;

			if ( is_array( $allowed_post_types ) && ! in_array( $post_type, $allowed_post_types, true ) ) {
				continue;
			}

			$filtered[ $tab_id ] = $tab_node;
		}

		return $filtered;
	}

	/**
	 * Replaces the `hover_effect` field's options with the registry's effects so
	 * the grid renders from the single source of truth (Free, Pro, third-party).
	 *
	 * @since   1.0.0
	 * @param   array<string, array<string, mixed>> $tree Assembled tree (by reference).
	 * @return  void
	 */
	private static function inject_hover_effect_options( array &$tree ): void {
		if ( ! class_exists( Hover_Effect_Registry::class ) ) {
			return;
		}

		$options = Hover_Effect_Registry::as_options();
		if ( array() === $options ) {
			return;
		}

		self::walk_settings(
			$tree,
			static function ( array &$setting ) use ( $options ): void {
				if ( isset( $setting['key'] ) && 'hover_effect' === $setting['key'] ) {
					$setting['options'] = $options;
				}
			}
		);
	}

	/**
	 * Depth-first visit of every setting node in the tree, mutating in place.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed>                     $nodes  Nodes to walk (by reference).
	 * @param   callable(array<string, mixed> &$setting): void $visit Visitor.
	 * @return  void
	 */
	private static function walk_settings( array &$nodes, callable $visit ): void {
		foreach ( $nodes as &$node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}

			if ( isset( $node['key'] ) ) {
				$visit( $node );
			}

			foreach ( array( 'settings', 'subTabs' ) as $child_key ) {
				if ( isset( $node[ $child_key ] ) && is_array( $node[ $child_key ] ) ) {
					self::walk_settings( $node[ $child_key ], $visit );
				}
			}
		}
		unset( $node );
	}
}
