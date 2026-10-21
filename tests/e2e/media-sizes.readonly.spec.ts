import { test, expect } from './support/test';
import { fixture, firstItem } from './support/fixtures';
import { wpEval } from './support/roles';

/**
 * The plugin's image sizes, read inside WordPress: what is registered, what an
 * upload produced, how the crop setting reaches WordPress, and which size a
 * render falls back to. Nothing here is written.
 */

type Registered = {
	width: number;
	height: number;
	crop: boolean | [string, string];
};

const SLUGS = [
	'fotogrids_thumbnail',
	'fotogrids_full',
	'fotogrids_full_mobile',
	'fotogrids_masonry',
	'fotogrids_justified',
];

function json<T>(code: string): T {
	return JSON.parse(wpEval(code)) as T;
}

/**
 * MED-01. Each of the five sizes is registered from the Media settings, and an
 * upload large enough for all of them got a file for each.
 */
test(
	'MED-01: the five plugin sizes are registered and an upload generates their files',
	{ tag: '@settings' },
	() => {
		const settings = json<Record<string, number>>(
			`echo wp_json_encode( \\FotoGrids\\Image_Size_Manager::get_plugin_size_settings() );`
		);
		const registered = json<Record<string, Registered>>(
			`echo wp_json_encode( wp_get_registered_image_subsizes() );`
		);

		expect(registered.fotogrids_thumbnail).toMatchObject({
			width: settings.thumbnail_width,
			height: settings.thumbnail_height,
		});
		expect(registered.fotogrids_full).toEqual({
			width: settings.full_width,
			height: settings.full_height,
			crop: false,
		});
		expect(registered.fotogrids_full_mobile).toEqual({
			width: Math.floor(settings.full_width / 2),
			height: 0,
			crop: false,
		});
		expect(registered.fotogrids_masonry).toEqual({
			width: settings.masonry_width,
			height: 0,
			crop: false,
		});
		expect(registered.fotogrids_justified).toEqual({
			width: 0,
			height: settings.justified_height,
			crop: false,
		});

		// F-exif is 3200x2400, larger than every one of them.
		const files = json<
			Record<string, { width: number; height: number; exists: boolean }>
		>(`
		$id = ${firstItem('F-exif')};
		$m  = wp_get_attachment_metadata( $id );
		$dir = trailingslashit( wp_get_upload_dir()['basedir'] ) . trailingslashit( dirname( $m['file'] ) );
		$out = array();
		foreach ( ${JSON.stringify(SLUGS).replace(/"/g, "'")} as $slug ) {
			$s = $m['sizes'][ $slug ] ?? null;
			$out[ $slug ] = $s ? array( 'width' => $s['width'], 'height' => $s['height'], 'exists' => file_exists( $dir . $s['file'] ) ) : null;
		}
		echo wp_json_encode( $out );
	`);

		for (const slug of SLUGS) {
			expect(files[slug], slug).toMatchObject({ exists: true });
		}
		expect(files.fotogrids_thumbnail).toMatchObject({
			width: settings.thumbnail_width,
			height: settings.thumbnail_height,
		});
		expect(files.fotogrids_full.width).toBe(settings.full_width);
		expect(files.fotogrids_full_mobile.width).toBe(
			Math.floor(settings.full_width / 2)
		);
		expect(files.fotogrids_masonry.width).toBe(settings.masonry_width);
		expect(files.fotogrids_justified.height).toBe(
			settings.justified_height
		);
	}
);

/**
 * MED-03. Hard crop registers WordPress's positional crop for each of the nine
 * alignments the Media tab offers, and that crop cuts from the matching edge;
 * soft crop registers no crop at all.
 */
test(
	'MED-03: hard crop maps the nine alignments to positional crops and soft crop to none',
	{ tag: '@settings' },
	() => {
		const expected: Record<string, [string, string]> = {
			'top-left': ['left', 'top'],
			top: ['center', 'top'],
			'top-right': ['right', 'top'],
			left: ['left', 'center'],
			center: ['center', 'center'],
			right: ['right', 'center'],
			'bottom-left': ['left', 'bottom'],
			bottom: ['center', 'bottom'],
			'bottom-right': ['right', 'bottom'],
		};

		// The stored option is replaced for this process only, then the sizes re-registered.
		const seen = json<
			Record<string, { crop: Registered['crop']; src: [number, number] }>
		>(`
		$out = array();
		foreach ( array_merge( ${JSON.stringify(Object.keys(expected)).replace(/"/g, "'")}, array( 'soft' ) ) as $align ) {
			$value = array( 'thumbnail_width' => 400, 'thumbnail_height' => 300, 'thumbnail_crop' => 'soft' !== $align, 'thumbnail_alignment' => 'soft' === $align ? 'top-left' : $align );
			$filter = function () use ( $value ) { return $value; };
			add_filter( 'pre_option_fotogrids_media_settings', $filter );
			\\FotoGrids\\Image_Size_Manager::add_image_sizes();
			remove_filter( 'pre_option_fotogrids_media_settings', $filter );
			$crop = wp_get_registered_image_subsizes()['fotogrids_thumbnail']['crop'];
			$dims = image_resize_dimensions( 1400, 900, 400, 300, $crop );
			$out[ $align ] = array( 'crop' => $crop, 'src' => array( $dims[2], $dims[3] ) );
		}
		echo wp_json_encode( $out );
	`);

		// A 1400x900 source cut to 4:3 keeps 1200x900: 200px of slack, all horizontal.
		const slack = (x: string) => ({ left: 0, center: 100, right: 200 })[x];

		for (const [align, crop] of Object.entries(expected)) {
			expect(seen[align].crop, align).toEqual(crop);
			expect(seen[align].src, align).toEqual([slack(crop[0]), 0]);
		}
		expect(seen.soft.crop).toBe(false);
	}
);

/**
 * MED-09. A size that is registered but has no file falls back along the
 * thumbnail chain (fotogrids_thumbnail, thumbnail, medium, full) and the
 * Lightbox chain (fotogrids_full, large, full).
 */
test(
	'MED-09: a size with no file falls back along its chain to the original',
	{ tag: '@layout' },
	() => {
		const id = fixture<number[]>('F-small', 'items')[0];
		const big = firstItem('F-exif');

		// Each case hides the listed subsizes from the metadata for this process only.
		const resolved = json<Record<string, string>>(`
		$cases = array(
			'thumb_all'      => array( 'fotogrids_thumbnail', 'thumbnail', array() ),
			'thumb_no_fg'    => array( 'fotogrids_thumbnail', 'thumbnail', array( 'fotogrids_thumbnail' ) ),
			'thumb_no_thumb' => array( 'fotogrids_thumbnail', 'thumbnail', array( 'fotogrids_thumbnail', 'thumbnail' ) ),
			'thumb_none'     => array( 'fotogrids_thumbnail', 'thumbnail', array( 'fotogrids_thumbnail', 'thumbnail', 'medium' ) ),
			'custom_missing' => array( 'custom', 'thumbnail', array( 'thumbnail' ), 'fotogrids_custom_1x1_crop' ),
			'named_missing'  => array( 'medium_large', 'thumbnail', array( 'medium_large', 'fotogrids_thumbnail' ) ),
			'full_fits'      => array( 'fotogrids_full', 'full', array() ),
			'full_all'       => array( 'fotogrids_full', 'full', array(), null, ${big} ),
			'full_no_fg'     => array( 'fotogrids_full', 'full', array( 'fotogrids_full' ), null, ${big} ),
			'full_none'      => array( 'fotogrids_full', 'full', array( 'fotogrids_full', 'large' ), null, ${big} ),
		);
		$out = array();
		foreach ( $cases as $name => $case ) {
			$hide   = $case[2];
			$filter = function ( $meta ) use ( $hide ) {
				foreach ( $hide as $slug ) { unset( $meta['sizes'][ $slug ] ); }
				return $meta;
			};
			add_filter( 'wp_get_attachment_metadata', $filter );
			$out[ $name ] = \\FotoGrids\\Image_Size_Manager::resolve_size( $case[4] ?? ${id}, $case[0], $case[1], $case[3] ?? null );
			remove_filter( 'wp_get_attachment_metadata', $filter );
		}
		echo wp_json_encode( $out );
	`);

		expect(resolved).toEqual({
			thumb_all: 'fotogrids_thumbnail',
			thumb_no_fg: 'thumbnail',
			thumb_no_thumb: 'medium',
			thumb_none: 'full',
			custom_missing: 'fotogrids_thumbnail',
			named_missing: 'thumbnail',
			// A 1400px original already fits fotogrids_full, so WordPress made none.
			full_fits: 'full',
			full_all: 'fotogrids_full',
			full_no_fg: 'large',
			full_none: 'full',
		});
	}
);
