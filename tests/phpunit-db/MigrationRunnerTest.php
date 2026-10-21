<?php
/**
 * Upgrade migrations run once each, in order, and stay pending until they succeed.
 *
 * @package FotoGrids
 */

use FotoGrids\Activator;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Galleries\Item_Meta;
use FotoGrids\Migrations\Collection_Defaults_Split;
use FotoGrids\Migrations\Featured_Gallery_Repair;
use FotoGrids\Migrations\Item_Meta_Consolidation;
use FotoGrids\Migrations\List_Setting_Repair;
use FotoGrids\Migrations\Migration;
use FotoGrids\Migrations\Migration_Runner;
use FotoGrids\Post_Types;

/** Records the order fixture migrations ran in. */
final class Fg_Test_Migration_Log {

	/** @var array<int, string> */
	public static array $ran = array();

	/** @var array<string, bool> IDs that throw when run. */
	public static array $failing = array();

	/** @var callable|null Called as each one runs, standing in for another request. */
	public static $during = null;

	public static function record( string $id ): void {
		self::$ran[] = $id;
		if ( self::$during ) {
			( self::$during )( $id );
		}
		if ( ! empty( self::$failing[ $id ] ) ) {
			throw new RuntimeException( "$id failed" );
		}
	}
}

final class Fg_Test_Migration_First implements Migration {
	public static function id(): string {
		return '9001-first';
	}
	public static function run(): void {
		Fg_Test_Migration_Log::record( self::id() );
	}
}

final class Fg_Test_Migration_Second implements Migration {
	public static function id(): string {
		return '9002-second';
	}
	public static function run(): void {
		Fg_Test_Migration_Log::record( self::id() );
	}
}

final class Fg_Test_Migration_Third implements Migration {
	public static function id(): string {
		return '9003-third';
	}
	public static function run(): void {
		Fg_Test_Migration_Log::record( self::id() );
	}
}

class MigrationRunnerTest extends WP_UnitTestCase {

	private const REAL = array(
		'0001-item-meta-consolidation',
		'0002-collection-defaults-split',
		'0003-list-setting-repair',
		'0004-featured-gallery-repair',
	);

	/** @var array<int, string> */
	private array $recorded_before;

	public function set_up(): void {
		parent::set_up();
		wp_cache_flush();
		Fg_Test_Migration_Log::$ran     = array();
		Fg_Test_Migration_Log::$failing = array();
		Fg_Test_Migration_Log::$during  = null;
		$this->recorded_before          = Migration_Runner::completed();
	}

	private function record( array $ids ): void {
		update_option( Migration_Runner::RECORD_OPTION, $ids, true );
	}

	private function lock_row(): ?string {
		global $wpdb;

		return $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", Migration_Runner::LOCK_OPTION ) );
	}

	private function plant_lock( int $taken_at ): void {
		global $wpdb;

		$wpdb->insert(
			$wpdb->options,
			array(
				'option_name'  => Migration_Runner::LOCK_OPTION,
				'option_value' => (string) $taken_at,
				'autoload'     => 'off',
			)
		);
	}

	/** The record as the database holds it, past any cache. */
	private function stored_record() {
		global $wpdb;

		return maybe_unserialize( $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", Migration_Runner::RECORD_OPTION ) ) );
	}

	/** Whether the four real migrations left their marks untouched: a stale pick and a legacy defaults row. */
	private function plant_work_for_every_real_migration(): array {
		global $wpdb;

		$album   = self::factory()->post->create( array( 'post_type' => Post_Types::ALBUM ) );
		$gallery = self::factory()->post->create( array( 'post_type' => Post_Types::GALLERY ) );
		update_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, $gallery );
		update_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', 'caption' );
		$wpdb->replace(
			$wpdb->options,
			array(
				'option_name'  => Collection_Defaults_Split::LEGACY_OPTION,
				'option_value' => maybe_serialize( array( 'layout' => 'masonry' ) ),
				'autoload'     => 'off',
			)
		);
		wp_cache_flush();

		return array( $album, $gallery );
	}

	private function legacy_row_exists(): bool {
		global $wpdb;

		return '0' !== $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name = %s", Collection_Defaults_Split::LEGACY_OPTION ) );
	}

	public function test_activation_runs_every_migration_in_order(): void {
		global $wpdb;

		delete_option( Migration_Runner::RECORD_OPTION );

		try {
			Activator::activate();

			$this->assertSame( self::REAL, Migration_Runner::completed() );
		} finally {
			// The schema step commits the test transaction; leave the record as it was.
			$this->record( $this->recorded_before );
			$wpdb->query( 'COMMIT' );
		}
	}

	public function test_a_site_upgraded_from_1_2_runs_every_migration_once_in_order(): void {
		global $wpdb;

		delete_option( Migration_Runner::RECORD_OPTION );
		update_option( 'fotogrids_db_version', '1.6' );

		try {
			Activator::maybe_upgrade();

			$this->assertSame( self::REAL, Migration_Runner::completed() );
			$this->assertSame( '1.7', get_option( 'fotogrids_db_version' ) );
		} finally {
			// The schema step commits the test transaction; leave the record as it was.
			$this->record( $this->recorded_before );
			update_option( 'fotogrids_db_version', '1.7' );
			$wpdb->query( 'COMMIT' );
		}
	}

	public function test_a_recorded_migration_does_not_run_on_the_next_load(): void {
		$this->record( array() );
		$migrations = array( Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class );

		Migration_Runner::run_pending( $migrations );
		Migration_Runner::run_pending( $migrations );

		$this->assertSame( array( '9001-first', '9002-second' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first', '9002-second' ), Migration_Runner::completed() );
	}

	public function test_a_schema_upgrade_and_a_table_reinstall_run_no_migration_again(): void {
		global $wpdb;

		[ $album, $gallery ] = $this->plant_work_for_every_real_migration();
		update_option( 'fotogrids_db_version', '1.6' );

		try {
			Activator::maybe_upgrade();
			\FotoGrids\REST\Maintenance\Maintenance_Data::reinstall_tables( new WP_REST_Request( 'POST' ) );

			$this->assertSame( (string) $gallery, (string) get_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, true ) );
			$this->assertSame( 'caption', get_post_meta( $gallery, 'fotogrids_lightbox_info_blocks', true ) );
			$this->assertTrue( $this->legacy_row_exists() );
			$this->assertSame( $this->recorded_before, Migration_Runner::completed() );
		} finally {
			// The schema step commits the test transaction; clean up by hand.
			wp_delete_post( $album, true );
			wp_delete_post( $gallery, true );
			delete_option( Collection_Defaults_Split::LEGACY_OPTION );
			update_option( 'fotogrids_db_version', '1.7' );
			$wpdb->query( 'COMMIT' );
		}
	}

	public function test_reactivation_runs_no_migration_again(): void {
		global $wpdb;

		[ $album, $gallery ] = $this->plant_work_for_every_real_migration();

		try {
			Activator::activate();

			$this->assertSame( (string) $gallery, (string) get_post_meta( $album, Post_Types::FEATURED_GALLERY_META_KEY, true ) );
			$this->assertTrue( $this->legacy_row_exists() );
		} finally {
			// The schema step commits the test transaction; clean up by hand.
			wp_delete_post( $album, true );
			wp_delete_post( $gallery, true );
			delete_option( Collection_Defaults_Split::LEGACY_OPTION );
			$wpdb->query( 'COMMIT' );
		}
	}

	public function test_a_migration_added_later_runs_without_a_schema_change(): void {
		$this->record( array( '9001-first' ) );
		$version = get_option( 'fotogrids_db_version' );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class ) );

		$this->assertSame( array( '9002-second' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( $version, get_option( 'fotogrids_db_version' ) );
	}

	public function test_migrations_run_in_id_order_whatever_order_they_are_found_in(): void {
		$this->record( array() );

		Migration_Runner::run_pending( array( Fg_Test_Migration_Third::class, Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class ) );

		$this->assertSame( array( '9001-first', '9002-second', '9003-third' ), Fg_Test_Migration_Log::$ran );
	}

	public function test_a_failing_migration_stays_pending_and_holds_back_the_rest(): void {
		$this->record( array() );
		$migrations                                    = array( Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class, Fg_Test_Migration_Third::class );
		Fg_Test_Migration_Log::$failing['9002-second'] = true;

		Migration_Runner::run_pending( $migrations );

		$this->assertSame( array( '9001-first', '9002-second' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first' ), Migration_Runner::completed() );
		$this->assertNull( $this->lock_row(), 'the lock was not released' );

		Fg_Test_Migration_Log::$ran     = array();
		Fg_Test_Migration_Log::$failing = array();
		Migration_Runner::run_pending( $migrations );

		$this->assertSame( array( '9002-second', '9003-third' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first', '9002-second', '9003-third' ), Migration_Runner::completed() );
	}

	public function test_a_failing_migration_is_added_to_the_error_log_and_counted_when_it_fails_again(): void {
		$buffer = new ReflectionProperty( \FotoGrids\Diagnostics\Error_Store::class, 'buffer' );
		$buffer->setAccessible( true );
		$buffer->setValue( null, array() );
		$this->record( array() );
		Fg_Test_Migration_Log::$failing['9002-second'] = true;

		Migration_Runner::run_pending( array( Fg_Test_Migration_Second::class ) );
		Migration_Runner::run_pending( array( Fg_Test_Migration_Second::class ) );

		$entries = array_values( $buffer->getValue() );
		$buffer->setValue( null, array() );

		$this->assertCount( 1, $entries );
		$this->assertSame( 'Migration 9002-second failed and will be retried: 9002-second failed', $entries[0]['message'] );
		$this->assertSame( 'error', $entries[0]['level'] );
		$this->assertSame( array( 'migration' => '9002-second' ), $entries[0]['context'] );
		$this->assertSame( 2, $entries[0]['times'] );
	}

	public function test_a_held_lock_stops_a_second_run(): void {
		global $wpdb;

		$this->record( array() );
		$wpdb->insert(
			$wpdb->options,
			array(
				'option_name'  => Migration_Runner::LOCK_OPTION,
				'option_value' => (string) time(),
				'autoload'     => 'off',
			)
		);

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array(), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array(), Migration_Runner::completed() );
		$this->assertNotNull( $this->lock_row(), 'another request\'s lock was released' );
	}

	public function test_a_lock_left_behind_is_taken_over_after_ten_minutes(): void {
		global $wpdb;

		$this->record( array() );
		$wpdb->insert(
			$wpdb->options,
			array(
				'option_name'  => Migration_Runner::LOCK_OPTION,
				'option_value' => (string) ( time() - Migration_Runner::LOCK_TIMEOUT - 60 ),
				'autoload'     => 'off',
			)
		);

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array( '9001-first' ), Fg_Test_Migration_Log::$ran );
		$this->assertNull( $this->lock_row() );
	}

	public function test_a_cache_that_remembers_the_record_as_missing_runs_nothing_again(): void {
		$this->record( array( '9001-first' ) );
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_set( 'notoptions', array( Migration_Runner::RECORD_OPTION => true ), 'options' );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array(), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first' ), $this->stored_record() );
		$this->assertNull( $this->lock_row() );
	}

	public function test_a_cache_that_remembers_a_record_not_autoloaded_as_missing_runs_nothing_again(): void {
		global $wpdb;

		$this->record( array( '9001-first' ) );
		$wpdb->update( $wpdb->options, array( 'autoload' => 'off' ), array( 'option_name' => Migration_Runner::RECORD_OPTION ) );
		wp_cache_flush();
		wp_cache_set( 'notoptions', array( Migration_Runner::RECORD_OPTION => true ), 'options' );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array(), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first' ), $this->stored_record() );
	}

	public function test_a_cache_holding_an_older_record_reruns_nothing_and_records_the_new_one(): void {
		$this->record( array( '9001-first' ) );
		$alloptions                                 = wp_load_alloptions();
		$alloptions[ Migration_Runner::RECORD_OPTION ] = maybe_serialize( array() );
		wp_cache_set( 'alloptions', $alloptions, 'options' );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class ) );

		$this->assertSame( array( '9002-second' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first', '9002-second' ), $this->stored_record() );
	}

	public function test_a_request_that_died_mid_migration_is_resumed_once_its_lock_expires(): void {
		$migrations = array( Fg_Test_Migration_First::class, Fg_Test_Migration_Second::class, Fg_Test_Migration_Third::class );
		$this->record( array( '9001-first' ) );
		$this->plant_lock( time() - 60 );

		Migration_Runner::run_pending( $migrations );

		$this->assertSame( array(), Fg_Test_Migration_Log::$ran, 'ran inside the ten minutes' );

		global $wpdb;
		$wpdb->update( $wpdb->options, array( 'option_value' => (string) ( time() - Migration_Runner::LOCK_TIMEOUT - 1 ) ), array( 'option_name' => Migration_Runner::LOCK_OPTION ) );

		Migration_Runner::run_pending( $migrations );

		$this->assertSame( array( '9002-second', '9003-third' ), Fg_Test_Migration_Log::$ran );
		$this->assertSame( array( '9001-first', '9002-second', '9003-third' ), Migration_Runner::completed() );
		$this->assertNull( $this->lock_row() );
	}

	public function test_a_request_that_overran_its_lock_leaves_the_lock_another_request_took(): void {
		global $wpdb;

		$this->record( array() );
		$taken_over                     = (string) ( time() + 1 );
		Fg_Test_Migration_Log::$during = static function () use ( $wpdb, $taken_over ): void {
			$wpdb->update( $wpdb->options, array( 'option_value' => $taken_over ), array( 'option_name' => Migration_Runner::LOCK_OPTION ) );
		};

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( $taken_over, $this->lock_row() );
	}

	public function test_an_id_with_no_migration_is_kept_in_the_record(): void {
		$this->record( array( '9999-from-a-newer-version' ) );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array( '9999-from-a-newer-version', '9001-first' ), Migration_Runner::completed() );
	}

	public function test_a_record_that_is_not_a_list_runs_nothing_and_is_left_as_stored(): void {
		update_option( Migration_Runner::RECORD_OPTION, 'not-a-list', true );

		Migration_Runner::run_pending( array( Fg_Test_Migration_First::class ) );

		$this->assertSame( array(), Fg_Test_Migration_Log::$ran );
		$this->assertSame( 'not-a-list', get_option( Migration_Runner::RECORD_OPTION ) );
		$this->assertNull( $this->lock_row() );
	}

	public function test_discovery_finds_exactly_the_migrations_in_the_folder(): void {
		$found = Migration_Runner::discover();
		sort( $found );

		$this->assertSame(
			array(
				Collection_Defaults_Split::class,
				Featured_Gallery_Repair::class,
				Item_Meta_Consolidation::class,
				List_Setting_Repair::class,
			),
			$found
		);
		$this->assertSame(
			self::REAL,
			array_map(
				static function ( string $migration ): string {
					return $migration::id();
				},
				array( Item_Meta_Consolidation::class, Collection_Defaults_Split::class, List_Setting_Repair::class, Featured_Gallery_Repair::class )
			)
		);
	}

	public function test_nothing_pending_costs_no_query(): void {
		global $wpdb;

		$this->record( self::REAL );
		wp_load_alloptions();
		$queries = $wpdb->num_queries;

		Migration_Runner::run_pending();

		$this->assertSame( $queries, $wpdb->num_queries );
	}

	public function test_the_item_meta_consolidation_merges_rows_and_restores_lists(): void {
		global $wpdb;

		$table      = Item_Meta::table();
		$attachment = self::factory()->attachment->create_object( array( 'file' => 'fg-consolidation.jpg', 'post_mime_type' => 'image/jpeg' ) );
		$gallery    = self::factory()->post->create( array( 'post_type' => Post_Types::GALLERY ) );
		$wpdb->insert(
			$table,
			array(
				'attachment_id' => $attachment,
				'gallery_id'    => Item_Meta::GALLERY_ID,
			)
		);
		$wpdb->insert(
			$table,
			array(
				'attachment_id' => $attachment,
				'gallery_id'    => $gallery,
				'credit'        => 'Harbour Press',
			)
		);
		$this->record( array_values( array_diff( $this->recorded_before, array( Item_Meta_Consolidation::id() ) ) ) );

		Migration_Runner::run_pending( array( Item_Meta_Consolidation::class ) );

		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT gallery_id, credit FROM %i WHERE attachment_id = %d', $table, $attachment ), ARRAY_A );
		$this->assertSame(
			array(
				array(
					'gallery_id' => (string) Item_Meta::GALLERY_ID,
					'credit'     => 'Harbour Press',
				),
			),
			$rows
		);
		$this->assertSame( array( $attachment ), Gallery_Repository::get_item_ids( $gallery ) );
		$this->assertContains( Item_Meta_Consolidation::id(), Migration_Runner::completed() );
	}
}
