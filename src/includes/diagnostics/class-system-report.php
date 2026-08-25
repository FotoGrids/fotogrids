<?php
/**
 * Collects environment and FotoGrids state for the System Info tool.
 *
 * @package FotoGrids\Diagnostics
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Diagnostics;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds the System Info report.
 *
 * Every section is a plain array so the REST layer can hand it straight to the
 * UI and `to_text()` can render the same data as a clipboard-ready block.
 *
 * Secrets never enter the report: database credentials, Freemius keys and full
 * license keys are excluded by construction.
 *
 * @since 1.0.0
 */
final class System_Report {

	/**
	 * Row status values that render as a mark in the UI.
	 */
	private const STATUS_OK    = 'ok';
	private const STATUS_WARN  = 'warn';
	private const STATUS_ERROR = 'error';

	/**
	 * Memory limit below which the report warns, in bytes.
	 */
	private const RECOMMENDED_MEMORY_BYTES = 134217728;

	/**
	 * Builds the full ordered report.
	 *
	 * @since  1.0.0
	 * @return array<int, array<string, mixed>> Ordered sections.
	 */
	public static function get_sections(): array {
		$builders = array(
			'fotogrids' => array( __( 'FotoGrids', 'fotogrids' ), 'section_fotogrids' ),
			'database'  => array( __( 'Database', 'fotogrids' ), 'section_database' ),
			'wp'        => array( __( 'WordPress environment', 'fotogrids' ), 'section_wordpress' ),
			'server'    => array( __( 'Server environment', 'fotogrids' ), 'section_server' ),
			'media'     => array( __( 'Media', 'fotogrids' ), 'section_media' ),
			'theme'     => array( __( 'Theme', 'fotogrids' ), 'section_theme' ),
			'plugins'   => array( __( 'Plugins', 'fotogrids' ), 'section_plugins' ),
		);

		$sections = array();

		foreach ( $builders as $id => $builder ) {
			list( $label, $method ) = $builder;

			try {
				$sections[] = self::{$method}();
			} catch ( \Throwable $throwable ) {
				$sections[] = self::section(
					$id,
					$label,
					array(
						self::row(
							__( 'Could not be read', 'fotogrids' ),
							$throwable->getMessage(),
							self::STATUS_ERROR
						),
					)
				);
			}
		}

		return $sections;
	}

	/**
	 * Renders sections as plain text for the clipboard and the .txt download.
	 *
	 * @since  1.0.0
	 * @param  array<int, array<string, mixed>> $sections Output of get_sections().
	 * @return string
	 */
	public static function to_text( array $sections ): string {
		$lines = array(
			'### FotoGrids System Info ###',
			'Generated: ' . gmdate( 'Y-m-d H:i:s' ) . ' UTC',
			'',
		);

		foreach ( $sections as $section ) {
			$lines[] = '## ' . ( $section['label'] ?? '' );

			foreach ( $section['rows'] ?? array() as $row ) {
				$value = $row['value'] ?? '';

				if ( is_array( $value ) ) {
					$value = implode( ', ', $value );
				}

				$line = ' ' . ( $row['label'] ?? '' ) . ': ' . $value;

				if ( ! empty( $row['note'] ) ) {
					$line .= ' (' . $row['note'] . ')';
				}

				$lines[] = $line;
			}

			$lines[] = '';
		}

		return implode( "\n", $lines );
	}

	// -------------------------------------------------------------------------
	// Sections
	// -------------------------------------------------------------------------

	/**
	 * FotoGrids plugin state.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_fotogrids(): array {
		$rows = array(
			self::row( __( 'FotoGrids version', 'fotogrids' ), defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : __( 'unknown', 'fotogrids' ) ),
			self::row( __( 'Database schema version', 'fotogrids' ), (string) get_option( 'fotogrids_db_version', '0' ) ),
			self::row( __( 'Capability version', 'fotogrids' ), (string) get_option( 'fotogrids_caps_version', '0' ) ),
			self::row( __( 'Site ID', 'fotogrids' ), (string) get_option( 'fotogrids_site_id', '' ) ),
		);

		$pro_active = defined( 'FOTOGRIDS_PRO_VERSION' );
		$rows[]     = self::row(
			__( 'FotoGrids Pro', 'fotogrids' ),
			$pro_active ? FOTOGRIDS_PRO_VERSION : __( 'Not installed', 'fotogrids' )
		);

		if ( class_exists( '\FotoGrids\License_Manager' ) ) {
			$rows[] = self::row(
				__( 'Pro features active', 'fotogrids' ),
				self::yes_no( \FotoGrids\License_Manager::is_pro_active() )
			);

			$features = \FotoGrids\License_Manager::get_enabled_features();
			$rows[]   = self::row(
				__( 'Enabled Pro features', 'fotogrids' ),
				empty( $features ) ? __( 'None', 'fotogrids' ) : implode( ', ', $features )
			);
		}

		$rows[] = self::row( __( 'Galleries', 'fotogrids' ), self::count_posts( 'fotogrids_gallery' ) );
		$rows[] = self::row( __( 'Albums', 'fotogrids' ), self::count_posts( 'fotogrids_album' ) );
		$rows[] = self::row( __( 'Embeds', 'fotogrids' ), self::count_posts( 'fotogrids_embed' ) );

		if ( class_exists( '\FotoGrids\Tools\Tools_Registry' ) ) {
			$tools = array();

			foreach ( \FotoGrids\Tools\Tools_Registry::get_all() as $id => $entry ) {
				$tools[] = $id . ' (' . $entry['source'] . ')';
			}

			$rows[] = self::row( __( 'Registered tools', 'fotogrids' ), empty( $tools ) ? __( 'None', 'fotogrids' ) : implode( ', ', $tools ) );
		}

		if ( class_exists( '\FotoGrids\Modules\Module_Registry' ) ) {
			$modules = array_keys( \FotoGrids\Modules\Module_Registry::get_all() );
			$rows[]  = self::row( __( 'Registered modules', 'fotogrids' ), empty( $modules ) ? __( 'None', 'fotogrids' ) : implode( ', ', $modules ) );
		}

		$rows[] = self::row( __( 'Debug channels enabled', 'fotogrids' ), self::debug_channel_summary() );

		return self::section( 'fotogrids', __( 'FotoGrids', 'fotogrids' ), $rows );
	}

	/**
	 * Custom tables, with row counts and on-disk size.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_database(): array {
		global $wpdb;

		$rows = array(
			self::row( __( 'MySQL version', 'fotogrids' ), $wpdb->db_version() ),
			self::row( __( 'Table prefix', 'fotogrids' ), $wpdb->prefix ),
			self::row( __( 'Charset', 'fotogrids' ), $wpdb->charset ),
			self::row( __( 'Collation', 'fotogrids' ), $wpdb->collate ),
		);

		foreach ( self::plugin_tables() as $suffix ) {
			$table  = $wpdb->prefix . $suffix;
			$status = $wpdb->get_row(
				$wpdb->prepare( 'SHOW TABLE STATUS LIKE %s', $wpdb->esc_like( $table ) ),
				ARRAY_A
			);

			if ( null === $status ) {
				$rows[] = self::row( $suffix, __( 'Missing', 'fotogrids' ), self::STATUS_ERROR );
				continue;
			}

			$bytes = (int) ( $status['Data_length'] ?? 0 ) + (int) ( $status['Index_length'] ?? 0 );

			$rows[] = self::row(
				$suffix,
				sprintf(
					/* translators: 1: row count, 2: formatted table size. */
					__( '%1$s rows, %2$s', 'fotogrids' ),
					number_format_i18n( self::count_table_rows( $table ) ),
					size_format( $bytes )
				),
				self::STATUS_OK
			);
		}

		return self::section( 'database', __( 'Database', 'fotogrids' ), $rows );
	}

	/**
	 * WordPress environment.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_wordpress(): array {
		$rows = array(
			self::row( __( 'WordPress version', 'fotogrids' ), get_bloginfo( 'version' ) ),
			self::row( __( 'Multisite', 'fotogrids' ), self::yes_no( is_multisite() ) ),
			self::row( __( 'Site URL', 'fotogrids' ), site_url() ),
			self::row( __( 'Home URL', 'fotogrids' ), home_url() ),
			self::row( __( 'Locale', 'fotogrids' ), get_locale() ),
			self::row( __( 'Permalink structure', 'fotogrids' ), get_option( 'permalink_structure' ) ? get_option( 'permalink_structure' ) : __( 'Plain', 'fotogrids' ) ),
			self::row( __( 'WP memory limit', 'fotogrids' ), defined( 'WP_MEMORY_LIMIT' ) ? WP_MEMORY_LIMIT : __( 'not set', 'fotogrids' ) ),
			self::row( __( 'WP max memory limit', 'fotogrids' ), defined( 'WP_MAX_MEMORY_LIMIT' ) ? WP_MAX_MEMORY_LIMIT : __( 'not set', 'fotogrids' ) ),
			self::row( 'WP_DEBUG', self::yes_no( defined( 'WP_DEBUG' ) && WP_DEBUG ) ),
			self::row( 'WP_DEBUG_LOG', self::yes_no( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) ),
			self::row( 'WP_DEBUG_DISPLAY', self::yes_no( ! defined( 'WP_DEBUG_DISPLAY' ) || WP_DEBUG_DISPLAY ) ),
			self::row( 'SCRIPT_DEBUG', self::yes_no( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ),
			self::row( __( 'External object cache', 'fotogrids' ), self::yes_no( wp_using_ext_object_cache() ) ),
			self::row( __( 'WP-Cron disabled', 'fotogrids' ), self::yes_no( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) ),
			self::row( __( 'REST API prefix', 'fotogrids' ), rest_get_url_prefix() ),
		);

		return self::section( 'wp', __( 'WordPress environment', 'fotogrids' ), $rows );
	}

	/**
	 * Server and PHP environment.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_server(): array {
		$memory_limit = self::ini_value( 'memory_limit' );
		$memory_bytes = wp_convert_hr_to_bytes( $memory_limit );

		$rows = array(
			self::row( __( 'PHP version', 'fotogrids' ), PHP_VERSION ),
			self::row( __( 'PHP SAPI', 'fotogrids' ), PHP_SAPI ),
			self::row(
				'memory_limit',
				$memory_limit,
				( $memory_bytes > 0 && $memory_bytes < self::RECOMMENDED_MEMORY_BYTES ) ? self::STATUS_WARN : self::STATUS_OK,
				( $memory_bytes > 0 && $memory_bytes < self::RECOMMENDED_MEMORY_BYTES ) ? __( '128M or more recommended for image processing', 'fotogrids' ) : ''
			),
			self::row( 'max_execution_time', self::ini_value( 'max_execution_time' ) ),
			self::row( 'max_input_vars', self::ini_value( 'max_input_vars' ) ),
			self::row( 'post_max_size', self::ini_value( 'post_max_size' ) ),
			self::row( 'upload_max_filesize', self::ini_value( 'upload_max_filesize' ) ),
			self::row( __( 'Site timezone', 'fotogrids' ), wp_timezone_string() ),
		);

		$image_editor = self::image_library();
		$rows[]       = self::row(
			__( 'Image library', 'fotogrids' ),
			$image_editor,
			__( 'None', 'fotogrids' ) === $image_editor ? self::STATUS_ERROR : self::STATUS_OK,
			__( 'None', 'fotogrids' ) === $image_editor ? __( 'GD or Imagick is required to generate image sizes', 'fotogrids' ) : ''
		);

		$rows[] = self::row( __( 'WebP support', 'fotogrids' ), self::yes_no( wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) );
		$rows[] = self::row( __( 'AVIF support', 'fotogrids' ), self::yes_no( wp_image_editor_supports( array( 'mime_type' => 'image/avif' ) ) ) );

		$extensions = array( 'curl', 'mbstring', 'intl', 'zip', 'dom', 'json', 'openssl' );
		$missing    = array();

		foreach ( $extensions as $extension ) {
			if ( ! extension_loaded( $extension ) ) {
				$missing[] = $extension;
			}
		}

		$rows[] = self::row(
			__( 'PHP extensions', 'fotogrids' ),
			empty( $missing ) ? __( 'All expected extensions present', 'fotogrids' ) : sprintf(
				/* translators: %s: comma-separated extension names. */
				__( 'Missing: %s', 'fotogrids' ),
				implode( ', ', $missing )
			),
			empty( $missing ) ? self::STATUS_OK : self::STATUS_WARN
		);

		$disabled = self::ini_value( 'disable_functions' );
		$rows[]   = self::row( 'disable_functions', '' === $disabled ? __( 'None', 'fotogrids' ) : $disabled );

		$error_log = self::ini_value( 'error_log' );
		$rows[]    = self::row( __( 'PHP error log', 'fotogrids' ), '' === $error_log ? __( 'Not configured', 'fotogrids' ) : $error_log );

		return self::section( 'server', __( 'Server environment', 'fotogrids' ), $rows );
	}

	/**
	 * Media handling and image sizes.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_media(): array {
		$uploads   = wp_get_upload_dir();
		$writable  = empty( $uploads['error'] ) && wp_is_writable( $uploads['basedir'] );
		$intervals = array();

		foreach ( wp_get_registered_image_subsizes() as $name => $size ) {
			$intervals[] = sprintf( '%s (%d×%d)', $name, (int) $size['width'], (int) $size['height'] );
		}

		$rows = array(
			self::row( __( 'Uploads directory', 'fotogrids' ), $uploads['basedir'] ?? '' ),
			self::row(
				__( 'Uploads writable', 'fotogrids' ),
				self::yes_no( $writable ),
				$writable ? self::STATUS_OK : self::STATUS_ERROR,
				$writable ? '' : __( 'FotoGrids cannot generate image sizes while the uploads directory is unwritable', 'fotogrids' )
			),
			self::row( __( 'Max upload size', 'fotogrids' ), size_format( wp_max_upload_size() ) ),
			self::row( __( 'Registered image sizes', 'fotogrids' ), empty( $intervals ) ? __( 'None', 'fotogrids' ) : implode( ', ', $intervals ) ),
		);

		if ( class_exists( '\FotoGrids\Image_Size_Manager' ) ) {
			$custom = \FotoGrids\Image_Size_Manager::get_custom_sizes( true );
			$rows[] = self::row( __( 'FotoGrids custom sizes', 'fotogrids' ), (string) count( $custom ) );
		}

		return self::section( 'media', __( 'Media', 'fotogrids' ), $rows );
	}

	/**
	 * Active theme.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_theme(): array {
		$theme = wp_get_theme();

		$rows = array(
			self::row( __( 'Name', 'fotogrids' ), $theme->get( 'Name' ) ),
			self::row( __( 'Version', 'fotogrids' ), $theme->get( 'Version' ) ),
			self::row( __( 'Author', 'fotogrids' ), wp_strip_all_tags( (string) $theme->get( 'Author' ) ) ),
			self::row( __( 'Block theme', 'fotogrids' ), self::yes_no( wp_is_block_theme() ) ),
		);

		$parent = $theme->parent();

		if ( $parent ) {
			$rows[] = self::row(
				__( 'Parent theme', 'fotogrids' ),
				$parent->get( 'Name' ) . ' ' . $parent->get( 'Version' )
			);
		}

		return self::section( 'theme', __( 'Theme', 'fotogrids' ), $rows );
	}

	/**
	 * Active and must-use plugins, names and versions only.
	 *
	 * @since  1.0.0
	 * @return array<string, mixed>
	 */
	private static function section_plugins(): array {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all      = get_plugins();
		$active   = array();
		$inactive = 0;

		foreach ( $all as $file => $data ) {
			if ( ! is_plugin_active( $file ) ) {
				++$inactive;
				continue;
			}

			// A plugin header is not required to declare a version.
			$active[ (string) ( $data['Name'] ?? $file ) ] = (string) ( $data['Version'] ?? '' );
		}

		ksort( $active, SORT_NATURAL | SORT_FLAG_CASE );

		$rows = array();

		foreach ( $active as $name => $version ) {
			$rows[] = self::row( $name, $version );
		}

		$mu = get_mu_plugins();

		if ( ! empty( $mu ) ) {
			foreach ( $mu as $data ) {
				$rows[] = self::row(
					(string) ( $data['Name'] ?? '' ),
					(string) ( $data['Version'] ?? '' ),
					'',
					__( 'Must-use plugin', 'fotogrids' )
				);
			}
		}

		$rows[] = self::row( __( 'Inactive plugins', 'fotogrids' ), (string) $inactive );

		return self::section(
			'plugins',
			sprintf(
				/* translators: %d: number of active plugins. */
				__( 'Active plugins (%d)', 'fotogrids' ),
				count( $active )
			),
			$rows
		);
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	/**
	 * The custom tables Activator::create_tables() actually creates.
	 *
	 * @since  1.0.0
	 * @return array<int, string> Table name suffixes, without the WP prefix.
	 */
	private static function plugin_tables(): array {
		return array(
			'fotogrids_item_meta',
			'fotogrids_statistics',
			'fotogrids_statistics_daily',
			'fotogrids_gallery_albums',
			'fotogrids_tags',
			'fotogrids_item_metadata',
			'fotogrids_render_cache',
		);
	}

	/**
	 * Counts rows in a plugin table.
	 *
	 * @since  1.0.0
	 * @param  string $table Fully-prefixed table name, built from plugin_tables().
	 * @return int
	 */
	private static function count_table_rows( string $table ): int {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- table name is plugin-owned and never user input; a diagnostic report must not read a cached value.
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$table}`" );
	}

	/**
	 * Counts published and draft posts of a type.
	 *
	 * @since  1.0.0
	 * @param  string $post_type Post type slug.
	 * @return string
	 */
	private static function count_posts( string $post_type ): string {
		if ( ! post_type_exists( $post_type ) ) {
			return __( 'Post type not registered', 'fotogrids' );
		}

		$counts    = (array) wp_count_posts( $post_type );
		$published = (int) ( $counts['publish'] ?? 0 );
		$draft     = (int) ( $counts['draft'] ?? 0 );

		return sprintf(
			/* translators: 1: published count, 2: draft count. */
			__( '%1$d published, %2$d draft', 'fotogrids' ),
			$published,
			$draft
		);
	}

	/**
	 * Summarises which debug channels are on and which a constant controls.
	 *
	 * @since  1.0.0
	 * @return string
	 */
	private static function debug_channel_summary(): string {
		if ( ! class_exists( '\FotoGrids\Debug_Log' ) ) {
			return __( 'Unavailable', 'fotogrids' );
		}

		$enabled = \FotoGrids\Debug_Log::get_enabled_channels();
		$forced  = array();

		foreach ( \FotoGrids\Debug_Log::get_channels() as $channel ) {
			$state = \FotoGrids\Debug_Log::constant_state_for( $channel['slug'] );

			if ( $state['forced'] ) {
				$forced[] = $channel['slug'] . ( $state['value'] ? ' = on' : ' = off' );
			}
		}

		$summary = empty( $enabled ) ? __( 'None', 'fotogrids' ) : implode( ', ', $enabled );

		if ( ! empty( $forced ) ) {
			$summary .= sprintf(
				/* translators: %s: comma-separated channel names with their forced value. */
				__( ' — set by constant: %s', 'fotogrids' ),
				implode( ', ', $forced )
			);
		}

		return $summary;
	}

	/**
	 * Names the active image library.
	 *
	 * @since  1.0.0
	 * @return string
	 */
	private static function image_library(): string {
		$libraries = array();

		if ( extension_loaded( 'gd' ) && function_exists( 'gd_info' ) ) {
			$info        = gd_info();
			$libraries[] = 'GD ' . ( $info['GD Version'] ?? '' );
		}

		if ( extension_loaded( 'imagick' ) && class_exists( '\Imagick' ) ) {
			$libraries[] = 'Imagick ' . ( defined( '\Imagick::IMAGICK_EXTVER' ) ? \Imagick::IMAGICK_EXTVER : '' );
		}

		return empty( $libraries ) ? __( 'None', 'fotogrids' ) : implode( ', ', $libraries );
	}

	/**
	 * Reads a php.ini value as a trimmed string.
	 *
	 * @since  1.0.0
	 * @param  string $key Directive name.
	 * @return string
	 */
	private static function ini_value( string $key ): string {
		$value = ini_get( $key );

		return false === $value ? '' : trim( (string) $value );
	}

	/**
	 * Wraps rows into a section.
	 *
	 * @since  1.0.0
	 * @param  string                          $id    Section id.
	 * @param  string                          $label Section heading.
	 * @param  array<int, array<string, mixed>> $rows  Section rows.
	 * @return array<string, mixed>
	 */
	private static function section( string $id, string $label, array $rows ): array {
		return array(
			'id'    => $id,
			'label' => $label,
			'rows'  => $rows,
		);
	}

	/**
	 * Builds one report row.
	 *
	 * @since  1.0.0
	 * @param  string $label  Row label.
	 * @param  mixed  $value  Row value.
	 * @param  string $status One of 'ok', 'warn', 'error'. Empty for no mark.
	 * @param  string $note   Optional explanation shown beside the value.
	 * @return array<string, mixed>
	 */
	private static function row( string $label, $value, string $status = '', string $note = '' ): array {
		if ( null === $value || false === $value || '' === $value ) {
			$value = '—';
		}

		return array(
			'label'  => $label,
			'value'  => is_scalar( $value ) ? (string) $value : $value,
			'status' => $status,
			'note'   => $note,
		);
	}

	/**
	 * Translates a value into a display string.
	 *
	 * Accepts mixed rather than bool: several WordPress accessors return null
	 * before their subsystem has initialised, and a report must never fatal on
	 * the site it is describing.
	 *
	 * @since  1.0.0
	 * @param  mixed $value Value to describe.
	 * @return string
	 */
	private static function yes_no( $value ): string {
		return $value ? __( 'Yes', 'fotogrids' ) : __( 'No', 'fotogrids' );
	}
}
