<?php
/**
 * Runs each upgrade migration once per site.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

use FotoGrids\Diagnostics\Error_Store;

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
	 * Stops at a migration that throws and adds it to the error log; it and the
	 * ones after it run on a later call.
	 * Runs nothing while the record holds a value that is not a list.
	 *
	 * @since  1.3.0
	 * @param  array<int, class-string<Migration>>|null $migrations Migrations to consider; defaults to the ones in `includes/migrations/`.
	 * @return void
	 */
	public static function run_pending( ?array $migrations = null ): void {
		$migrations = $migrations ?? self::discover();

		if ( array() === self::pending( $migrations ) ) {
			return;
		}

		$lock = self::lock();
		if ( null === $lock ) {
			return;
		}

		try {
			wp_cache_delete( self::RECORD_OPTION, 'options' );
			wp_cache_delete( 'alloptions', 'options' );
			wp_cache_delete( 'notoptions', 'options' );
			$completed = self::stored_record();
			foreach ( null === $completed ? array() : self::pending( $migrations, $completed ) as $migration ) {
				try {
					$migration::run();
				} catch ( \Throwable $e ) {
					self::record_failure( $migration::id(), $e );
					break;
				}

				$completed[] = $migration::id();
				update_option( self::RECORD_OPTION, $completed, true );
			}
		} finally {
			self::unlock( $lock );
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
		return self::record() ?? array();
	}

	/**
	 * The stored record.
	 *
	 * @since  1.3.0
	 * @return array<int, string>|null The IDs, an empty list when there is no record, or null when the stored value is not a list.
	 */
	private static function record(): ?array {
		return self::as_record( get_option( self::RECORD_OPTION, array() ) );
	}

	/**
	 * The record as the database holds it, whatever an object cache remembers.
	 *
	 * @since  1.3.0
	 * @return array<int, string>|null As `record()`.
	 */
	private static function stored_record(): ?array {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- The cache is what this read must not trust.
		$value = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", self::RECORD_OPTION ) );

		return self::as_record( null === $value ? array() : maybe_unserialize( $value ) );
	}

	/**
	 * A stored record value as a list of IDs.
	 *
	 * @since  1.3.0
	 * @param  mixed $record Stored value.
	 * @return array<int, string>|null The IDs, or null when the value is not a list.
	 */
	private static function as_record( $record ): ?array {
		return is_array( $record ) ? array_values( array_filter( $record, 'is_string' ) ) : null;
	}

	/**
	 * The migrations not yet recorded, in ID order.
	 *
	 * @since  1.3.0
	 * @param  array<int, class-string<Migration>> $migrations Migrations to consider.
	 * @param  array<int, string>|null             $record     Recorded IDs; defaults to the stored record.
	 * @return array<int, class-string<Migration>>
	 */
	private static function pending( array $migrations, ?array $record = null ): array {
		$record = $record ?? self::record();
		if ( null === $record ) {
			return array();
		}

		$completed = array_flip( $record );

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
	 * Add a failed migration to the error log on the System Info screen.
	 *
	 * The log counts a repeat of the same failure instead of adding a row.
	 *
	 * @since  1.3.0
	 * @param  string     $id    Migration ID.
	 * @param  \Throwable $error What the migration threw.
	 * @return void
	 */
	private static function record_failure( string $id, \Throwable $error ): void {
		Error_Store::record(
			array(
				'type'    => 'php',
				'level'   => 'error',
				'message' => sprintf( 'Migration %s failed and will be retried: %s', $id, $error->getMessage() ),
				'file'    => Error_Store::relative_path( $error->getFile() ),
				'line'    => $error->getLine(),
				'context' => array( 'migration' => $id ),
			)
		);
	}

	/**
	 * Take the lock, or take over one older than `LOCK_TIMEOUT`.
	 *
	 * @since  1.3.0
	 * @return string|null The lock's value while this request holds it, or null.
	 */
	private static function lock(): ?string {
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

		return $taken ? (string) $now : null;
	}

	/**
	 * Release the lock, unless another request has taken it over.
	 *
	 * @since  1.3.0
	 * @param  string $lock The value `lock()` returned.
	 * @return void
	 */
	private static function unlock( string $lock ): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- The lock is written past the cache, so it is read the same way.
		$held = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", self::LOCK_OPTION ) );

		if ( $lock === $held ) {
			delete_option( self::LOCK_OPTION );
		}
	}
}
