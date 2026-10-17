<?php
/**
 * Every option the plugin stores is declared once, with a reset policy.
 *
 * The source scan is what keeps Maintenance > Reset all settings exhaustive: an
 * option written anywhere in src/ without a declaration under
 * includes/options/declarations/ fails here.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Options\Abstract_Option_Declaration;
use FotoGrids\Options\Declarations\Retired;
use FotoGrids\Options\Option_Registry;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/options/class-option-registry.php';

final class OptionRegistryTest extends TestCase {

	/**
	 * A call to one of the option functions, capturing its first argument.
	 */
	private const OPTION_CALL = '/\b(?:get|update|add|delete)_(?:site_|network_)?option\(\s*((?:[^,()\'"]|\'[^\']*\'|"[^"]*")+?)\s*[,)]/';

	private const NAME = 'fotogrids_[a-z0-9_]+';

	/**
	 * Lists that feed an option call made through a variable.
	 */
	private const NAME_SOURCES = array(
		'/\bsave_bool\(\s*([\'"][^\'"]+[\'"])/',
		'/\$(?:boolean_settings|string_settings|option_keys|map)\s*=\s*array\((.*?)\);/s',
	);

	/**
	 * Option calls made through a variable, each fed by a list in NAME_SOURCES
	 * or by the registry itself.
	 */
	private const DYNAMIC_CALLS = array(
		'includes/class-admin-init.php'                      => array( 'setting' ),
		'includes/rest/admin/admin-data.php'                 => array( 'option_key' ),
		'includes/rest/maintenance/maintenance-data.php'     => array( 'option_key' ),
		'includes/settings/class-plugin-settings-store.php'  => array( 'option' ),
		'includes/tools/import-export/class-import-export-data.php' => array( 'option_key' ),
	);

	public function test_every_option_is_declared_exactly_once(): void {
		$duplicates = array_filter(
			Option_Registry::owners(),
			static function ( array $classes ): bool {
				return count( $classes ) > 1;
			}
		);

		$this->assertSame( array(), $duplicates );
	}

	public function test_every_policy_is_reset_or_keep(): void {
		$invalid = array_diff(
			Option_Registry::policies(),
			array( Abstract_Option_Declaration::RESET, Abstract_Option_Declaration::KEEP )
		);

		$this->assertSame( array(), $invalid );
	}

	public function test_every_option_the_source_stores_is_declared(): void {
		$undeclared = array_diff( array_keys( self::stored_options() ), array_keys( Option_Registry::policies() ) );

		$this->assertSame( array(), array_values( $undeclared ), 'Declare these under includes/options/declarations/.' );
	}

	public function test_every_declared_option_is_still_stored_by_the_source(): void {
		$declared = array_diff( array_keys( Option_Registry::policies() ), array_keys( Retired::options() ) );
		$stale    = array_diff( $declared, array_keys( self::stored_options() ) );

		$this->assertSame( array(), array_values( $stale ), 'Nothing stores these any more: move them to Retired.' );
	}

	public function test_the_source_scan_reaches_every_way_an_option_is_named(): void {
		$found = self::stored_options();

		$this->assertArrayHasKey( 'fotogrids_version', $found, 'string literal' );
		$this->assertArrayHasKey( 'fotogrids_watermark_config_hash', $found, 'class constant' );
		$this->assertArrayHasKey( 'fotogrids_custom_sizes', $found, 'private class constant' );
		$this->assertArrayHasKey( 'fotogrids_allow_news_updates', $found, 'Plugin_Settings_Store::save_bool()' );
		$this->assertArrayHasKey( 'fotogrids_user_persona', $found, 'AJAX setting allowlist' );
		$this->assertGreaterThan( 30, count( $found ) );
	}

	public function test_every_option_reference_resolves(): void {
		self::stored_options( $unresolved );

		$this->assertSame( array(), $unresolved );
	}

	/**
	 * Every option name the plugin source reads or writes.
	 *
	 * @param array<int, string>|null $unresolved Set to the option calls whose name the scan could not resolve.
	 * @return array<string, string> Option name => first file naming it.
	 */
	private static function stored_options( ?array &$unresolved = null ): array {
		$files      = self::php_files();
		$constants  = array();
		$class_file = array();

		foreach ( $files as $file => $source ) {
			if ( preg_match_all( '/\bconst\s+([A-Z0-9_]+)\s*=\s*[\'"](' . self::NAME . ')[\'"]/', $source, $m, PREG_SET_ORDER ) ) {
				foreach ( $m as $match ) {
					$constants[ $file ][ $match[1] ] = $match[2];
				}
			}
			if ( preg_match_all( '/^\s*(?:final\s+|abstract\s+)?class\s+([A-Za-z0-9_]+)/m', $source, $m ) ) {
				foreach ( $m[1] as $class ) {
					$class_file[ $class ][] = $file;
				}
			}
		}

		$found      = array();
		$unresolved = array();
		$add        = static function ( string $name, string $file ) use ( &$found ): void {
			$found[ $name ] = $found[ $name ] ?? $file;
		};

		foreach ( $files as $file => $source ) {
			foreach ( self::NAME_SOURCES as $pattern ) {
				if ( preg_match_all( $pattern, $source, $m ) ) {
					foreach ( $m[1] as $list ) {
						preg_match_all( '/[\'"](' . self::NAME . ')[\'"]/', $list, $names );
						foreach ( $names[1] as $name ) {
							$add( $name, $file );
						}
					}
				}
			}

			if ( ! preg_match_all( self::OPTION_CALL, $source, $calls, PREG_SET_ORDER ) ) {
				continue;
			}

			foreach ( $calls as $call ) {
				$argument = $call[1];

				if ( preg_match( '/^[\'"](' . self::NAME . ')[\'"]$/', $argument, $m ) ) {
					$add( $m[1], $file );
					continue;
				}

				if ( preg_match( '/^\$([A-Za-z0-9_]+)$/', $argument, $m ) ) {
					if ( ! in_array( $m[1], self::DYNAMIC_CALLS[ $file ] ?? array(), true ) ) {
						$unresolved[] = $file . ': $' . $m[1];
					}
					continue;
				}

				if ( preg_match( '/^(self|static|[A-Za-z0-9_\\\\]+)::([A-Z0-9_]+)$/', $argument, $m ) ) {
					$owners = in_array( $m[1], array( 'self', 'static' ), true )
						? array( $file )
						: ( $class_file[ substr( (string) strrchr( '\\' . $m[1], '\\' ), 1 ) ] ?? array() );
					$values = array_unique(
						array_filter(
							array_map(
								static function ( string $owner ) use ( $constants, $m ) {
									return $constants[ $owner ][ $m[2] ] ?? null;
								},
								$owners
							)
						)
					);

					if ( 1 === count( $values ) ) {
						$add( reset( $values ), $file );
					} else {
						$unresolved[] = $file . ': ' . $argument;
					}
					continue;
				}

				if ( false !== stripos( $argument, 'fotogrids' ) ) {
					$unresolved[] = $file . ': ' . $argument;
				}
			}
		}

		ksort( $found );

		return $found;
	}

	/**
	 * The plugin's PHP sources without comments, leaving out the vendored SDK.
	 *
	 * @return array<string, string> Relative path => code.
	 */
	private static function php_files(): array {
		$root  = FOTOGRIDS_PLUGIN_DIR;
		$files = array();
		$walk  = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );

		foreach ( $walk as $entry ) {
			$path = substr( $entry->getPathname(), strlen( $root ) );

			if ( 'php' !== $entry->getExtension() || 0 === strpos( $path, 'freemius/' ) ) {
				continue;
			}

			$code = '';
			foreach ( token_get_all( (string) file_get_contents( $entry->getPathname() ) ) as $token ) {
				if ( is_array( $token ) && in_array( $token[0], array( T_COMMENT, T_DOC_COMMENT ), true ) ) {
					continue;
				}
				$code .= is_array( $token ) ? $token[1] : $token;
			}

			$files[ $path ] = $code;
		}

		ksort( $files );

		return $files;
	}
}
