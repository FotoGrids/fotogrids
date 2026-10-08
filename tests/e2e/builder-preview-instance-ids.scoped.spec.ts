import type { APIRequestContext, Frame, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { apiAs, storageStateFor, wpEval } from './support/roles';

/**
 * Instance IDs of builder previews.
 *
 * A builder preview renders each placement in its own request, so the preview
 * route takes the builder's element ID as `placement_key` and returns
 * `fg-{id}-p{key}`. Two placements of one collection must not share an ID, a
 * placement keeps its ID across re-renders, and published pages keep the
 * counter-based `fg-{id}-{n}`.
 *
 * Scoped: every gallery, album and post here is created by the test that reads it.
 */

type Preview = {
	instance_id: string;
	html: string;
	inlineCss?: string;
};

const PLACEMENT_ID = /^fg-\d+-p[a-z0-9]+$/;

async function preview(
	api: { context: APIRequestContext; nonce: string },
	kind: 'gallery' | 'album',
	id: number,
	placementKey?: unknown
): Promise< Preview > {
	const response = await api.context.post( `/wp-json/fotogrids/v1/preview/${ kind }/${ id }`, {
		headers: { 'X-WP-Nonce': api.nonce },
		data: {
			version: 2,
			preview_options: {},
			...( undefined === placementKey ? {} : { placement_key: placementKey } ),
		},
	} );
	expect( response.status() ).toBe( 200 );

	return response.json();
}

/** The `id` of the collection wrapper in a preview's markup. */
function wrapperId( body: Preview ): string | undefined {
	return body.html.match( /\sid="(fg-[^"]+)"/ )?.[ 1 ];
}

/** A post holding the given block markup, purged with the spec's collections. */
function blockPost( content: string ): number {
	const encoded = Buffer.from( content, 'utf8' ).toString( 'base64' );

	return Number(
		wpEval(
			`$id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Builder preview IDs', 'post_content' => base64_decode( '${ encoded }' ) ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo $id;`
		).trim()
	);
}

async function editorCanvas( page: Page ): Promise< Frame > {
	const handle = await page.waitForSelector( 'iframe[name="editor-canvas"]' );
	const frame = await handle.contentFrame();
	if ( ! frame ) {
		throw new Error( 'The block editor canvas has no frame.' );
	}

	return frame;
}

async function previewIds( frame: Frame ): Promise< string[] > {
	return frame.locator( '.fotogrids-collection' ).evaluateAll( ( nodes ) => nodes.map( ( node ) => node.id ) );
}

test.describe( 'the preview route', () => {
	test( 'gives two placements of one gallery different IDs', { tag: [ '@api', '@layout' ] }, async ( {
		playwright,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const api = await apiAs( playwright, 'administrator' );

		const first = await preview( api, 'gallery', id, 'abc123' );
		const second = await preview( api, 'gallery', id, 'def456' );

		expect( first.instance_id ).toBe( `fg-${ id }-pabc123` );
		expect( second.instance_id ).toBe( `fg-${ id }-pdef456` );
		expect( wrapperId( first ) ).toBe( first.instance_id );
		expect( wrapperId( second ) ).toBe( second.instance_id );
		expect( first.inlineCss ).toContain( `#${ first.instance_id }` );
		expect( second.inlineCss ).toContain( `#${ second.instance_id }` );
	} );

	test( 'gives two placements of one album different IDs', { tag: [ '@api', '@layout' ] }, async ( {
		playwright,
	} ) => {
		const child = galleryPage( { layout: 'grid' } );
		const { id } = album( [ child.id ], { layout: 'grid' } );
		const api = await apiAs( playwright, 'administrator' );

		const first = await preview( api, 'album', id, 'brx1a2' );
		const second = await preview( api, 'album', id, 'brx3b4' );

		expect( first.instance_id ).toBe( `fg-${ id }-pbrx1a2` );
		expect( second.instance_id ).toBe( `fg-${ id }-pbrx3b4` );
		expect( wrapperId( first ) ).toBe( first.instance_id );
	} );

	test( 'keeps a placement on the same ID across renders', { tag: [ '@api', '@layout' ] }, async ( {
		playwright,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const api = await apiAs( playwright, 'administrator' );

		const before = await preview( api, 'gallery', id, 'Block-9F3E' );
		const after = await preview( api, 'gallery', id, 'Block-9F3E' );

		expect( before.instance_id ).toBe( `fg-${ id }-pblock9f3e` );
		expect( after.instance_id ).toBe( before.instance_id );
	} );

	test( 'changes only the ID when a placement key is sent', { tag: [ '@api', '@layout' ] }, async ( {
		playwright,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const api = await apiAs( playwright, 'administrator' );

		const keyed = await preview( api, 'gallery', id, 'zz9' );
		const unkeyed = await preview( api, 'gallery', id );
		const strip = ( body: Preview ) => body.html.split( body.instance_id ).join( 'ID' );

		expect( strip( keyed ) ).toBe( strip( unkeyed ) );
	} );

	test( 'falls back to the counter without a usable key', { tag: [ '@api', '@layout' ] }, async ( {
		playwright,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' } );
		const api = await apiAs( playwright, 'administrator' );

		expect( ( await preview( api, 'gallery', id ) ).instance_id ).toBe( `fg-${ id }-1` );
		expect( ( await preview( api, 'gallery', id, '---' ) ).instance_id ).toBe( `fg-${ id }-1` );
		expect( ( await preview( api, 'gallery', id, '"><b>' ) ).instance_id ).toBe( `fg-${ id }-pb` );
	} );
} );

test.describe( 'the block editor', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'gives each block of one collection its own instance ID and styles', { tag: [ '@admin', '@layout' ] }, async ( {
		page,
	} ) => {
		const gallery = galleryPage( { layout: 'grid' } );
		const { id: albumId } = album( [ gallery.id ], { layout: 'grid' } );
		const block = ( name: string, attrs: Record< string, number > ) =>
			`<!-- wp:fotogrids/${ name } ${ JSON.stringify( attrs ) } /-->`;
		const post = blockPost(
			[
				block( 'gallery', { galleryId: gallery.id } ),
				block( 'gallery', { galleryId: gallery.id } ),
				block( 'album', { albumId } ),
				block( 'album', { albumId } ),
			].join( '\n\n' )
		);

		await page.goto( `/wp-admin/post.php?post=${ post }&action=edit` );
		const canvas = await editorCanvas( page );
		await expect( canvas.locator( '.fotogrids-collection' ) ).toHaveCount( 4 );

		const ids = await previewIds( canvas );
		expect( new Set( ids ).size ).toBe( 4 );
		for ( const id of ids ) {
			expect( id ).toMatch( PLACEMENT_ID );
			await expect( canvas.locator( `style[data-fotogrids-preview-inline-css="${ id }"]` ) ).toHaveCount( 1 );
		}

		await page.evaluate(
			"wp.data.dispatch( 'core/block-editor' ).duplicateBlocks( [ wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ].clientId ] )"
		);
		await expect( canvas.locator( '.fotogrids-collection' ) ).toHaveCount( 5 );
		await expect( canvas.locator( 'style[data-fotogrids-preview-inline-css]' ) ).toHaveCount( 5 );

		const afterDuplicate = await previewIds( canvas );
		expect( new Set( afterDuplicate ).size ).toBe( 5 );
		expect( afterDuplicate ).toEqual( expect.arrayContaining( ids ) );
	} );
} );

test( 'a published page keeps counter-based instance IDs', { tag: [ '@layout' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { layout: 'grid' } );

	await page.goto( url );
	const wrapper = page.locator( `.fotogrids-collection[data-fg-gallery-id="${ id }"]` );
	await expect( wrapper ).toHaveCount( 1 );
	await expect( wrapper ).toHaveAttribute( 'id', new RegExp( `^fg-${ id }-\\d+$` ) );
} );
