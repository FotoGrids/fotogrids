<?php
/**
 * Runs each upgrade migration once per site.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Finds the migrations in `includes/migrations/`, runs those not yet recorded
 * in ID order, and records each one as it completes.
 *
 * @since 1.3.0
 */
final class Migration_Runner {

	/**
	 * Option holding the IDs of the migrations that have run.
	 *
	 * @since 1.3.0
	 */
	const RECORD_OPTION = 'fotogrids_completed_migrations';

	/**
	 * Option held while a request runs migrations; its value is the time it was taken.
	 *
	 * @since 1.3.0
	 */
	const LOCK_OPTION = 'fotogrids_migration_lock';

	/**
	 * Seconds after which a lock left by a request that did not finish is taken over.
	 *
	 * @since 1.3.0
	 */
	const LOCK_TIMEOUT = 600;

	/**
	 * Run every pending migration.
	 *
	 * Stops at a migration that throws; it and the ones after it run on a later call.
	 *
	 * @since  1.3.0
	 * @param  array<int, class-string<Migration>>|null $migrations Migrations to consider; defaults to the ones in `includes/migrations/`.
	 * @return void
	 */
	public static function run_pending( ?array $migrations = null ): void {
		$migrations = $migrations ?? self::discover();

		if ( array() === self::pending( $migrations ) || ! self::lock() ) {
			return;
		}

		try {
			wp_cache_delete( self::RECORD_OPTION, 'options' );
			wp_cache_delete( 'alloptions', 'options' );
			$completed = self::completed();
			foreach ( self::pending( $migrations ) as $migration ) {
				try {
					$migration::run();
				} catch ( \Throwable $e ) {
					break;
				}

				$completed[] = $migration::id();
				update_option( self::RECORD_OPTION, $completed, true );
			}
		} finally {
			self::unlock();
		}
	}

	/**
	 * The migrations defined in `includes/migrations/`.
	 *
	 * `class-<slug>.php` holds `FotoGrids\Migrations\<Slug_In_Title_Case>`; files
	 * whose class does not implement `Migration` are skipped.
	 *
	 * @since  1.3.0
	 * @return array<int, class-string<Migration>>
	 */
	public static function discover(): array {
		$migrations = array();

		foreach ( glob( __DIR__ . '/class-*.php' ) ?: array() as $file ) {
			$slug  = substr( basename( $file, '.php' ), strlen( 'class-' ) );
			$class = __NAMESPACE__ . '\\' . str_replace( '-', '_', ucwords( $slug, '-' ) );

			if ( class_exists( $class ) && is_subclass_of( $class, Migration::class ) ) {
				$migrations[] = $class;
			}
		}

		return $migrations;
	}

	/**
	 * The IDs of the migrations that have run.
	 *
	 * @since  1.3.0
	 * @return array<int, string>
	 */
	public static function completed(): array {
		$completed = get_option( self::RECORD_OPTION, array() );

		return is_array( $completed ) ? array_values( array_filter( $completed, 'is_string' ) ) : array();
	}

	/**
	 * The migrations not yet recorded, in ID order.
	 *
	 * @since  1.3.0
	 * @param  array<int, class-string<Migration>> $migrations Migrations to consider.
	 * @return array<int, class-string<Migration>>
	 */
	private static function pending( array $migrations ): array {
		$completed = array_flip( self::completed() );

		$pending = array_values(
			array_filter(
				$migrations,
				static function ( string $migration ) use ( $completed ): bool {
					return ! isset( $completed[ $migration::id() ] );
				}
			)
		);

		usort(
			$pending,
			static function ( string $a, string $b ): int {
				return strcmp( $a::id(), $b::id() );
			}
		);

		return $pending;
	}

	/**
	 * Take the lock, or take over one older than `LOCK_TIMEOUT`.
	 *
	 * @since  1.3.0
	 * @return bool Whether this request holds the lock.
	 */
	private static function lock(): bool {
		global $wpdb;

		$now = time();

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- An atomic insert is the lock; the options API cannot take one.
		$taken = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$wpdb->options} ( option_name, option_value, autoload ) VALUES ( %s, %s, 'off' )",
				self::LOCK_OPTION,
				(string) $now
			)
		);

		if ( ! $taken ) {
			$taken = $wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND CAST( option_value AS UNSIGNED ) < %d",
					(string) $now,
					self::LOCK_OPTION,
					$now - self::LOCK_TIMEOUT
				)
			);
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return (bool) $taken;
	}

	/**
	 * Release the lock.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	private static function unlock(): void {
		delete_option( self::LOCK_OPTION );
	}
}
