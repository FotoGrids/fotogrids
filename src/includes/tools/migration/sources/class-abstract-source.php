<?php
namespace FotoGrids\Tools\Migration\Sources;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Abstract Migration Source
 *
 * Provides defaults for Source_Interface so a stub source only needs to
 * declare its identity (id, label, description, icon, group) and how to
 * detect its plugin. A stub that cannot import yet inherits scan()/import()
 * that return an empty result and a coming-soon message.
 *
 * @since 1.0.0
 */
abstract class Abstract_Source implements Source_Interface {

	/**
	 * {@inheritdoc}
	 *
	 * Derived from the group: gallery sources use the grid icon, slider
	 * sources use the horizontal-transition icon. The WordPress core source
	 * overrides this.
	 *
	 * @since 1.0.0
	 */
	public function get_icon(): string {
		return 'slider' === $this->get_group() ? 'transition_horizontal' : 'layout_3x3';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Defaults to the FotoGrids blue. Sources with a recognisable brand
	 * colour override this.
	 *
	 * @since 1.0.0
	 */
	public function get_brand_color(): string {
		return 'var(--fg-blue)';
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function get_group(): string {
		return 'gallery';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Stubs are not available until their reader is implemented.
	 *
	 * @since 1.0.0
	 */
	public function is_available(): bool {
		return false;
	}

	/**
	 * {@inheritdoc}
	 *
	 * No detected data by default. Stubs override to report whether their
	 * plugin's posts, tables, or options exist.
	 *
	 * @since 1.0.0
	 */
	public function is_detected(): bool {
		return false;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Nothing to preview for a source that cannot import yet.
	 *
	 * @since 1.0.0
	 */
	public function scan(): array {
		return array();
	}

	/**
	 * {@inheritdoc}
	 *
	 * @since 1.0.0
	 */
	public function import( array $refs, string $conflict ): array {
		return array(
			'imported'  => 0,
			'skipped'   => 0,
			'galleries' => array(),
			'messages'  => array(
				__( 'Import for this source is not available yet.', 'fotogrids' ),
			),
		);
	}

	/**
	 * Whether a plugin is active, by its main file path.
	 *
	 * @since 1.0.0
	 * @param string $plugin_file Plugin basename, e.g. 'envira-gallery-lite/envira-gallery-lite.php'.
	 * @return bool
	 */
	protected function plugin_active( string $plugin_file ): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		return is_plugin_active( $plugin_file );
	}

	/**
	 * Whether any post of the given post type exists.
	 *
	 * @since 1.0.0
	 * @param string $post_type Post type slug.
	 * @return bool
	 */
	protected function post_type_has_posts( string $post_type ): bool {
		if ( ! post_type_exists( $post_type ) ) {
			return false;
		}

		$counts = (array) wp_count_posts( $post_type );

		foreach ( $counts as $count ) {
			if ( (int) $count > 0 ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Whether a custom database table exists.
	 *
	 * @since 1.0.0
	 * @param string $table_suffix Table name without the $wpdb->prefix.
	 * @return bool
	 */
	protected function table_exists( string $table_suffix ): bool {
		global $wpdb;
		$table = $wpdb->prefix . $table_suffix;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );

		return $found === $table;
	}
}
