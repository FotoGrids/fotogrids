<?php
/**
 * Registry of the options the plugin stores.
 *
 * @package FotoGrids\Options
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Options;

if ( ! defined( 'WPINC' ) ) {
	die;
}

require_once __DIR__ . '/class-abstract-option-declaration.php';

/**
 * Option_Registry
 *
 * Collects every `Abstract_Option_Declaration`, loading the ones under
 * `declarations/`, so each
 * option the plugin stores is declared once, next to the policy that decides
 * what Reset all settings does with it.
 *
 * @package FotoGrids\Options
 * @since   1.3.0
 */
final class Option_Registry {

	/**
	 * Declaration class names, loaded on first use.
	 *
	 * @var array<int, class-string<Abstract_Option_Declaration>>|null
	 */
	private static $declarations = null;

	/**
	 * Every declaration class, sorted by name.
	 *
	 * @since  1.3.0
	 * @return array<int, class-string<Abstract_Option_Declaration>>
	 */
	public static function declarations(): array {
		if ( null !== self::$declarations ) {
			return self::$declarations;
		}

		foreach ( glob( __DIR__ . '/declarations/class-*.php' ) ?: array() as $file ) {
			require_once $file;
		}

		self::$declarations = array_values(
			array_filter(
				get_declared_classes(),
				static function ( string $name ): bool {
					return is_subclass_of( $name, Abstract_Option_Declaration::class )
						&& ! ( new \ReflectionClass( $name ) )->isAbstract();
				}
			)
		);

		sort( self::$declarations );

		return self::$declarations;
	}

	/**
	 * Every declared option with the classes that declare it.
	 *
	 * @since  1.3.0
	 * @return array<string, array<int, string>> Option name => declaring classes.
	 */
	public static function owners(): array {
		$owners = array();

		foreach ( self::declarations() as $class ) {
			foreach ( array_keys( $class::options() ) as $option ) {
				$owners[ $option ][] = $class;
			}
		}

		ksort( $owners );

		return $owners;
	}

	/**
	 * Every declared option with its policy.
	 *
	 * @since  1.3.0
	 * @return array<string, string> Option name => policy.
	 */
	public static function policies(): array {
		$policies = array();

		foreach ( self::declarations() as $class ) {
			$policies += $class::options();
		}

		ksort( $policies );

		return $policies;
	}

	/**
	 * The declared options carrying one policy.
	 *
	 * @since  1.3.0
	 * @param  string $policy `Abstract_Option_Declaration::RESET` or `::KEEP`.
	 * @return array<int, string>
	 */
	public static function keys( string $policy ): array {
		return array_keys(
			array_filter(
				self::policies(),
				static function ( $value ) use ( $policy ) {
					return $value === $policy;
				}
			)
		);
	}

	/**
	 * Run every declaration's `after_reset()`.
	 *
	 * @since  1.3.0
	 * @param  array<int, string> $cleared Options the reset deleted.
	 * @return void
	 */
	public static function run_after_reset( array $cleared ): void {
		foreach ( self::declarations() as $class ) {
			$class::after_reset( $cleared );
		}
	}
}
