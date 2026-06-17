<?php
/**
 * Unit tests for the Hover_Effect value object and Hover_Effect_Registry.
 *
 * WP-independent: the classes only guard on WPINC, which the bootstrap defines.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Api\Hover_Effect;
use FotoGrids\Render\Internal\Hover_Effect_Registry;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/public/render/api/class-hover-effect.php';
require_once dirname( __DIR__, 2 ) . '/src/public/render/internal/class-hover-effect-registry.php';

final class HoverEffectRegistryTest extends TestCase {

	protected function setUp(): void {
		Hover_Effect_Registry::reset_for_tests();
	}

	protected function tearDown(): void {
		Hover_Effect_Registry::reset_for_tests();
	}

	private function make( array $overrides = array() ): Hover_Effect {
		return new Hover_Effect(
			array_merge(
				array(
					'id'       => 'zoom',
					'origin'   => 'fotogrids',
					'animates' => Hover_Effect::ANIMATES_MEDIA,
					'coupling' => Hover_Effect::COUPLING_ITEM,
				),
				$overrides
			)
		);
	}

	public function test_descriptor_defaults_and_casts(): void {
		$effect = $this->make();

		$this->assertSame( 'zoom', $effect->id );
		$this->assertSame( 'free', $effect->tier );
		$this->assertFalse( $effect->requires_caption );
		$this->assertFalse( $effect->is_teaser );
		$this->assertSame( array(), $effect->hide_on_layouts );
		$this->assertNull( $effect->css_path );
	}

	public function test_is_valid_requires_id_origin_and_known_enums(): void {
		$this->assertTrue( $this->make()->is_valid() );

		$this->assertFalse( $this->make( array( 'id' => '' ) )->is_valid() );
		$this->assertFalse( $this->make( array( 'origin' => '' ) )->is_valid() );
		$this->assertFalse( $this->make( array( 'animates' => 'bogus' ) )->is_valid() );
		$this->assertFalse( $this->make( array( 'coupling' => 'bogus' ) )->is_valid() );
	}

	public function test_register_and_get(): void {
		$effect = $this->make();
		Hover_Effect_Registry::register( $effect );

		$this->assertSame( $effect, Hover_Effect_Registry::get( 'zoom' ) );
		$this->assertNull( Hover_Effect_Registry::get( 'missing' ) );
	}

	public function test_invalid_descriptor_is_ignored(): void {
		Hover_Effect_Registry::register( $this->make( array( 'animates' => 'bogus' ) ) );

		$this->assertNull( Hover_Effect_Registry::get( 'zoom' ) );
		$this->assertSame( array(), Hover_Effect_Registry::all() );
	}

	public function test_for_origin_filters_by_origin(): void {
		Hover_Effect_Registry::register( $this->make( array( 'id' => 'zoom' ) ) );
		Hover_Effect_Registry::register(
			$this->make(
				array(
					'id'        => 'flip',
					'origin'    => 'fotogrids-pro',
					'is_teaser' => true,
				)
			)
		);

		$this->assertCount( 1, Hover_Effect_Registry::for_origin( 'fotogrids' ) );
		$this->assertCount( 1, Hover_Effect_Registry::for_origin( 'fotogrids-pro' ) );
		$this->assertCount( 0, Hover_Effect_Registry::for_origin( 'acme' ) );
	}

	public function test_real_descriptor_overrides_teaser_of_same_id(): void {
		$teaser = $this->make(
			array(
				'id'        => 'flip',
				'origin'    => 'fotogrids-pro',
				'is_teaser' => true,
			)
		);
		$real   = $this->make(
			array(
				'id'        => 'flip',
				'origin'    => 'fotogrids-pro',
				'is_teaser' => false,
				'css_path'  => 'hover/flip.css',
			)
		);

		Hover_Effect_Registry::register( $teaser );
		Hover_Effect_Registry::register( $real );

		$resolved = Hover_Effect_Registry::get( 'flip' );
		$this->assertFalse( $resolved->is_teaser );
		$this->assertSame( 'hover/flip.css', $resolved->css_path );
	}

	public function test_teaser_never_overrides_a_real_descriptor(): void {
		$real   = $this->make(
			array(
				'id'        => 'flip',
				'origin'    => 'fotogrids-pro',
				'is_teaser' => false,
				'css_path'  => 'hover/flip.css',
			)
		);
		$teaser = $this->make(
			array(
				'id'        => 'flip',
				'origin'    => 'fotogrids-pro',
				'is_teaser' => true,
			)
		);

		Hover_Effect_Registry::register( $real );
		Hover_Effect_Registry::register( $teaser );

		$resolved = Hover_Effect_Registry::get( 'flip' );
		$this->assertFalse( $resolved->is_teaser );
		$this->assertSame( 'hover/flip.css', $resolved->css_path );
	}

	public function test_as_options_shape_carries_grid_metadata(): void {
		Hover_Effect_Registry::register(
			$this->make(
				array(
					'id'               => 'spotlight',
					'tier'             => 'pro_starter',
					'animates'         => Hover_Effect::ANIMATES_BOTH,
					'requires_caption' => true,
					'hide_on_layouts'  => array( 'image-viewer' ),
					'conflicts_css'    => array( 'box-shadow' ),
				)
			)
		);

		$options = Hover_Effect_Registry::as_options();
		$this->assertCount( 1, $options );

		$option = $options[0];
		$this->assertSame( 'spotlight', $option['value'] );
		$this->assertSame( 'pro_starter', $option['tier_required'] );
		$this->assertSame( 'both', $option['animates'] );
		$this->assertTrue( $option['requires_caption'] );
		$this->assertSame( array( 'image-viewer' ), $option['hide_on_layouts'] );
		$this->assertSame( array( 'box-shadow' ), $option['conflicts_css'] );
	}
}
