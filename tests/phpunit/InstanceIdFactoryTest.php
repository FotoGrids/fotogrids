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

	public function test_unusable_placement_key_returns_null(): void {
		$factory = Instance_Id_Factory::instance();

		$this->assertNull( $factory->generate_for_placement( 7, '--__' ) );
		$this->assertNull( $factory->generate_for_placement( 7, '' ) );
		$this->assertSame( 'fg-7-1', $factory->generate( 7 ) );
	}

	public function test_ids_the_factory_gives_a_collection_match_it(): void {
		$factory = Instance_Id_Factory::instance();

		$this->assertTrue( Instance_Id_Factory::matches( 472, $factory->generate( 472 ) ) );
		$this->assertTrue( Instance_Id_Factory::matches( 472, (string) $factory->generate_for_placement( 472, str_repeat( 'a', 40 ) ) ) );
	}

	public function test_an_id_of_another_collection_does_not_match(): void {
		$this->assertFalse( Instance_Id_Factory::matches( 47, 'fg-472-1' ) );
		$this->assertFalse( Instance_Id_Factory::matches( 472, 'fg-47-21' ) );
	}

	/**
	 * @dataProvider provide_ids_of_the_wrong_shape
	 */
	public function test_ids_of_the_wrong_shape_do_not_match( string $instance_id ): void {
		$this->assertFalse( Instance_Id_Factory::matches( 472, $instance_id ) );
	}

	/**
	 * @return array<string, array{string}>
	 */
	public static function provide_ids_of_the_wrong_shape(): array {
		return array(
			'empty'               => array( '' ),
			'no suffix'           => array( 'fg-472-' ),
			'no prefix'           => array( '472-1' ),
			'uppercase'           => array( 'fg-472-P1' ),
			'markup'              => array( 'fg-472-1"><script>' ),
			'selector'            => array( 'fg-472-1,body' ),
			'trailing newline'    => array( "fg-472-1\n" ),
			'suffix over 33 long' => array( 'fg-472-p' . str_repeat( 'a', 33 ) ),
		);
	}

	public function test_no_id_matches_a_collection_id_below_one(): void {
		$this->assertFalse( Instance_Id_Factory::matches( 0, 'fg-0-1' ) );
		$this->assertFalse( Instance_Id_Factory::matches( -1, 'fg--1-1' ) );
	}
}
