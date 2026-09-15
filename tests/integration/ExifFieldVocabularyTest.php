<?php
/**
 * EXIF field vocabulary guard.
 *
 * Asserts that every surface naming an EXIF field agrees with `Exif_Fields`:
 * the formatters it points at exist, the gallery settings row offers the same
 * keys, the collection defaults carry the setting the extractor reads, and no
 * file still references a key the registry replaced.
 *
 * WordPress-independent: the registry is loaded with the handful of WordPress
 * functions it touches stubbed, and the other surfaces are read as text
 * (matching the isolated suite).
 *
 * @package FotoGrids\Tests
 * @since   1.2.0
 */

declare(strict_types=1);

$plugin_root = dirname( __DIR__, 2 );

if ( ! defined( 'WPINC' ) ) {
	define( 'WPINC', 'wp-includes' );
}

if ( ! function_exists( '__' ) ) {
	/**
	 * Translation stub.
	 *
	 * @param  string $text   Text to return.
	 * @param  string $domain Text domain, unused.
	 * @return string
	 */
	function __( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
		unset( $domain );
		return $text;
	}
}

require_once $plugin_root . '/src/includes/exif/class-exif-fields.php';
require_once $plugin_root . '/src/includes/exif/class-exif-formatter.php';

$failures = array();

$definitions = \FotoGrids\Exif\Exif_Fields::definitions();
$keys        = \FotoGrids\Exif\Exif_Fields::keys();

if ( empty( $definitions ) ) {
	$failures[] = 'Exif_Fields::definitions() is empty.';
}

// 1. Every definition is complete, groups are declared, formatters exist.
foreach ( $definitions as $key => $definition ) {
	foreach ( array( 'label', 'group', 'tags', 'format', 'default_on' ) as $required ) {
		if ( ! array_key_exists( $required, $definition ) ) {
			$failures[] = sprintf( 'Field "%s" is missing "%s".', $key, $required );
		}
	}

	if ( isset( $definition['group'] ) && ! in_array( $definition['group'], \FotoGrids\Exif\Exif_Fields::GROUPS, true ) ) {
		$failures[] = sprintf( 'Field "%s" declares group "%s", which is not in Exif_Fields::GROUPS.', $key, $definition['group'] );
	}

	if ( empty( $definition['tags'] ) || ! is_array( $definition['tags'] ) ) {
		$failures[] = sprintf( 'Field "%s" names no EXIF tags to read.', $key );
	}

	if ( ! empty( $definition['format'] ) && ! method_exists( '\FotoGrids\Exif\Exif_Formatter', $definition['format'] ) ) {
		$failures[] = sprintf( 'Field "%s" points at formatter "%s", which Exif_Formatter does not define.', $key, $definition['format'] );
	}

	if ( isset( $definition['label'] ) && '' === trim( (string) $definition['label'] ) ) {
		$failures[] = sprintf( 'Field "%s" has an empty label.', $key );
	}
}

// 2. The default selection names real fields.
foreach ( \FotoGrids\Exif\Exif_Fields::DEFAULT_FIELDS as $default_key ) {
	if ( ! in_array( $default_key, $keys, true ) ) {
		$failures[] = sprintf( 'Exif_Fields::DEFAULT_FIELDS names "%s", which is not a registered field.', $default_key );
	}
}

// 3. The gallery settings row offers the registry's keys and nothing else.
$exif_json_path = $plugin_root . '/src/assets/admin/plain/collection-settings/exif.json';
$exif_json      = json_decode( (string) file_get_contents( $exif_json_path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local test fixture, not a remote URL.

if ( ! is_array( $exif_json ) ) {
	$failures[] = 'exif.json is not valid JSON.';
} else {
	$field_setting = null;
	foreach ( $exif_json['settings'] ?? array() as $setting ) {
		if ( 'exif_fields' === ( $setting['key'] ?? '' ) ) {
			$field_setting = $setting;
			break;
		}
	}

	if ( null === $field_setting ) {
		$failures[] = 'exif.json has no "exif_fields" setting.';
	} else {
		if ( '/wp-json/fotogrids/v1/admin/exif-fields' !== ( $field_setting['api_endpoint'] ?? '' ) ) {
			$failures[] = 'exif.json "exif_fields" does not point at /admin/exif-fields.';
		}

		if ( 'fields' !== ( $field_setting['options_key'] ?? '' ) ) {
			$failures[] = 'exif.json "exif_fields" does not read the "fields" key of the response.';
		}

		foreach ( $field_setting['fallback_options'] ?? array() as $option ) {
			if ( ! in_array( $option['value'] ?? '', $keys, true ) ) {
				$failures[] = sprintf( 'exif.json fallback option "%s" is not a registered field.', $option['value'] ?? '?' );
			}
		}

		foreach ( $field_setting['default'] ?? array() as $default_key ) {
			if ( ! in_array( $default_key, $keys, true ) ) {
				$failures[] = sprintf( 'exif.json default "%s" is not a registered field.', $default_key );
			}
		}

		if ( ( $field_setting['default'] ?? array() ) !== \FotoGrids\Exif\Exif_Fields::DEFAULT_FIELDS ) {
			$failures[] = 'exif.json "exif_fields" default does not match Exif_Fields::DEFAULT_FIELDS.';
		}
	}
}

// 4. The collection defaults carry the setting the extractor reads.
$defaults_src = (string) file_get_contents( $plugin_root . '/src/includes/class-collection-defaults.php' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local source file, not a remote URL.

if ( false === strpos( $defaults_src, "'exif_fields'" ) ) {
	$failures[] = 'class-collection-defaults.php does not define an "exif_fields" default.';
}

// 5. No file still names a key this vocabulary replaced.
$retired = array(
	'exif_camera'          => 'replaced by the exif_fields list',
	'exif_aperture'        => 'replaced by the exif_fields list',
	'exif_shutter_speed'   => 'replaced by the exif_fields list',
	'exif_iso'             => 'replaced by the exif_fields list',
	'lightbox_exif_fields' => 'never defined as a setting; replaced by exif_fields',
	'EXIF_LABELS'          => 'replaced by the data-fg-lb-exif-labels attribute',
);

$scan_roots = array( $plugin_root . '/src/includes', $plugin_root . '/src/public', $plugin_root . '/src/assets' );

foreach ( $scan_roots as $root ) {
	$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );

	foreach ( $iterator as $file ) {
		if ( ! $file->isFile() ) {
			continue;
		}

		$path = $file->getPathname();

		if ( false !== strpos( $path, '/node_modules/' ) || false !== strpos( $path, '/dist/' ) ) {
			continue;
		}

		if ( ! in_array( $file->getExtension(), array( 'php', 'js', 'jsx', 'json' ), true ) ) {
			continue;
		}

		$contents = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local source file, not a remote URL.

		foreach ( $retired as $needle => $reason ) {
			if ( false !== strpos( $contents, $needle ) ) {
				$failures[] = sprintf(
					'%s still references "%s" (%s).',
					str_replace( $plugin_root . '/', '', $path ),
					$needle,
					$reason
				);
			}
		}
	}
}

if ( ! empty( $failures ) ) {
	echo "FAIL: EXIF field vocabulary is inconsistent.\n";
	foreach ( $failures as $failure ) {
		echo ' - ' . $failure . "\n";
	}
	exit( 1 );
}

printf( "OK: EXIF field vocabulary consistent across %d fields.\n", count( $keys ) );
exit( 0 );
