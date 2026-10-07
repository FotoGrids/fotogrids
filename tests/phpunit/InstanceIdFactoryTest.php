<?php
/**
 * Unit tests for render instance identifiers.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Internal\Instance_Id_Factory;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-instance-id-factory.php';

/**
 * @covers \FotoGrids\Render\Internal\Instance_Id_Factory
 */
final class InstanceIdFactoryTest extends TestCase {

	protected function setUp(): void {
		Instance_Id_Factory::reset_for_tests();
	}

	protected function tearDown(): void {
		Instance_Id_Factory::reset_for_tests();
	}

	public function test_counter_ids_increase_within_a_request(): void {
		$factory = Instance_Id_Factory::instance();

		$this->assertSame( 'fg-472-1', $factory->generate( 472 ) );
		$this->assertSame( 'fg-472-2', $factory->generate( 472 ) );
	}

	public function test_placements_of_one_collection_get_distinct_ids_across_requests(): void {
		$first = Instance_Id_Factory::instance()->generate_for_placement( 472, 'abc123' );
		Instance_Id_Factory::reset_for_tests();
		$second = Instance_Id_Factory::instance()->generate_for_placement( 472, 'def456' );

		$this->assertSame( 'fg-472-pabc123', $first );
		$this->assertSame( 'fg-472-pdef456', $second );
	}

	public function test_same_placement_keeps_its_id_across_requests(): void {
		$first = Instance_Id_Factory::instance()->generate_for_placement( 492, 'e1b2c3' );
		Instance_Id_Factory::reset_for_tests();

		$this->assertSame( $first, Instance_Id_Factory::instance()->generate_for_placement( 492, 'e1b2c3' ) );
	}

	public function test_placement_key_is_reduced_to_lowercase_alphanumerics(): void {
		$id = Instance_Id_Factory::instance()->generate_for_placement( 7, 'Block-9F3E_2a"><x' );

		$this->assertSame( 'fg-7-pblock9f3e2ax', $id );
	}

	public function test_placement_key_is_capped_at_32_characters(): void {
		$id = Instance_Id_Factory::instance()->generate_for_placement( 7, str_repeat( 'a', 40 ) );

		$this->assertSame( 'fg-7-p' . str_repeat( 'a', 32 ), $id );
	}

	public function test_unusable_placement_key_falls_back_to_the_counter(): void {
		$this->assertSame( 'fg-7-1', Instance_Id_Factory::instance()->generate_for_placement( 7, '--__' ) );
	}
}
