import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { fixture } from './support/fixtures';
import { wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * A password gallery that does not remember the visitor stays unlocked for
 * the rest of the page, and only for that page.
 *
 * Scoped: every gallery here is created by the spec.
 */

const PASSWORD = 'unlock-page-secret';

/** Twelve items, six per page, behind a password that is not remembered. */
function passwordGallery( settings: Settings = {} ): { id: number; url: string } {
	const created = galleryPage(
		{
			layout: 'grid',
			password_protect: true,
			password_remember: false,
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: { desktop: 6, tablet: 6, mobile: 6 },
			...settings,
		},
		fixture< number[] >( 'F-large', 'items' ).slice( 0, 12 )
	);

	wpEval(
		`update_post_meta( ${ created.id }, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( '${ PASSWORD }' ) );`
	);

	return created;
}

function unlockRoute( galleryId: number ): string {
	return `/?rest_route=${ encodeURIComponent( `/fotogrids/v1/gallery/${ galleryId }/unlock` ) }`;
}

async function unlockThroughForm( page: Page, gallery: GalleryRender ): Promise< void > {
	await page.locator( '.fg-lock-input' ).fill( PASSWORD );
	await page.locator( '.fg-lock-submit' ).click();
	await expect( gallery.items() ).toHaveCount( 6 );
}

test( 'Load More pages an unlocked gallery, and a reload locks it again', { tag: '@gate' }, async ( {
	page,
} ) => {
	const { id, url } = passwordGallery();
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await unlockThroughForm( page, gallery );

	await page.locator( '[data-fg-pagination-trigger="load-more"]' ).click();
	await expect( gallery.items() ).toHaveCount( 12 );

	const cookies = await page.context().cookies();
	expect( cookies.some( ( cookie ) => cookie.name === `fotogrids_unlocked_${ id }` ) ).toBe( false );

	await page.reload();
	await expect( page.locator( '.fg-lock-form' ) ).toBeVisible();
	await expect( gallery.items() ).toHaveCount( 0 );
} );

test( 'the lightbox loads items beyond the first page of an unlocked gallery', { tag: [ '@gate', '@lightbox' ] }, async ( {
	page,
} ) => {
	const { id, url } = passwordGallery( { lightbox_show_dots: true } );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await unlockThroughForm( page, gallery );

	const slides = page.waitForResponse( ( response ) =>
		decodeURIComponent( response.url() ).includes( '/fotogrids/v1/gallery/lightbox/slides' )
	);
	await lightbox.openFrom( gallery, 5 );
	expect( ( await slides ).status() ).toBe( 200 );

	await lightbox.goNext();
	expect( await lightbox.index() ).toBe( 6 );
	await expect( lightbox.image() ).toHaveJSProperty( 'complete', true );
} );

test( 'an unlock token opens only its own gallery, and only unaltered', { tag: [ '@gate', '@api' ] }, async ( {
	request,
} ) => {
	const first = passwordGallery();
	const second = passwordGallery();

	const unlock = await request.post( unlockRoute( first.id ), { data: { password: PASSWORD } } );
	expect( unlock.status() ).toBe( 200 );
	const token: string = ( await unlock.json() ).unlockToken;
	expect( token ).toMatch( /^\d+\.[0-9a-f]{64}$/ );

	const [ expires, signature ] = token.split( '.' );
	const opens = async ( galleryId: number, unlockToken: string ): Promise< boolean > => {
		const response = await request.post(
			`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/gallery/render' ) }`,
			{
				headers: { 'X-FotoGrids-Unlock': unlockToken },
				data: { gallery_id: galleryId, page: 2, partial: 'items_only' },
			}
		);
		expect( response.status() ).toBe( 200 );
		return ! ( ( await response.json() ).html as string ).includes( 'class="fotogrids-gate"' );
	};

	expect( await opens( first.id, token ) ).toBe( true );
	expect( await opens( second.id, token ) ).toBe( false );
	expect( await opens( first.id, `${ Number( expires ) + 60 }.${ signature }` ) ).toBe( false );
} );
