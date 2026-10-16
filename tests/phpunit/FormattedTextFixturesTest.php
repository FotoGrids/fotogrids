<?php
/**
 * Runs the shared formatted-text fixtures through the PHP formatter.
 *
 * The same fixtures run through the browser formatter in Jest, so the two
 * implementations cannot drift.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Formatted_Text\Formatter;
use FotoGrids\Formatted_Text\Schema;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/formatted-text/class-schema.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/formatted-text/class-entities.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/formatted-text/class-tokenizer.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/formatted-text/class-formatter.php';

final class FormattedTextFixturesTest extends TestCase {

	/**
	 * @return array<string, array{0: array<string, mixed>}>
	 */
	public function fixtures(): array {
		$path  = dirname( __DIR__, 2 ) . '/src/packages/fg-formatted-text/fixtures/format.json';
		$cases = json_decode( (string) file_get_contents( $path ), true );
		$out   = array();
		foreach ( $cases as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * Maps fixture options to the PHP option names.
	 *
	 * @param array<string, mixed> $options Fixture options.
	 * @return array<string, mixed>
	 */
	private function options( array $options ): array {
		$out = array();
		if ( isset( $options['mode'] ) ) {
			$out['mode'] = $options['mode'];
		}
		if ( isset( $options['links'] ) ) {
			$out['links'] = $options['links'];
		}
		if ( isset( $options['policy'] ) ) {
			$out['policy'] = array(
				'new_tab' => $options['policy']['newTab'],
				'rel'     => $options['policy']['rel'],
			);
		}
		if ( isset( $options['newTabLabel'] ) ) {
			$out['new_tab_label'] = $options['newTabLabel'];
		}
		if ( isset( $options['maxLength'] ) ) {
			$out['max_length'] = $options['maxLength'];
		}
		return $out;
	}

	/**
	 * @dataProvider fixtures
	 * @param array<string, mixed> $case Fixture.
	 */
	public function test_fixture( array $case ): void {
		$profile = isset( $case['profile'] ) ? Schema::validate( $case['profile'] ) : Schema::bundled();
		$options = $this->options( $case['options'] ?? array() );

		$this->assertSame(
			$case['html'],
			Formatter::to_html( Formatter::parse( $case['input'], $profile, $options )['nodes'] ),
			'html'
		);

		if ( array_key_exists( 'text', $case ) ) {
			$this->assertSame(
				$case['text'],
				Formatter::to_text( Formatter::parse( $case['input'], $profile, array( 'mode' => 'plain' ) )['nodes'] ),
				'text'
			);
		}

		$normalized = Formatter::parse(
			$case['input'],
			$profile,
			array(
				'mode'   => 'basic',
				'links'  => true,
				'policy' => null,
			)
		);
		if ( array_key_exists( 'normalized', $case ) ) {
			$this->assertSame( $case['normalized'], Formatter::to_html( $normalized['nodes'], true ), 'normalized' );
		}
		if ( array_key_exists( 'lossy', $case ) ) {
			$this->assertSame( $case['lossy'], $normalized['lossy'], 'lossy' );
		}
	}

	public function test_validate_matches_the_browser_rules(): void {
		$profile = Schema::validate(
			array(
				'elements'        => array(
					'bad name' => array(),
					'iframe'   => array(),
					'u'        => array(
						'attributes' => array(
							'onmouseover' => array( 'type' => 'text' ),
							'data-x'      => array( 'type' => 'text' ),
							'lang'        => array( 'type' => 'text' ),
						),
					),
				),
				'protocols'       => array( 'HTTPS', 'javascript', 'data', 'vbscript', '1bad' ),
				'breakBefore'     => array( 'p', 'Bad Name' ),
				'dropWithContent' => 'nope',
				'extra'           => true,
			)
		);
		$this->assertSame( array( 'u' ), array_keys( $profile['elements'] ) );
		$this->assertSame( array( 'lang' => array( 'type' => 'text' ) ), $profile['elements']['u']['attributes'] );
		$this->assertSame( array( 'https' ), $profile['protocols'] );
		$this->assertSame( array( 'p' ), $profile['breakBefore'] );
		$this->assertSame( array(), $profile['dropWithContent'] );
		$this->assertSame( array( 'elements', 'protocols', 'breakBefore', 'dropWithContent' ), array_keys( $profile ) );
	}

	public function test_bundled_profile_has_the_documented_elements(): void {
		$this->assertSame( array( 'strong', 'b', 'em', 'i', 'br', 'a' ), array_keys( Schema::bundled()['elements'] ) );
		$this->assertSame( array( 'http', 'https', 'mailto', 'tel' ), Schema::bundled()['protocols'] );
	}
}
