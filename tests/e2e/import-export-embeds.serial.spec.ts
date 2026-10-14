import { execFileSync } from 'child_process';
import type { Page, PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage, pageFor } from './support/collections';
import { firstItem } from './support/fixtures';
import { GalleryEditor } from './support/gallery-editor';
import { GalleryRender } from './support/gallery-render';
import { apiAs, storageStateFor, wpCli, wpEval } from './support/roles';
import { ADMIN, ScratchSite, scratchSitesAvailable } from './support/scratch-site';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Tools > Import / Export: a gallery's YouTube and Vimeo embeds through an
 * export and an import, read back in the gallery editor, on the front end and
 * on a second WordPress that never had them.
 *
 * Serial: the tests share one gallery, its embeds and the export taken in the
 * first test, and an import writes the operation log, which is put back.
 */

test.describe.configure( { mode: 'serial' } );

const SCREEN = '/wp-admin/admin.php?page=fotogrids-tools&tool=import-export';
const EXPORT_ROUTE = '/wp-json/fotogrids/v1/admin/tools/import-export/export';
const IMPORT_ROUTE = '/fotogrids/v1/admin/tools/import-export/import';
const LOG_OPTION = 'fotogrids_import_export_log';

type Embed = {
	id: number;
	item_type: string;
	video_id: string;
	url: string;
	caption: string;
	thumbnail_url: string;
	settings: Record< string, boolean | number >;
	poster_id: number;
	poster_url: string;
};
type ExportFile = Record< string, unknown > & {
	meta: Record< string, unknown >;
	galleries: Array< { id: number; title: string } & Record< string, unknown > >;
	items: Array< Record< string, unknown > & { attachment_id: number | string } >;
	embeds: Array< Embed & { poster_src: string } >;
};
type Choice = 'skip' | 'overwrite' | 'duplicate';

const CHOICES: Record< Choice, string > = {
	skip: 'Skip existing',
	overwrite: 'Overwrite',
	duplicate: 'Duplicate',
};

const YOUTUBE = {
	item_type: 'video_youtube',
	video_id: 'aqz-KE-bpKQ',
	url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
	caption: 'Harbour timelapse',
	thumbnail_url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
	settings: { autoplay: true, mute: true, loop: false, controls: true, start_time: 30 },
};

const VIMEO = {
	item_type: 'video_vimeo',
	video_id: '1084537',
	url: 'https://vimeo.com/1084537',
	caption: 'Pier at dusk',
	thumbnail_url: '',
	settings: { autoplay: false, loop: true, controls: false },
};

function phpValue( value: unknown ): string {
	return `json_decode( base64_decode( '${ Buffer.from( JSON.stringify( value ) ).toString( 'base64' ) }' ), true )`;
}

/** A new attachment, a copy of a seeded image, so no other gallery lists it. */
function attachment(): number {
	return Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$path = $up['path'] . '/' . wp_unique_filename( $up['path'], 'fg-embeds.jpg' );
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$id = wp_insert_attachment( array( 'post_mime_type' => 'image/jpeg', 'post_title' => 'Embeds poster', 'post_status' => 'inherit' ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			echo $id;
		` ).trim()
	);
}

function embed( data: Record< string, unknown > ): number {
	return Number( wpEval( `echo \\FotoGrids\\Galleries\\Embed_Store::create( ${ phpValue( data ) } );` ) );
}

function itemsOf( gallery: number ): number[] {
	return JSON.parse(
		wpEval( `echo wp_json_encode( \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${ gallery } ) );` )
	);
}

function embedOf( id: number ): Embed | null {
	return JSON.parse( wpEval( `echo wp_json_encode( \\FotoGrids\\Galleries\\Embed_Store::get( ${ id } ) );` ) );
}

function owners( id: number ): number[] {
	return JSON.parse(
		wpEval( `echo wp_json_encode( \\FotoGrids\\Galleries\\Gallery_Repository::find_galleries_for_item( ${ id } ) );` )
	);
}

/** Embed posts carrying one of this spec's captions. */
function ownEmbeds(): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', get_posts( array( 'post_type' => 'fotogrids_embed', 'post_status' => 'any', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC', 'fields' => 'ids' ) ) ) );`
		)
	).filter( ( id: number ) => [ YOUTUBE.caption, VIMEO.caption ].includes( embedOf( id )?.caption ?? '' ) );
}

function galleriesTitled( title: string ): number[] {
	return JSON.parse(
		wpEval(
			`echo wp_json_encode( array_map( 'intval', get_posts( array( 'post_type' => 'fotogrids_gallery', 'title' => ${ phpValue( title ) }, 'post_status' => 'any', 'fields' => 'ids', 'numberposts' => -1, 'orderby' => 'ID', 'order' => 'ASC' ) ) ) );`
		)
	);
}

/** Remove the galleries and embeds, as on a site that has the media but not the gallery. */
function forget(): void {
	const ids = [ ...galleriesTitled( title ), ...ownEmbeds() ];
	if ( ids.length ) {
		wpEval( `foreach ( array( ${ ids.join( ',' ) } ) as $id ) { wp_delete_post( $id, true ); }` );
	}
}

/** The embed's stored data, without its id. */
function data( item: Embed | null ): Omit< Embed, 'id' > {
	const { id: _id, ...rest } = item as Embed;

	return rest;
}

function readLog(): string | null {
	try {
		return execFileSync( wpCli(), [ 'option', 'get', LOG_OPTION, '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} ).trim();
	} catch {
		return null;
	}
}

function writeLog( value: string | null ): void {
	if ( null === value ) {
		execFileSync( wpCli(), [ 'option', 'delete', LOG_OPTION ], { encoding: 'utf8' } );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', LOG_OPTION, '--format=json', value ], {
		encoding: 'utf8',
	} );
}

async function exportFile(
	playwright: PlaywrightWorkerArgs[ 'playwright' ],
	format: 'json' | 'xml'
): Promise< string > {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.get( `${ EXPORT_ROUTE }?include[]=galleries&include[]=items&format=${ format }`, {
		headers: { 'X-WP-Nonce': nonce },
	} );
	expect( response.status() ).toBe( 200 );
	const body = await response.text();
	await context.dispose();

	return body;
}

/** Upload a file on the Import tab of the site at `base` and import it. */
async function importThroughUi(
	page: Page,
	body: string,
	choice: Choice = 'skip',
	format: 'json' | 'xml' = 'json',
	base = ''
): Promise< Record< string, Record< string, number > > > {
	await page.goto( `${ base }${ SCREEN }` );
	await page.getByRole( 'tab', { name: 'Import' } ).click();

	const isPhase = ( phase: string ) => ( r: { url(): string; request(): { postDataJSON(): { phase?: string } | null } } ) =>
		decodeURIComponent( r.url() ).includes( IMPORT_ROUTE ) && phase === r.request().postDataJSON()?.phase;

	const analysed = page.waitForResponse( isPhase( 'analyse' ) );
	await page.locator( '#fg-ie-import-file' ).setInputFiles( {
		name: `fotogrids-export.${ format }`,
		mimeType: 'xml' === format ? 'application/xml' : 'application/json',
		buffer: Buffer.from( body ),
	} );
	await analysed;

	await page
		.getByRole( 'radiogroup', { name: 'Galleries conflict handling' } )
		.getByRole( 'radio', { name: CHOICES[ choice ] } )
		.click();

	const executed = page.waitForResponse( isPhase( 'execute' ) );
	await page.getByRole( 'button', { name: 'Import', exact: true } ).click();
	const response = await executed;
	expect( response.status() ).toBe( 200 );

	return response.json();
}

let image: number;
let gallery: number;
let youtube: number;
let vimeo: number;
let title: string;
let file: ExportFile;
let log: string | null;

test.beforeAll( () => {
	log = readLog();
	image = attachment();
	youtube = embed( YOUTUBE );
	vimeo = embed( { ...VIMEO, poster_id: image } );
	title = `Embeds ${ Date.now() }`;
	gallery = galleryPage( {}, [ image, youtube, vimeo ], title ).id;
} );

test.afterAll( () => {
	writeLog( log );
	forget();
	wpEval( `wp_delete_attachment( ${ image }, true );` );
} );

test( 'the export carries each embed in a gallery with its link, caption, playback settings and poster', { tag: [ '@admin', '@api' ] }, async ( {
	playwright,
} ) => {
	const data: ExportFile = JSON.parse( await exportFile( playwright, 'json' ) );
	const byId = new Map( data.embeds.map( ( item ) => [ Number( item.id ), item ] ) );

	expect( byId.get( youtube ) ).toMatchObject( YOUTUBE );
	expect( byId.get( vimeo ) ).toMatchObject( { ...VIMEO, poster_id: image } );
	expect( byId.get( vimeo )?.poster_src ).toContain( 'fg-embeds' );

	file = {
		meta: data.meta,
		galleries: data.galleries.filter( ( g ) => g.title === title ),
		items: data.items.filter( ( item ) => Number( item.attachment_id ) === image ),
		embeds: data.embeds.filter( ( item ) => [ youtube, vimeo ].includes( Number( item.id ) ) ),
	};
	expect( file.galleries ).toHaveLength( 1 );
	expect( file.embeds ).toHaveLength( 2 );
} );

test( 'importing on a site without the gallery recreates its embeds in place, and they play', { tag: [ '@admin', '@api' ] }, async ( {
	page,
} ) => {
	const before = { youtube: embedOf( youtube ), vimeo: embedOf( vimeo ) };
	forget();

	const result = await importThroughUi( page, JSON.stringify( file ) );
	expect( result.imported ).toMatchObject( { galleries: 1, items: 3 } );

	[ gallery ] = galleriesTitled( title );
	adopt( gallery );
	const items = itemsOf( gallery );
	expect( items ).toHaveLength( 3 );
	expect( items[ 0 ] ).toBe( image );
	[ , youtube, vimeo ] = items;
	expect( data( embedOf( youtube ) ) ).toEqual( data( before.youtube ) );
	expect( data( embedOf( vimeo ) ) ).toEqual( data( before.vimeo ) );
	expect( owners( youtube ) ).toEqual( [ gallery ] );

	const editor = new GalleryEditor( page );
	await editor.open( gallery );
	expect( await editor.itemOrder() ).toEqual( items.map( String ) );

	const render = new GalleryRender( page, gallery );
	await page.goto( pageFor( gallery ).url );
	await render.waitFor();
	const video = render.root.locator( '.fg-video[data-fg-embed-provider="youtube"]' );
	await expect( video ).toHaveAttribute( 'data-fg-embed-id', YOUTUBE.video_id );
	await video.click();
	const src = await render.root.locator( 'iframe' ).first().getAttribute( 'src' );
	expect( src ).toContain( `/embed/${ YOUTUBE.video_id }` );
	expect( src ).toContain( 'start=30' );
	expect( src ).toContain( 'mute=1' );
} );

test( 'an XML file brings the embeds back with every setting, the switched-off ones included', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const xml = await exportFile( playwright, 'xml' );
	const before = { youtube: embedOf( youtube ), vimeo: embedOf( vimeo ) };
	forget();

	await importThroughUi( page, xml, 'skip', 'xml' );

	[ gallery ] = galleriesTitled( title );
	adopt( gallery );
	[ , youtube, vimeo ] = itemsOf( gallery );
	expect( data( embedOf( youtube ) ) ).toEqual( data( before.youtube ) );
	expect( data( embedOf( vimeo ) ) ).toEqual( data( before.vimeo ) );
	expect( embedOf( vimeo )?.settings ).toMatchObject( { loop: true, controls: false } );
} );

test( 'Overwrite on the same site keeps the gallery\'s embeds and adds none', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const current = JSON.parse( await exportFile( playwright, 'json' ) ) as ExportFile;
	const own = { ...current, galleries: current.galleries.filter( ( g ) => g.title === title ) };
	const embeds = ownEmbeds();

	await importThroughUi( page, JSON.stringify( own ), 'overwrite' );

	expect( galleriesTitled( title ) ).toEqual( [ gallery ] );
	expect( itemsOf( gallery ) ).toEqual( [ image, youtube, vimeo ] );
	expect( ownEmbeds() ).toEqual( embeds );
} );

test( 'Duplicate gives the copy embeds of its own, so removing one from the copy leaves the original\'s', { tag: [ '@admin', '@api' ] }, async ( {
	page,
	playwright,
} ) => {
	const current = JSON.parse( await exportFile( playwright, 'json' ) ) as ExportFile;
	const own = { ...current, galleries: current.galleries.filter( ( g ) => g.title === title ) };

	await importThroughUi( page, JSON.stringify( own ), 'duplicate' );

	const copy = galleriesTitled( title ).find( ( id ) => id !== gallery ) as number;
	adopt( copy );
	const copied = itemsOf( copy );
	expect( copied ).toHaveLength( 3 );
	expect( copied.slice( 1 ) ).not.toContain( youtube );
	expect( copied.slice( 1 ) ).not.toContain( vimeo );
	expect( owners( copied[ 1 ] ) ).toEqual( [ copy ] );
	expect( owners( youtube ) ).toEqual( [ gallery ] );

	const editor = new GalleryEditor( page );
	await editor.open( copy );
	await editor.item( copied[ 1 ] ).hover();
	await editor.removeItem( copied[ 1 ] ).click();
	await expect( editor.item( copied[ 1 ] ) ).toHaveCount( 0 );
	await expect.poll( () => embedOf( copied[ 1 ] ) ).toBeNull();

	expect( itemsOf( gallery ) ).toEqual( [ image, youtube, vimeo ] );
	expect( embedOf( youtube )?.video_id ).toBe( YOUTUBE.video_id );
} );

test.describe( 'on another WordPress', () => {
	test.skip( ! scratchSitesAvailable(), 'needs the ci-mode harness, which can build a scratch WordPress' );

	let site: ScratchSite;

	test.beforeAll( async ( {}, testInfo ) => {
		testInfo.setTimeout( 300_000 );
		site = await new ScratchSite( 'import_embeds' ).create();
		site.wp( 'transient', 'delete', 'fotogrids_activation_redirect' );
	} );

	test.afterAll( () => {
		site?.destroy();
	} );

	test( 'a site without the gallery\'s media gets its embeds, each owned by the imported gallery alone, and the poster by its URL', { tag: [ '@admin', '@api' ] }, async ( {
		browser,
	} ) => {
		const context = await browser.newContext( { storageState: { cookies: [], origins: [] } } );
		const page = await context.newPage();
		await page.goto( `${ site.url }/wp-login.php` );
		await page.fill( '#user_login', ADMIN.user );
		await page.fill( '#user_pass', ADMIN.pass );
		await page.click( '#wp-submit' );
		await page.waitForURL( /wp-admin/ );

		const result = await importThroughUi( page, JSON.stringify( file ), 'skip', 'json', site.url );
		expect( result.imported ).toMatchObject( { galleries: 1, items: 2 } );
		await context.close();

		const remote = JSON.parse(
			site.wp( 'eval', `
				$g     = get_posts( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids' ) )[0];
				$items = \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( $g );
				$out   = array( 'gallery' => $g, 'items' => array() );
				foreach ( $items as $id ) {
					$out['items'][] = array(
						'type'   => get_post_type( $id ),
						'embed'  => \\FotoGrids\\Galleries\\Embed_Store::get( $id ),
						'owners' => \\FotoGrids\\Galleries\\Gallery_Repository::find_galleries_for_item( $id ),
					);
				}
				echo wp_json_encode( $out );
			` )
		);

		const embeds = remote.items.filter( ( item: { type: string } ) => 'fotogrids_embed' === item.type );
		expect( embeds ).toHaveLength( 2 );
		for ( const item of embeds ) {
			expect( item.owners ).toEqual( [ remote.gallery ] );
		}
		expect( embeds[ 0 ].embed ).toMatchObject( YOUTUBE );
		expect( embeds[ 1 ].embed ).toMatchObject( { ...VIMEO, poster_id: 0 } );
		expect( embeds[ 1 ].embed.poster_url ).toBe( file.embeds[ 1 ].poster_src );
		expect( site.phpErrors() ).toEqual( [] );
	} );
} );
