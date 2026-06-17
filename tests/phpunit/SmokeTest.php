<?php
/**
 * Smoke test that proves the PHPUnit pipeline is wired correctly.
 *
 * Replace / grow this with real unit tests of WP-independent plugin classes
 * (value objects, enums, pure helpers). Classes that call WordPress functions
 * need the WP test harness wired into bootstrap.php first - see its note.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use PHPUnit\Framework\TestCase;

final class SmokeTest extends TestCase {

	public function test_php_version_meets_declared_floor(): void {
		$this->assertTrue(
			version_compare( PHP_VERSION, '7.4.0', '>=' ),
			'Plugin declares PHP 7.4 as the floor; the test runner is below it.'
		);
	}

	public function test_phpunit_assertions_work(): void {
		$this->assertSame( 4, 2 + 2 );
	}
}
