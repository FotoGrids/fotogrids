import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';

/**
 * Caption colours left unset follow the placement: white over the image,
 * the theme's text colour above or below it.
 */

const WHITE = 'rgb(255, 255, 255)';

async function titleColor( gallery: GalleryRender ): Promise< string > {
	return gallery.root
		.locator( '.fg-caption-title' )
		.first()
		.evaluate( ( element ) => getComputedStyle( element ).color );
}

async function surroundingColor( gallery: GalleryRender ): Promise< string > {
	return gallery.root.evaluate(
		( element ) => getComputedStyle( element ).color
	);
}

test( 'an overlay caption title is white by default', { tag: [ '@settings', '@layout' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { layout: 'grid', caption_placement: 'overlay' } );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await titleColor( gallery ) ).toBe( WHITE );
} );

for ( const placement of [ 'top', 'bottom' ] ) {
	test( `a ${ placement } caption title takes the theme text colour by default`, { tag: [ '@settings', '@layout' ] }, async ( {
		page,
	} ) => {
		const { id, url } = galleryPage( { layout: 'grid', caption_placement: placement } );
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		await gallery.waitFor();

		const color = await titleColor( gallery );
		expect( color ).not.toBe( WHITE );
		expect( color ).toBe( await surroundingColor( gallery ) );
	} );
}

test( 'a chosen caption title colour is kept below the image', { tag: [ '@settings', '@layout' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( {
		layout: 'grid',
		caption_placement: 'bottom',
		caption_title_color: 'rgba(200, 30, 30, 1)',
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	expect( await titleColor( gallery ) ).toBe( 'rgb(200, 30, 30)' );
} );
