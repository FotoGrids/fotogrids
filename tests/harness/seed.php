<?php
/**
 * Fixture seeder for the E2E suite.
 *
 * Run through the harness shim, which pins the php and the install:
 *
 *   ./tests/harness/.state/wp-shim eval-file tests/harness/seed.php
 *   ./tests/harness/.state/wp-shim eval-file tests/harness/seed.php reset
 *   ./tests/harness/.state/wp-shim eval-file tests/harness/seed.php only=F-exif,F-large
 *   ./tests/harness/.state/wp-shim eval-file tests/harness/seed.php out=tests/harness/.state/fixtures.json
 *
 * Prints `FGFIXTURES` followed by a JSON map of fixture key to the ids it owns.
 *
 * Fixtures are built through the plugin's own APIs - Gallery_Items,
 * Gallery_Repository, Embed_Store, Metadata_Manager, Gallery_Album_Relations -
 * and never by writing rows directly. A fixture assembled by hand would encode
 * this file's idea of the schema rather than the plugin's, and would keep
 * passing after the plugin's own writers changed.
 *
 * Every media file is generated here rather than committed. Nothing in the
 * catalogue needs a photograph, several sets need images too large to want in a
 * git history, and generated files let a fixture state its own EXIF rather than
 * inheriting whatever a sample file happened to carry.
 *
 * @package FotoGrids\Tests
 */

use FotoGrids\Galleries\Embed_Store;
use FotoGrids\Galleries\Gallery_Items;
use FotoGrids\Galleries\Gallery_Repository;

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	die( "seed.php runs under wp-cli: wp eval-file tests/harness/seed.php\n" );
}

/** Bumped when a fixture definition changes, so seeded sites rebuild. */
const FG_SEED_VERSION = '1';

/** Marks every post this file creates, so it can find and remove its own work. */
const FG_SEED_MARKER = '_fg_fixture';

/** Carries FG_SEED_VERSION, so a changed definition rebuilds rather than persists. */
const FG_SEED_VERSION_KEY = '_fg_fixture_version';

// ---------------------------------------------------------------------------
// media generation
// ---------------------------------------------------------------------------

/**
 * Draw a deterministic test image.
 *
 * The content matters less than the dimensions and the format, but it is not
 * noise: each image carries a visible band pattern derived from its seed, so a
 * failing visual diff shows which fixture it came from.
 *
 * @param int    $width  Pixels.
 * @param int    $height Pixels.
 * @param string $format png|jpeg|gif|webp.
 * @param array  $opts   alpha:bool, animated:bool, quality:int, seed:int.
 * @return string Absolute path to the generated file.
 */
function fg_seed_draw( int $width, int $height, string $format = 'jpeg', array $opts = array() ): string {
	$seed  = (int) ( $opts['seed'] ?? ( $width + $height ) );
	$alpha = (bool) ( $opts['alpha'] ?? false );

	$img = imagecreatetruecolor( $width, $height );

	if ( $alpha ) {
		imagealphablending( $img, false );
		imagesavealpha( $img, true );
		imagefill( $img, 0, 0, imagecolorallocatealpha( $img, 0, 0, 0, 127 ) );
		imagealphablending( $img, true );
	} else {
		imagefill( $img, 0, 0, imagecolorallocate( $img, 240, 240, 245 ) );
	}

	// With alpha the bands are inset, so the border stays fully transparent -
	// otherwise the fill covers every pixel and the file has an alpha channel
	// carrying nothing, which is not what the watermark paths need to see.
	$inset  = $alpha ? (int) ( $width * 0.2 ) : 0;
	$top    = $alpha ? (int) ( $height * 0.2 ) : 0;
	$bottom = $height - $top;
	$span   = $width - ( 2 * $inset );

	$bands = 8;
	for ( $i = 0; $i < $bands; $i++ ) {
		$shade = ( ( $seed * ( $i + 3 ) ) % 200 ) + 40;
		$color = imagecolorallocatealpha(
			$img,
			$shade,
			( $shade * 2 ) % 256,
			( $shade * 3 ) % 256,
			$alpha ? (int) ( $i * 60 / $bands ) : 0
		);
		imagefilledrectangle(
			$img,
			$inset + (int) ( $i * $span / $bands ),
			$top,
			$inset + (int) ( ( $i + 1 ) * $span / $bands ),
			$bottom,
			$color
		);
	}

	$path = wp_tempnam( 'fg-seed' );

	switch ( $format ) {
		case 'png':
			$png = $path . '.png';
			imagepng( $img, $png, 1 );
			break;
		case 'gif':
			$png = $path . '.gif';
			imagegif( $img, $png );
			break;
		case 'webp':
			$png = $path . '.webp';
			imagewebp( $img, $png, 80 );
			break;
		default:
			$png = $path . '.jpg';
			imagejpeg( $img, $png, (int) ( $opts['quality'] ?? 82 ) );
	}

	imagedestroy( $img );
	@unlink( $path );

	return $png;
}

/**
 * Build an EXIF APP1 segment and splice it into a JPEG.
 *
 * GD cannot write EXIF, and `F-exif` exists precisely to exercise the reader,
 * so the segment is assembled here: a little-endian TIFF header, IFD0 with the
 * camera identity, an Exif sub-IFD with the exposure triangle, and a GPS IFD.
 * Values are rationals, which is what `exif_read_data()` expects and what the
 * plugin's formatters parse.
 *
 * @param string $jpeg_path JPEG to rewrite in place.
 * @param array  $data      make, model, lens, iso, fnumber, exposure, focal, gps_lat, gps_lon, datetime.
 * @return bool
 */
function fg_seed_write_exif( string $jpeg_path, array $data ): bool {
	$le = fn( int $v ) => pack( 'V', $v );
	$sh = fn( int $v ) => pack( 'v', $v );

	// Values that do not fit in four bytes live after the IFDs; collect them
	// here and patch their offsets in once the layout is known.
	$pool     = '';
	$pool_at  = array();
	$stash    = function ( string $bytes ) use ( &$pool, &$pool_at ) {
		$key             = md5( $bytes );
		$pool_at[ $key ] = strlen( $pool );
		$pool           .= $bytes;
		if ( strlen( $pool ) % 2 ) {
			$pool .= "\0";
		}
		return $key;
	};

	$rational = fn( int $n, int $d ) => pack( 'VV', $n, $d );

	$make     = $stash( $data['make'] . "\0" );
	$model    = $stash( $data['model'] . "\0" );
	$software = $stash( "FotoGrids fixture seeder\0" );
	$datetime = $stash( $data['datetime'] . "\0" );
	$lens     = $stash( $data['lens'] . "\0" );
	$fnumber  = $stash( $rational( (int) round( $data['fnumber'] * 10 ), 10 ) );
	$exposure = $stash( $rational( 1, (int) $data['exposure_denominator'] ) );
	$focal    = $stash( $rational( (int) $data['focal'], 1 ) );

	$dms      = function ( float $deg ) use ( $rational ) {
		$deg = abs( $deg );
		$d   = (int) floor( $deg );
		$m   = (int) floor( ( $deg - $d ) * 60 );
		$s   = ( $deg - $d - $m / 60 ) * 3600;
		return $rational( $d, 1 ) . $rational( $m, 1 ) . $rational( (int) round( $s * 100 ), 100 );
	};
	$lat      = $stash( $dms( $data['gps_lat'] ) );
	$lon      = $stash( $dms( $data['gps_lon'] ) );
	$lat_ref  = $data['gps_lat'] >= 0 ? 'N' : 'S';
	$lon_ref  = $data['gps_lon'] >= 0 ? 'E' : 'W';

	// An entry is tag(2) type(2) count(4) value-or-offset(4).
	$entry = function ( int $tag, int $type, int $count, string $value ) use ( $sh, $le ) {
		if ( strlen( $value ) < 4 ) {
			$value = str_pad( $value, 4, "\0" );
		}
		return $sh( $tag ) . $sh( $type ) . $le( $count ) . substr( $value, 0, 4 );
	};

	// Two passes: the first computes sizes, the second writes real offsets.
	$build = function ( int $pool_base ) use (
		$entry, $le, $sh, $pool_at, $make, $model, $software, $datetime, $lens,
		$fnumber, $exposure, $focal, $lat, $lon, $lat_ref, $lon_ref, $data
	) {
		$at = fn( string $key ) => $le( $pool_base + $pool_at[ $key ] );

		$ifd0 = array(
			array( 0x010F, 2, strlen( $data['make'] ) + 1, $at( $make ) ),
			array( 0x0110, 2, strlen( $data['model'] ) + 1, $at( $model ) ),
			array( 0x0131, 2, 25, $at( $software ) ),
			array( 0x0132, 2, 20, $at( $datetime ) ),
		);
		$exif = array(
			array( 0x829A, 5, 1, $at( $exposure ) ),
			array( 0x829D, 5, 1, $at( $fnumber ) ),
			array( 0x8827, 3, 1, $sh( (int) $data['iso'] ) . "\0\0" ),
			array( 0x9003, 2, 20, $at( $datetime ) ),
			array( 0x920A, 5, 1, $at( $focal ) ),
			array( 0xA434, 2, strlen( $data['lens'] ) + 1, $at( $lens ) ),
		);
		$gps  = array(
			array( 0x0001, 2, 2, $lat_ref . "\0" ),
			array( 0x0002, 5, 3, $at( $lat ) ),
			array( 0x0003, 2, 2, $lon_ref . "\0" ),
			array( 0x0004, 5, 3, $at( $lon ) ),
		);

		// IFD0 gains two pointers, to the Exif and GPS sub-IFDs.
		$ifd0_size = 2 + ( count( $ifd0 ) + 2 ) * 12 + 4;
		$exif_at   = 8 + $ifd0_size;
		$exif_size = 2 + count( $exif ) * 12 + 4;
		$gps_at    = $exif_at + $exif_size;

		$ifd0[] = array( 0x8769, 4, 1, $le( $exif_at ) );
		$ifd0[] = array( 0x8825, 4, 1, $le( $gps_at ) );
		usort( $ifd0, fn( $a, $b ) => $a[0] <=> $b[0] );

		$render = function ( array $entries ) use ( $entry, $sh, $le ) {
			$out = $sh( count( $entries ) );
			foreach ( $entries as $e ) {
				$out .= $entry( $e[0], $e[1], $e[2], $e[3] );
			}
			return $out . $le( 0 );
		};

		return array(
			'tiff' => "II\x2a\x00" . $le( 8 ) . $render( $ifd0 ) . $render( $exif ) . $render( $gps ),
			'gps_end' => $gps_at + 2 + count( $gps ) * 12 + 4,
		);
	};

	$first     = $build( 0 );
	$pool_base = $first['gps_end'];
	$second    = $build( $pool_base );
	$tiff      = $second['tiff'] . $pool;

	$app1 = "Exif\0\0" . $tiff;
	$seg  = "\xFF\xE1" . pack( 'n', strlen( $app1 ) + 2 ) . $app1;

	$jpeg = file_get_contents( $jpeg_path );
	if ( "\xFF\xD8" !== substr( $jpeg, 0, 2 ) ) {
		return false;
	}

	// Straight after SOI, before anything GD wrote.
	$out = "\xFF\xD8" . $seg . substr( $jpeg, 2 );

	return (bool) file_put_contents( $jpeg_path, $out );
}

/**
 * Splice an XMP packet into a JPEG.
 *
 * The plugin's credit reader scans the raw bytes for `<x:xmpmeta>` rather than
 * parsing segments, but this writes a real APP1 anyway so the file is also
 * correct for anything else that reads it.
 *
 * @param string $jpeg_path JPEG to rewrite in place.
 * @param string $credit    photoshop:Credit and dc:rights value.
 * @return bool
 */
function fg_seed_write_xmp( string $jpeg_path, string $credit ): bool {
	$escaped = htmlspecialchars( $credit, ENT_QUOTES | ENT_XML1, 'UTF-8' );
	$packet  = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
		. '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
		. '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
		. '<rdf:Description rdf:about="" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"'
		. ' xmlns:dc="http://purl.org/dc/elements/1.1/" photoshop:Credit="' . $escaped . '">'
		. '<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">' . $escaped . '</rdf:li></rdf:Alt></dc:rights>'
		. '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

	$app1 = "http://ns.adobe.com/xap/1.0/\0" . $packet;
	$seg  = "\xFF\xE1" . pack( 'n', strlen( $app1 ) + 2 ) . $app1;

	$jpeg = file_get_contents( $jpeg_path );
	if ( "\xFF\xD8" !== substr( $jpeg, 0, 2 ) ) {
		return false;
	}

	// After any existing APP1, so an EXIF segment written first stays first.
	$insert_at = 2;
	while ( "\xFF\xE1" === substr( $jpeg, $insert_at, 2 ) ) {
		$insert_at += 2 + unpack( 'n', substr( $jpeg, $insert_at + 2, 2 ) )[1];
	}

	$out = substr( $jpeg, 0, $insert_at ) . $seg . substr( $jpeg, $insert_at );

	return (bool) file_put_contents( $jpeg_path, $out );
}

// ---------------------------------------------------------------------------
// WordPress objects
// ---------------------------------------------------------------------------

/**
 * Sideload a generated file into the media library.
 *
 * @param string $path   File to import; consumed.
 * @param string $key    Owning fixture key.
 * @param array  $fields title, alt, caption, description, filename.
 * @return int Attachment ID, or 0.
 */
function fg_seed_attachment( string $path, string $key, array $fields = array() ): int {
	$name = $fields['filename'] ?? basename( $path );

	$upload = wp_upload_bits( $name, null, file_get_contents( $path ) );
	@unlink( $path );

	if ( ! empty( $upload['error'] ) ) {
		WP_CLI::warning( 'upload failed for ' . $name . ': ' . $upload['error'] );
		return 0;
	}

	$id = wp_insert_attachment(
		array(
			'post_mime_type' => $upload['type'],
			'post_title'     => (string) ( $fields['title'] ?? '' ),
			'post_excerpt'   => (string) ( $fields['caption'] ?? '' ),
			'post_content'   => (string) ( $fields['description'] ?? '' ),
			'post_status'    => 'inherit',
		),
		$upload['file']
	);

	if ( is_wp_error( $id ) || ! $id ) {
		return 0;
	}

	require_once ABSPATH . 'wp-admin/includes/image.php';
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );

	if ( isset( $fields['alt'] ) ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $fields['alt'] );
	}

	fg_seed_mark( $id, $key );

	return (int) $id;
}

/**
 * Create a gallery and attach its items.
 *
 * @param string $key      Owning fixture key.
 * @param string $title    Post title.
 * @param int[]  $item_ids Attachment or embed post ids, in display order.
 * @param array  $settings Collection settings, without the `fotogrids_` prefix.
 * @param array  $post     Extra wp_insert_post fields.
 * @return int Gallery post ID.
 */
function fg_seed_gallery( string $key, string $title, array $item_ids = array(), array $settings = array(), array $post = array() ): int {
	$id = wp_insert_post(
		array_merge(
			array(
				'post_type'   => 'fotogrids_gallery',
				'post_status' => 'publish',
				'post_title'  => $title,
			),
			$post
		),
		true
	);

	if ( is_wp_error( $id ) ) {
		WP_CLI::error( 'could not create gallery ' . $title . ': ' . $id->get_error_message() );
	}

	$id = (int) $id;

	foreach ( $settings as $setting => $value ) {
		update_post_meta( $id, 'fotogrids_' . $setting, is_array( $value ) ? wp_json_encode( $value ) : $value );
	}

	if ( $item_ids ) {
		Gallery_Repository::set_item_ids( $id, $item_ids );

		// The id list is the display order; the item_meta rows are what the
		// render path reads. Gallery_Items::add writes the per-gallery row.
		foreach ( $item_ids as $position => $item_id ) {
			if ( 'attachment' === get_post_type( $item_id ) ) {
				Gallery_Items::add( $id, (int) $item_id, array( 'position' => $position ) );
			}
		}
	}

	fg_seed_mark( $id, $key );

	return $id;
}

/**
 * Create an album.
 *
 * @param string $key          Owning fixture key.
 * @param string $title        Post title.
 * @param int[]  $gallery_ids  Child galleries, in order.
 * @return int Album post ID.
 */
function fg_seed_album( string $key, string $title, array $gallery_ids = array() ): int {
	$id = wp_insert_post(
		array(
			'post_type'   => 'fotogrids_album',
			'post_status' => 'publish',
			'post_title'  => $title,
		),
		true
	);

	if ( is_wp_error( $id ) ) {
		WP_CLI::error( 'could not create album ' . $title . ': ' . $id->get_error_message() );
	}

	$id = (int) $id;

	foreach ( $gallery_ids as $position => $gallery_id ) {
		\FotoGrids\Gallery_Album_Relations::add_gallery_to_album( $gallery_id, $id, $position );
	}

	fg_seed_mark( $id, $key );

	return $id;
}

/**
 * Tag a post as this seeder's, with the version that produced it.
 *
 * @param int    $post_id Post ID.
 * @param string $key     Fixture key.
 * @return void
 */
function fg_seed_mark( int $post_id, string $key ): void {
	update_post_meta( $post_id, FG_SEED_MARKER, $key );
	update_post_meta( $post_id, FG_SEED_VERSION_KEY, FG_SEED_VERSION );
}

/**
 * Every post a fixture key owns.
 *
 * @param string|null $key Fixture key, or null for all of them.
 * @return int[]
 */
function fg_seed_owned( ?string $key = null ): array {
	$args = array(
		'post_type'      => array( 'fotogrids_gallery', 'fotogrids_album', 'fotogrids_embed', 'attachment' ),
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'meta_query'     => array(
			null === $key
				? array(
					'key'     => FG_SEED_MARKER,
					'compare' => 'EXISTS',
				)
				: array(
					'key'   => FG_SEED_MARKER,
					'value' => $key,
				),
		),
	);

	return array_map( 'intval', get_posts( $args ) );
}

/**
 * Whether a key is present and was built by the current definition.
 *
 * @param string $key Fixture key.
 * @return bool
 */
function fg_seed_is_current( string $key ): bool {
	$owned = fg_seed_owned( $key );
	if ( ! $owned ) {
		return false;
	}

	foreach ( $owned as $post_id ) {
		if ( FG_SEED_VERSION !== (string) get_post_meta( $post_id, FG_SEED_VERSION_KEY, true ) ) {
			return false;
		}
	}

	return true;
}

/** Option holding the last built id map, so a skipped fixture can still be reported. */
const FG_SEED_MAP_OPTION = 'fg_fixture_map';

/**
 * Remember the ids a fixture produced.
 *
 * A skipped fixture still has to hand the specs its ids, and re-deriving them
 * from post meta would mean every builder also writing a reader.
 *
 * @param string $key  Fixture key.
 * @param array  $data Whatever the builder returned.
 * @return void
 */
function fg_seed_remember( string $key, array $data ): void {
	$map         = (array) get_option( FG_SEED_MAP_OPTION, array() );
	$map[ $key ] = $data;
	update_option( FG_SEED_MAP_OPTION, $map, false );
}

/**
 * The ids a fixture produced when it was last built.
 *
 * @param string $key Fixture key.
 * @return array
 */
function fg_seed_existing( string $key ): array {
	$map = (array) get_option( FG_SEED_MAP_OPTION, array() );

	return (array) ( $map[ $key ] ?? array() );
}

/**
 * Forget a fixture's ids.
 *
 * @param string|null $key Fixture key, or null for all of them.
 * @return void
 */
function fg_seed_forget( ?string $key = null ): void {
	if ( null === $key ) {
		delete_option( FG_SEED_MAP_OPTION );
		return;
	}

	$map = (array) get_option( FG_SEED_MAP_OPTION, array() );
	unset( $map[ $key ] );
	update_option( FG_SEED_MAP_OPTION, $map, false );
}

/**
 * Delete everything a key owns, including its item_meta rows.
 *
 * @param string|null $key Fixture key, or null for all of them.
 * @return int Posts removed.
 */
function fg_seed_purge( ?string $key = null ): int {
	$owned = fg_seed_owned( $key );

	foreach ( $owned as $post_id ) {
		if ( 'fotogrids_gallery' === get_post_type( $post_id ) ) {
			foreach ( Gallery_Repository::get_item_ids( $post_id ) as $item_id ) {
				Gallery_Items::remove( $post_id, (int) $item_id );
			}
		}
		if ( Embed_Store::is_embed( $post_id ) ) {
			Embed_Store::delete( $post_id );
			continue;
		}
		wp_delete_post( $post_id, true );
	}

	fg_seed_forget( $key );

	return count( $owned );
}

// ---------------------------------------------------------------------------
// the catalogue
// ---------------------------------------------------------------------------

/**
 * Assemble an animated GIF from two GD frames.
 *
 * GD writes one frame at a time, so the frames are generated as palette images
 * with the colours allocated in the same order - which gives both files an
 * identical global colour table - and the second frame's image descriptor is
 * spliced into the first file behind a graphic control extension. Doing it this
 * way leaves the LZW encoding to GD.
 *
 * @param int $width  Pixels.
 * @param int $height Pixels.
 * @return string Path to the generated GIF.
 */
function fg_seed_animated_gif( int $width, int $height ): string {
	$frames = array();

	foreach ( array( 0, 1 ) as $n ) {
		$img = imagecreate( $width, $height );
		// Identical allocation order in both frames, so the colour tables match.
		$bg   = imagecolorallocate( $img, 250, 250, 250 );
		$ink  = imagecolorallocate( $img, 30, 90, 200 );
		$alt  = imagecolorallocate( $img, 220, 60, 40 );
		$fill = 0 === $n ? $ink : $alt;
		imagefilledrectangle( $img, 0, 0, (int) ( $width / 2 ), $height, $fill );
		$path = wp_tempnam( 'fg-gif' ) . '.gif';
		imagegif( $img, $path );
		imagedestroy( $img );
		$frames[] = $path;
	}

	$first  = file_get_contents( $frames[0] );
	$second = file_get_contents( $frames[1] );
	array_map( 'unlink', $frames );

	// Header is signature(6) + logical screen descriptor(7) + global colour
	// table, whose size is encoded in the packed field.
	$packed = ord( $first[10] );
	$gct    = ( $packed & 0x80 ) ? 3 * ( 1 << ( ( $packed & 0x07 ) + 1 ) ) : 0;
	$body   = 13 + $gct;

	$loop = "\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00";
	$gce  = "\x21\xF9\x04\x00\x32\x00\x00\x00";

	$frame_one = substr( $first, $body, -1 );
	$frame_two = substr( $second, $body, -1 );

	// GD writes GIF87a, which has no graphic control or application extensions.
	// The bytes below are 89a constructs, so the header has to say so.
	$header = 'GIF89a' . substr( $first, 6, $body - 6 );

	$path = wp_tempnam( 'fg-anim' ) . '.gif';
	file_put_contents(
		$path,
		$header . $loop . $gce . $frame_one . $gce . $frame_two . "\x3B"
	);

	return $path;
}

/**
 * A large PNG of incompressible noise, sized to roughly a target in megabytes.
 *
 * Random bytes are wrapped in a BMP header rather than written pixel by pixel:
 * a pixel loop over tens of millions of pixels takes minutes in PHP, and PNG
 * compression of noise is close to 1:1, so the raw size is the output size.
 *
 * @param int $megabytes Target size.
 * @return string Path to the generated PNG.
 */
function fg_seed_noise_png( int $megabytes ): string {
	$pixels = (int) ( $megabytes * 1024 * 1024 / 3 );
	$side   = (int) sqrt( $pixels );
	$side  -= $side % 4;

	$row_bytes = $side * 3;
	$padding   = ( 4 - ( $row_bytes % 4 ) ) % 4;
	$raw_size  = ( $row_bytes + $padding ) * $side;

	$header = 'BM' . pack( 'VvvV', 14 + 40 + $raw_size, 0, 0, 14 + 40 )
		. pack( 'VVVvvVVVVVV', 40, $side, $side, 1, 24, 0, $raw_size, 2835, 2835, 0, 0 );

	$bmp = wp_tempnam( 'fg-noise' ) . '.bmp';
	$fh  = fopen( $bmp, 'wb' );
	fwrite( $fh, $header );
	for ( $y = 0; $y < $side; $y++ ) {
		fwrite( $fh, random_bytes( $row_bytes ) . str_repeat( "\0", $padding ) );
	}
	fclose( $fh );

	$img = imagecreatefrombmp( $bmp );
	@unlink( $bmp );

	$png = wp_tempnam( 'fg-noise' ) . '.png';
	imagepng( $img, $png, 0 );
	imagedestroy( $img );

	return $png;
}

/**
 * The fixture catalogue.
 *
 * Each builder returns the ids the key owns, for the JSON map the specs read.
 *
 * @return array<string, callable>
 */
function fg_seed_catalogue(): array {
	return array(

		'F-empty' => function () {
			return array( 'gallery' => fg_seed_gallery( 'F-empty', 'Fixture empty' ) );
		},

		'F-single' => function () {
			$item = fg_seed_attachment(
				fg_seed_draw( 1200, 800, 'jpeg', array( 'seed' => 1 ) ),
				'F-single',
				array(
					'title'   => 'Single item',
					'alt'     => 'A single landscape test image',
					'caption' => 'The only item in this gallery',
				)
			);
			return array(
				'gallery' => fg_seed_gallery( 'F-single', 'Fixture single', array( $item ) ),
				'items'   => array( $item ),
			);
		},

		'F-small' => function () {
			$items = array();
			foreach ( range( 1, 5 ) as $n ) {
				$portrait = 0 === $n % 2;
				$items[]  = fg_seed_attachment(
					fg_seed_draw(
						$portrait ? 800 : 1400,
						$portrait ? 1200 : 900,
						'jpeg',
						array( 'seed' => 10 + $n )
					),
					'F-small',
					array(
						'title'       => 'Small ' . $n,
						'alt'         => 'Test image ' . $n . ', ' . ( $portrait ? 'portrait' : 'landscape' ),
						'caption'     => 'Caption for item ' . $n,
						'description' => 'Description for item ' . $n . '.',
					)
				);
			}
			return array(
				'gallery' => fg_seed_gallery( 'F-small', 'Fixture small', $items ),
				'items'   => $items,
			);
		},

		'F-large' => function () {
			$items = array();
			foreach ( range( 1, 60 ) as $n ) {
				$items[] = fg_seed_attachment(
					fg_seed_draw( 900, 600 + ( $n % 5 ) * 40, 'jpeg', array( 'seed' => 100 + $n ) ),
					'F-large',
					array(
						'title' => 'Large ' . $n,
						'alt'   => 'Item ' . $n . ' of sixty',
					)
				);
			}
			return array(
				'gallery' => fg_seed_gallery( 'F-large', 'Fixture large', $items ),
				'items'   => $items,
			);
		},

		'F-noalt' => function () {
			$items = array();
			foreach ( range( 1, 3 ) as $n ) {
				$items[] = fg_seed_attachment(
					fg_seed_draw( 1000, 700, 'jpeg', array( 'seed' => 200 + $n ) ),
					'F-noalt',
					array( 'filename' => 'IMG_' . ( 4000 + $n ) . '.jpg' )
				);
			}
			return array(
				'gallery' => fg_seed_gallery( 'F-noalt', 'Fixture no alt', $items ),
				'items'   => $items,
			);
		},

		'F-pw' => function () {
			$item = fg_seed_attachment(
				fg_seed_draw( 1200, 800, 'jpeg', array( 'seed' => 300 ) ),
				'F-pw',
				array( 'alt' => 'Behind a password' )
			);
			return array(
				'gallery'  => fg_seed_gallery(
					'F-pw',
					'Fixture password',
					array( $item ),
					array(
						'password_protect'  => '1',
						'password_remember' => '1',
						'password'          => \FotoGrids\Password_Crypto::encrypt( 'open-sesame' ),
					)
				),
				'password' => 'open-sesame',
				'items'    => array( $item ),
			);
		},

		'F-reg' => function () {
			$item = fg_seed_attachment(
				fg_seed_draw( 1200, 800, 'jpeg', array( 'seed' => 400 ) ),
				'F-reg',
				array( 'alt' => 'Registered users only' )
			);
			return array(
				'gallery' => fg_seed_gallery(
					'F-reg',
					'Fixture registered',
					array( $item ),
					array( 'who_can_view' => 'registered_users' )
				),
				'items'   => array( $item ),
			);
		},

		'F-exif' => function () {
			// Above WordPress's big_image_size_threshold, so the upload is kept
			// as the original and a `-scaled` derivative is generated - which is
			// the case the credit reader has to look past.
			$path = fg_seed_draw( 3200, 2400, 'jpeg', array( 'seed' => 600 ) );
			fg_seed_write_exif(
				$path,
				array(
					'make'                 => 'FotoGrids',
					'model'                => 'Fixture One',
					'lens'                 => 'FG 35mm f/1.4',
					'iso'                  => 400,
					'fnumber'              => 2.8,
					'exposure_denominator' => 250,
					'focal'                => 35,
					'gps_lat'              => 32.0853,
					'gps_lon'              => 34.7818,
					'datetime'             => '2026:04:12 15:30:00',
				)
			);
			fg_seed_write_xmp( $path, 'Fixture Photographer' );

			$item = fg_seed_attachment(
				$path,
				'F-exif',
				array(
					'title'   => 'EXIF sample',
					'alt'     => 'Image carrying camera metadata',
					'caption' => 'Shot for the EXIF fixture',
				)
			);

			return array(
				'gallery' => fg_seed_gallery( 'F-exif', 'Fixture exif', array( $item ), array( 'display_exif' => '1' ) ),
				'items'   => array( $item ),
				'credit'  => 'Fixture Photographer',
			);
		},

		'F-mixed' => function () {
			$images = array();
			foreach ( range( 1, 2 ) as $n ) {
				$images[] = fg_seed_attachment(
					fg_seed_draw( 1200, 800, 'jpeg', array( 'seed' => 700 + $n ) ),
					'F-mixed',
					array( 'alt' => 'Mixed gallery image ' . $n )
				);
			}

			// A container-only MP4. The render path reads the mime type and the
			// URL and never decodes the stream; anything that actually plays the
			// file needs a real one, which is not something to keep in git.
			$mp4 = wp_tempnam( 'fg-video' ) . '.mp4';
			file_put_contents(
				$mp4,
				"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41"
				. "\x00\x00\x00\x08free\x00\x00\x00\x08mdat"
			);
			$video = fg_seed_attachment( $mp4, 'F-mixed', array( 'title' => 'Mixed video file' ) );

			$youtube = Embed_Store::create(
				array(
					'item_type'     => 'video_youtube',
					'video_id'      => 'dQw4w9WgXcQ',
					'url'           => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
					'caption'       => 'Fixture YouTube embed',
					'thumbnail_url' => 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
					'settings'      => array(),
				)
			);
			fg_seed_mark( $youtube, 'F-mixed' );

			$vimeo = Embed_Store::create(
				array(
					'item_type'     => 'video_vimeo',
					'video_id'      => '76979871',
					'url'           => 'https://vimeo.com/76979871',
					'caption'       => 'Fixture Vimeo embed',
					'thumbnail_url' => '',
					'settings'      => array(),
				)
			);
			fg_seed_mark( $vimeo, 'F-mixed' );

			$ids = array_merge( $images, array( $video, $youtube, $vimeo ) );

			return array(
				'gallery' => fg_seed_gallery( 'F-mixed', 'Fixture mixed', $ids ),
				'images'  => $images,
				'video'   => $video,
				'youtube' => $youtube,
				'vimeo'   => $vimeo,
			);
		},

		'F-tagged' => function () {
			$tags      = array( 'Architecture', 'Sunset', 'Portrait', 'Street' );
			$people    = array( 'Ada Lovelace', 'Grace Hopper', 'Alan Turing' );
			$locations = array(
				array( 'Tel Aviv', 32.0853, 34.7818 ),
				array( 'Kyoto', 35.0116, 135.7681 ),
			);

			$items = array();
			foreach ( range( 1, 6 ) as $n ) {
				$items[] = fg_seed_attachment(
					fg_seed_draw( 1100, 800, 'jpeg', array( 'seed' => 800 + $n ) ),
					'F-tagged',
					array( 'alt' => 'Tagged item ' . $n )
				);
			}

			// The last two stay untagged on purpose - filters have to cope with
			// items carrying nothing.
			foreach ( array_slice( $items, 0, 4 ) as $i => $item ) {
				\FotoGrids\Metadata_Manager::add_tag_to_item( $item, $tags[ $i ] );
			}
			foreach ( array_slice( $items, 0, 3 ) as $i => $item ) {
				\FotoGrids\Metadata_Manager::add_person_to_item( $item, $people[ $i ] );
			}
			foreach ( array_slice( $items, 0, 2 ) as $i => $item ) {
				list( $name, $lat, $lon ) = $locations[ $i ];
				\FotoGrids\Metadata_Manager::add_location_to_item( $item, $name, $lat, $lon );
			}

			return array(
				'gallery'   => fg_seed_gallery( 'F-tagged', 'Fixture tagged', $items ),
				'items'     => $items,
				'tags'      => $tags,
				'people'    => $people,
				'locations' => array_column( $locations, 0 ),
			);
		},

		'F-album' => function () {
			$galleries = array();
			foreach ( range( 1, 3 ) as $n ) {
				$item        = fg_seed_attachment(
					fg_seed_draw( 1000, 700, 'jpeg', array( 'seed' => 900 + $n ) ),
					'F-album',
					array( 'alt' => 'Album child ' . $n )
				);
				$galleries[] = fg_seed_gallery( 'F-album', 'Fixture album child ' . $n, array( $item ) );
			}

			// The fourth has no items, so the cover resolver finds nothing to
			// show for it - the case where a child drops out of the album grid.
			$galleries[] = fg_seed_gallery( 'F-album', 'Fixture album child without cover' );

			return array(
				'album'     => fg_seed_album( 'F-album', 'Fixture album', $galleries ),
				'galleries' => $galleries,
				'coverless' => end( $galleries ),
			);
		},

		'F-album-multi' => function () {
			$item    = fg_seed_attachment(
				fg_seed_draw( 1000, 700, 'jpeg', array( 'seed' => 1000 ) ),
				'F-album-multi',
				array( 'alt' => 'In two albums' )
			);
			$gallery = fg_seed_gallery( 'F-album-multi', 'Fixture in two albums', array( $item ) );

			return array(
				'gallery' => $gallery,
				'albums'  => array(
					fg_seed_album( 'F-album-multi', 'Fixture album A', array( $gallery ) ),
					fg_seed_album( 'F-album-multi', 'Fixture album B', array( $gallery ) ),
				),
			);
		},

		'F-orphan' => function () {
			$embed = Embed_Store::create(
				array(
					'item_type'     => 'video_youtube',
					'video_id'      => 'aqz-KE-bpKQ',
					'url'           => 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
					'caption'       => 'Fixture orphan embed',
					'thumbnail_url' => '',
					'settings'      => array(),
				)
			);
			fg_seed_mark( $embed, 'F-orphan' );

			// Deliberately not appended to any gallery.
			return array( 'embed' => $embed );
		},

		'F-cjk' => function () {
			$rows = array(
				array( '東京の夕暮れ', 'Tokyo at dusk', '写真 1.jpg' ),
				array( 'ירושלים בבוקר', 'Jerusalem in the morning', 'תמונה 2.jpg' ),
				array( '京都の竹林', 'Kyoto bamboo', 'café photo.jpg' ),
			);

			$items = array();
			foreach ( $rows as $i => $row ) {
				list( $title, $caption, $filename ) = $row;
				$items[]                            = fg_seed_attachment(
					fg_seed_draw( 1000, 750, 'jpeg', array( 'seed' => 1100 + $i ) ),
					'F-cjk',
					array(
						'title'    => $title,
						'caption'  => $caption,
						'alt'      => $title,
						'filename' => $filename,
					)
				);
			}

			return array(
				'gallery' => fg_seed_gallery( 'F-cjk', 'フィクスチャ CJK', $items ),
				'items'   => $items,
			);
		},

		'F-huge' => function () {
			$big = fg_seed_attachment(
				fg_seed_draw( 8000, 6000, 'jpeg', array( 'seed' => 1200, 'quality' => 90 ) ),
				'F-huge',
				array( 'title' => 'Eight thousand wide', 'alt' => 'A very large JPEG' )
			);

			$target = (int) ( getenv( 'FG_SEED_HUGE_MB' ) ?: 40 );
			$heavy  = fg_seed_attachment(
				fg_seed_noise_png( $target ),
				'F-huge',
				array( 'title' => 'Heavy PNG', 'alt' => 'Incompressible noise' )
			);

			return array(
				'gallery' => fg_seed_gallery( 'F-huge', 'Fixture huge', array_filter( array( $big, $heavy ) ) ),
				'large'   => $big,
				'heavy'   => $heavy,
			);
		},

		'F-alpha' => function () {
			$png = fg_seed_attachment(
				fg_seed_draw( 900, 900, 'png', array( 'seed' => 1300, 'alpha' => true ) ),
				'F-alpha',
				array( 'title' => 'Transparent PNG', 'alt' => 'PNG with an alpha channel' )
			);

			$gif = fg_seed_attachment(
				fg_seed_animated_gif( 400, 300 ),
				'F-alpha',
				array( 'title' => 'Animated GIF', 'alt' => 'Two-frame animation', 'filename' => 'fixture-animated.gif' )
			);

			$webp = function_exists( 'imagewebp' )
				? fg_seed_attachment(
					fg_seed_draw( 900, 600, 'webp', array( 'seed' => 1400 ) ),
					'F-alpha',
					array( 'title' => 'WebP', 'alt' => 'A WebP image' )
				)
				: 0;

			return array(
				'gallery'  => fg_seed_gallery( 'F-alpha', 'Fixture alpha', array_filter( array( $png, $gif, $webp ) ) ),
				'png'      => $png,
				'gif'      => $gif,
				'webp'     => $webp,
			);
		},

		'F-draft' => function () {
			$item = fg_seed_attachment(
				fg_seed_draw( 1000, 700, 'jpeg', array( 'seed' => 500 ) ),
				'F-draft',
				array( 'alt' => 'Unpublished' )
			);

			$trashed = fg_seed_gallery( 'F-draft', 'Fixture trashed', array( $item ) );
			wp_trash_post( $trashed );

			return array(
				'draft'   => fg_seed_gallery( 'F-draft', 'Fixture draft', array( $item ), array(), array( 'post_status' => 'draft' ) ),
				'private' => fg_seed_gallery( 'F-draft', 'Fixture private', array( $item ), array(), array( 'post_status' => 'private' ) ),
				'trashed' => $trashed,
				'items'   => array( $item ),
			);
		},
	);
}

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

/**
 * Truncate the plugin's own tables and remove every collection post.
 *
 * Wider than a purge: it clears rows this seeder never wrote, which is what
 * `reset` is for. Only ever pointed at a throwaway site - boot.sh refuses any
 * other one.
 *
 * @return void
 */
function fg_seed_reset(): void {
	global $wpdb;

	foreach ( get_posts(
		array(
			'post_type'      => array( 'fotogrids_gallery', 'fotogrids_album', 'fotogrids_embed' ),
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		)
	) as $post_id ) {
		wp_delete_post( (int) $post_id, true );
	}

	foreach ( fg_seed_owned() as $post_id ) {
		wp_delete_post( (int) $post_id, true );
	}

	$tables = array(
		'fotogrids_item_meta',
		'fotogrids_item_metadata',
		'fotogrids_tags',
		'fotogrids_gallery_albums',
		'fotogrids_statistics',
		'fotogrids_statistics_daily',
		'fotogrids_render_cache',
	);

	fg_seed_forget();

	foreach ( $tables as $table ) {
		
		$wpdb->query( 'TRUNCATE TABLE ' . $wpdb->prefix . $table );
	}
}

$flags = array(
	'reset' => false,
	'only'  => array(),
	'out'   => '',
	'force' => false,
);

foreach ( (array) ( $args ?? array() ) as $arg ) {
	if ( 'reset' === $arg ) {
		$flags['reset'] = true;
	} elseif ( 'force' === $arg ) {
		$flags['force'] = true;
	} elseif ( 0 === strpos( $arg, 'only=' ) ) {
		$flags['only'] = array_filter( array_map( 'trim', explode( ',', substr( $arg, 5 ) ) ) );
	} elseif ( 0 === strpos( $arg, 'out=' ) ) {
		$flags['out'] = substr( $arg, 4 );
	}
}

$catalogue = fg_seed_catalogue();

if ( $flags['only'] ) {
	$unknown = array_diff( $flags['only'], array_keys( $catalogue ) );
	if ( $unknown ) {
		WP_CLI::error( 'unknown fixture key: ' . implode( ', ', $unknown ) );
	}
	$catalogue = array_intersect_key( $catalogue, array_flip( $flags['only'] ) );
}

if ( $flags['reset'] ) {
	fg_seed_reset();
	WP_CLI::log( 'reset: tables truncated, collection posts removed' );
}

$built   = array();
$skipped = 0;

foreach ( $catalogue as $key => $builder ) {
	if ( ! $flags['reset'] && ! $flags['force'] && fg_seed_is_current( $key ) ) {
		++$skipped;
		$built[ $key ] = fg_seed_existing( $key );
		continue;
	}

	fg_seed_purge( $key );
	$started       = microtime( true );
	$built[ $key ] = $builder();
	fg_seed_remember( $key, $built[ $key ] );
	WP_CLI::log( sprintf( '%-14s built in %.1fs', $key, microtime( true ) - $started ) );
}

if ( $skipped ) {
	WP_CLI::log( sprintf( '%d fixture set(s) already current, left alone', $skipped ) );
}

if ( $flags['out'] ) {
	file_put_contents( $flags['out'], wp_json_encode( $built, JSON_PRETTY_PRINT ) );
	WP_CLI::log( 'wrote ' . $flags['out'] );
}

WP_CLI::log( 'FGFIXTURES' . wp_json_encode( $built ) );
