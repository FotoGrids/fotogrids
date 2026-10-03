import { test, expect } from './support/test';
import { galleryPage, setSettings } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { expectNoText, expectStable, pinSite, restoreSite, settle } from './support/visual';
import type { SiteState } from './support/visual';

/**
 * Per-layout baselines at three viewports.
 *
 * Serial: the theme and the Google-fonts setting are site-wide, and both are
 * put back.
 *
 * Baselines live in tests/e2e/__screenshots__/<platform>/ and are produced by
 * the "Visual baselines" workflow, never by a local --update-snapshots: text
 * rasterises with the host's fonts, so a shot taken anywhere but the runner
 * that gates on it is a different picture.
 */

test.describe.configure( { mode: 'serial' } );

const VIEWPORTS = {
	desktop: { width: 1280, height: 900 },
	tablet: { width: 820, height: 1100 },
	mobile: { width: 390, height: 844 },
} as const;

// No caption text: it would rasterise with whatever fonts the host has, which
// is the one thing a committed baseline cannot carry between machines.
const SETTINGS = {
	columns: { desktop: 3, tablet: 2, mobile: 1 },
	caption_hide_title: true,
	caption_hide_description: true,
};

let site: SiteState;

test.beforeAll( () => {
	site = pinSite();
} );

test.afterAll( () => {
	restoreSite( site );
} );

for ( const layout of [ 'grid', 'masonry' ] as const ) {
	for ( const [ name, viewport ] of Object.entries( VIEWPORTS ) ) {
		test( `${ layout } at ${ name }`, { tag: '@visual' }, async ( { page } ) => {
			await page.setViewportSize( viewport );

			const { id, url } = galleryPage( { layout, ...SETTINGS } );
			const gallery = new GalleryRender( page, id );

			await page.goto( url );
			await gallery.waitFor();

			const target = page.locator( '.fotogrids-gallery' ).first();

			await expectNoText( target );
			await expectStable( page, target, `${ layout }-${ name }` );
		} );
	}
}

/**
 * The baselines are only worth having if a settled render is reproducible, so
 * this asserts that directly rather than trusting the ones above to notice.
 */
test( 'a settled render is identical twice over', { tag: '@visual' }, async ( { page } ) => {
	await page.setViewportSize( VIEWPORTS.desktop );

	const { id, url } = galleryPage( { layout: 'grid', ...SETTINGS } );
	const gallery = new GalleryRender( page, id );
	const target = page.locator( '.fotogrids-gallery' ).first();

	await page.goto( url );
	await gallery.waitFor();
	await settle( page, target );
	const first = await target.screenshot();

	await page.reload();
	await gallery.waitFor();
	await settle( page, target );
	const second = await target.screenshot();

	expect( second.equals( first ), 'the same render produced two different pictures' ).toBe(
		true
	);
} );

/** A changed setting must move the pixels, or a baseline proves nothing. */
test( 'a layout change is visible to the comparison', { tag: '@visual' }, async ( {
	page,
} ) => {
	await page.setViewportSize( VIEWPORTS.desktop );

	const { id, url } = galleryPage( { layout: 'grid', ...SETTINGS } );
	const gallery = new GalleryRender( page, id );
	const target = page.locator( '.fotogrids-gallery' ).first();

	await page.goto( url );
	await gallery.waitFor();
	await settle( page, target );
	const threeColumns = await target.screenshot();

	setSettings( id, { layout: 'grid', ...SETTINGS, columns: { desktop: 2, tablet: 2, mobile: 1 } } );

	await page.goto( url );
	await gallery.waitFor();
	await settle( page, target );
	const twoColumns = await target.screenshot();

	expect(
		twoColumns.equals( threeColumns ),
		'dropping a column changed nothing, so these screenshots cannot catch a layout regression'
	).toBe( false );
} );
