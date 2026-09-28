<?php
/**
 * Location coordinate guard.
 *
 * Covers Metadata_Manager's coordinate validation, the meta reader, the REST
 * row shape and the import cleaner. WordPress-independent: the few WordPress
 * functions they touch are stubbed.
 *
 * @package FotoGrids\Tests
 * @since   1.1.5
 */

declare(strict_types=1);

namespace {
	$plugin_root = dirname( __DIR__, 2 );

	if ( ! defined( 'WPINC' ) ) {
		define( 'WPINC', 'wp-includes' );
	}

	if ( ! class_exists( 'WP_Error' ) ) {
		/**
		 * WP_Error stub.
		 */
		class WP_Error { // phpcs:ignore Generic.Files.OneObjectStructurePerFile.MultipleFound -- Stub for the isolated, WordPress-independent suite.
			/**
			 * @var string
			 */
			public $code;

			/**
			 * @param string $code    Error code.
			 * @param string $message Message, unused.
			 * @param array  $data    Data, unused.
			 */
			public function __construct( $code = '', $message = '', $data = array() ) {
				unset( $message, $data );
				$this->code = $code;
			}
		}
	}

	if ( ! function_exists( '__' ) ) {
		/**
		 * Translation stub.
		 *
		 * @param  string $text   Text to return.
		 * @param  string $domain Text domain, unused.
		 * @return string
		 */
		function __( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
			unset( $domain );
			return $text;
		}
	}

	if ( ! function_exists( 'is_wp_error' ) ) {
		/**
		 * Error check stub.
		 *
		 * @param  mixed $thing Value to check.
		 * @return bool
		 */
		function is_wp_error( $thing ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
			return $thing instanceof WP_Error;
		}
	}

	if ( ! function_exists( 'wp_json_encode' ) ) {
		/**
		 * JSON stub.
		 *
		 * @param  mixed $value Value to encode.
		 * @return string|false
		 */
		function wp_json_encode( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stub for the isolated, WordPress-independent suite.
			return json_encode( $value ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- Stub for wp_json_encode itself.
		}
	}

	require_once $plugin_root . '/src/includes/class-metadata-manager.php';
}

namespace FotoGrids\Tests {

	use FotoGrids\Metadata_Manager;

	$failures = array();

	$check = static function ( bool $ok, string $label ) use ( &$failures ): void {
		if ( ! $ok ) {
			$failures[] = $label;
		}
	};

	$is_error = static function ( $result ): bool {
		return $result instanceof \WP_Error && 'fotogrids_invalid_coordinates' === $result->code;
	};

	// normalize_coordinates().
	$check( null === Metadata_Manager::normalize_coordinates( null, null ), 'both null means no coordinates' );
	$check( null === Metadata_Manager::normalize_coordinates( '', ' ' ), 'both blank means no coordinates' );
	$check(
		array(
			'latitude'  => 51.425400,
			'longitude' => -116.177300,
		) === Metadata_Manager::normalize_coordinates( '51.4254', '-116.1773' ),
		'numeric strings become floats'
	);
	$check(
		array(
			'latitude'  => 0.0,
			'longitude' => 0.0,
		) === Metadata_Manager::normalize_coordinates( 0, '0' ),
		'zero is a coordinate, not a blank'
	);
	$check(
		array(
			'latitude'  => 1.123457,
			'longitude' => 2.0,
		) === Metadata_Manager::normalize_coordinates( 1.1234567, 2 ),
		'values round to six decimals'
	);
	$check( null !== Metadata_Manager::normalize_coordinates( 90, -180 ) && ! $is_error( Metadata_Manager::normalize_coordinates( -90, 180 ) ), 'range ends are valid' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( '51.4', '' ) ), 'latitude without longitude is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( null, 10 ) ), 'longitude without latitude is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( 'abc', 10 ) ), 'text latitude is refused, not read as 0' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( '51,4', 10 ) ), 'decimal comma is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( 90.000001, 10 ) ), 'latitude above 90 is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( 10, -180.5 ) ), 'longitude below -180 is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( '1e400', 10 ) ), 'infinity is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( array( 1 ), 10 ) ), 'an array is refused' );
	$check( $is_error( Metadata_Manager::normalize_coordinates( true, 10 ) ), 'a boolean is refused' );

	// coordinates_from_meta().
	$check(
		array(
			'latitude'  => 32.0853,
			'longitude' => 34.7818,
		) === Metadata_Manager::coordinates_from_meta( '{"latitude":32.0853,"longitude":34.7818}' ),
		'JSON meta is read'
	);
	$check(
		array(
			'latitude'  => 0.0,
			'longitude' => 0.0,
		) === Metadata_Manager::coordinates_from_meta( array( 'latitude' => 0, 'longitude' => 0 ) ),
		'zero coordinates are read'
	);
	$none = array(
		'latitude'  => null,
		'longitude' => null,
	);
	$check( $none === Metadata_Manager::coordinates_from_meta( '{"latitude":32.0853}' ), 'half a pair reads as none' );
	$check( $none === Metadata_Manager::coordinates_from_meta( null ), 'no meta reads as none' );
	$check( $none === Metadata_Manager::coordinates_from_meta( 'not json' ), 'broken meta reads as none' );

	// format_for_response().
	$row = (object) array(
		'id'          => '7',
		'type'        => 'location',
		'name'        => 'Lake Louise',
		'slug'        => 'lake-louise',
		'usage_count' => '3',
		'created_at'  => '2026-09-01 10:00:00',
		'meta'        => '{"latitude":51.4254,"longitude":-116.1773}',
	);
	$out = Metadata_Manager::format_for_response( $row );
	$check( 7 === $out['id'] && 3 === $out['usage_count'], 'ids and counts are integers' );
	$check( 51.4254 === $out['latitude'] && -116.1773 === $out['longitude'], 'location coordinates are top-level' );

	$row->type = 'person';
	$row->meta = '{"details":"Photographer"}';
	$out       = Metadata_Manager::format_for_response( $row );
	$check( 'Photographer' === $out['details'] && ! array_key_exists( 'latitude', $out ), 'person details are top-level' );

	$row->type = 'tag';
	$row->meta = null;
	$out       = Metadata_Manager::format_for_response( $row );
	$check( null === $out['meta'] && ! array_key_exists( 'details', $out ), 'a tag carries no extra fields' );

	// prepare_imported_meta().
	$check(
		'{"latitude":51.4254,"longitude":-116.1773}' === Metadata_Manager::prepare_imported_meta( 'location', '{"latitude":"51.4254","longitude":"-116.1773"}' ),
		'imported coordinates are normalised'
	);
	$check(
		'{"note":"x"}' === Metadata_Manager::prepare_imported_meta( 'location', '{"note":"x","latitude":"abc","longitude":5}' ),
		'invalid imported coordinates are dropped, other keys kept'
	);
	$check( null === Metadata_Manager::prepare_imported_meta( 'location', '{"latitude":999,"longitude":5}' ), 'a location left with nothing stores null' );
	$check( '{"details":"x"}' === Metadata_Manager::prepare_imported_meta( 'person', '{"details":"x"}' ), 'other types pass through' );

	if ( ! empty( $failures ) ) {
		echo "FAIL: location coordinates are handled wrongly.\n";
		foreach ( $failures as $failure ) {
			echo ' - ' . $failure . "\n";
		}
		exit( 1 );
	}

	echo "OK: location coordinates are validated, read and shaped as expected.\n";
	exit( 0 );
}
