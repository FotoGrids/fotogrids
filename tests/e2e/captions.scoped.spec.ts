import { readFileSync } from 'fs';
import path from 'path';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import type { Locator, Page } from '@playwright/test';

/**
 * Whether a visitor can see a thumbnail caption: whether one is rendered, where
 * it sits, when it shows, whether it can be read and how much of it fits.
 *
 * Scoped: every gallery and page here is created by the test that reads it.
 */

const WHITE = 'rgb(255, 255, 255)';
const WHITE_70 = 'rgba(255, 255, 255, 0.7)';
const CAPTION_EFFECTS = [ 'caption-fade', 'caption-rise', 'caption-slide', 'caption-split', 'spotlight' ];
const HOVER_ONLY: Array< Record< string, string > > = [ { caption_visibility: 'show_on_hover' }, ...CAPTION_EFFECTS.map( ( effect ) => ( { hover_effect: effect } ) ) ];

type Box = { x: number; y: number; width: number; height: number };

function small(): number[] {
	return fixture< number[] >( 'F-small', 'items' );
}

async function open( page: Page, settings: Record< string, unknown >, items?: number[] ): Promise< GalleryRender > {
	const { id, url } = galleryPage( { layout: 'grid', ...settings }, items );
	const gallery = new GalleryRender( page, id );
	await page.goto( url );
	await gallery.waitFor();
	return gallery;
}

function firstItem( gallery: GalleryRender ): Locator {
	return gallery.items().first();
}

function color( locator: Locator ): Promise< string > {
	return locator.evaluate( ( element ) => getComputedStyle( element ).color );
}

/** The lowest opacity on the path from the caption to its title, which is what the eye gets. */
function captionOpacity( item: Locator ): Promise< number > {
	return item.evaluate( ( element ) => {
		const caption = element.querySelector( '.fg-caption' );
		if ( ! caption ) {
			return -1;
		}
		const parts = [ caption, caption.querySelector( '.fg-caption-content' ), caption.querySelector( '.fg-caption-title' ) ];
		return Math.min( ...parts.filter( Boolean ).map( ( part ) => Number( getComputedStyle( part as Element ).opacity ) ) );
	} );
}

async function expectShown( item: Locator ): Promise< void > {
	await expect.poll( () => captionOpacity( item ) ).toBeGreaterThan( 0.95 );
}

async function expectHidden( item: Locator ): Promise< void > {
	await expect.poll( () => captionOpacity( item ) ).toBeLessThan( 0.05 );
}

async function box( locator: Locator ): Promise< Box > {
	const rect = await locator.boundingBox();
	expect( rect, 'element has a layout box' ).not.toBeNull();
	return rect as Box;
}

/** Composite a colour over another, so a translucent caption colour can be compared with the text colour it was made from. */
function parse( css: string ): number[] {
	const srgb = css.match( /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/ );
	if ( srgb ) {
		return [ Number( srgb[ 1 ] ) * 255, Number( srgb[ 2 ] ) * 255, Number( srgb[ 3 ] ) * 255, srgb[ 4 ] ? Number( srgb[ 4 ] ) : 1 ];
	}
	const rgb = css.match( /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/ );
	expect( rgb, `parsable colour: ${ css }` ).not.toBeNull();
	return [ Number( rgb![ 1 ] ), Number( rgb![ 2 ] ), Number( rgb![ 3 ] ), rgb![ 4 ] ? Number( rgb![ 4 ] ) : 1 ];
}

test.describe( 'whether there is a caption', () => {
	test( 'CAP-01: every item with text gets a caption with its title and description', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {} );

		await expect( gallery.root.locator( 'figcaption.fg-caption' ) ).toHaveCount( 5 );
		await expect( gallery.root.locator( '.fg-caption-title' ).first() ).toHaveText( 'Small 1' );
		await expect( gallery.root.locator( '.fg-caption-description' ).first() ).toHaveText( 'Caption for item 1' );
	} );

	test( 'CAP-02: Hide Title leaves only the description', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_hide_title: true } );

		await expect( gallery.root.locator( '.fg-caption-title' ) ).toHaveCount( 0 );
		await expect( gallery.root.locator( '.fg-caption-description' ) ).toHaveCount( 5 );
	} );

	test( 'CAP-03: Hide Description leaves only the title', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_hide_description: true } );

		await expect( gallery.root.locator( '.fg-caption-description' ) ).toHaveCount( 0 );
		await expect( gallery.root.locator( '.fg-caption-title' ) ).toHaveCount( 5 );
	} );

	test( 'CAP-05: an item with no text gets no caption box while the others keep theirs', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const images = fixture< number[] >( 'F-mixed', 'images' );
		const gallery = await open( page, {}, [ images[ 0 ], small()[ 0 ] ] );

		await expect( gallery.items() ).toHaveCount( 2 );
		await expect( gallery.items().nth( 0 ).locator( '.fg-caption' ) ).toHaveCount( 0 );
		await expect( gallery.items().nth( 1 ).locator( '.fg-caption' ) ).toHaveCount( 1 );
	} );

	for ( const [ source, expected ] of [
		[ 'item_caption', 'Caption for item 1' ],
		[ 'item_alt', 'Test image 1, landscape' ],
		[ 'item_description', 'Description for item 1.' ],
	] ) {
		test( `CAP-06: Title Source ${ source } shows that field as the title`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { caption_title_source: source, caption_hide_description: true } );

			await expect( gallery.root.locator( '.fg-caption-title' ).first() ).toHaveText( expected );
		} );
	}

	test( 'CAP-07: Description Source item_description shows the item description', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_description_source: 'item_description' } );

		await expect( gallery.root.locator( '.fg-caption-description' ).first() ).toHaveText( 'Description for item 1.' );
	} );

	test( 'CAP-09: a video playing inline gets no overlay caption', { tag: [ '@layout' ] }, async ( { page } ) => {
		const video = fixture( 'F-mixed', 'video' );
		const gallery = await open( page, { caption_placement: 'overlay', video_playback_mode: 'inline' }, [ video, small()[ 0 ] ] );

		await expect( gallery.items().nth( 0 ).locator( '.fg-caption' ) ).toHaveCount( 0 );
		await expect( gallery.items().nth( 1 ).locator( '.fg-caption' ) ).toHaveCount( 1 );
	} );

	for ( const settings of [
		{ caption_placement: 'bottom', video_playback_mode: 'inline' },
		{ caption_placement: 'overlay', video_playback_mode: 'lightbox' },
	] ) {
		test( `CAP-10: a video keeps its caption with ${ settings.caption_placement } placement and ${ settings.video_playback_mode } playback`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const video = fixture( 'F-mixed', 'video' );
			const gallery = await open( page, settings, [ video ] );

			await expect( firstItem( gallery ).locator( '.fg-caption-title' ) ).toHaveText( 'Mixed video file' );
		} );
	}

	test( 'CAP-12: Image Viewer ignores a stored description and title limit', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {
			layout: 'image-viewer',
			caption_hide_description: false,
			caption_limit_title_length: 'characters',
			caption_max_title_characters: { desktop: 3, tablet: 3, mobile: 3 },
		} );

		await expect( gallery.root.locator( 'figcaption' ) ).toHaveCount( 0 );
		await expect( firstItem( gallery ) ).toHaveAttribute( 'data-fg-caption-title', 'Small 1' );
	} );
} );

test.describe( 'where the caption sits', () => {
	for ( const placement of [ 'overlay', 'top', 'bottom' ] ) {
		test( `CAP-20: placement ${ placement } is stamped on the wrapper`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { caption_placement: placement } );

			await expect( gallery.root ).toHaveAttribute( 'data-fg-caption', placement );
		} );
	}

	test( 'CAP-21: an overlay caption lies inside the image', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'overlay' } );
		const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( gallery ).locator( '.fg-caption-content' ) );

		expect( caption.y ).toBeGreaterThanOrEqual( media.y - 1 );
		expect( caption.y + caption.height ).toBeLessThanOrEqual( media.y + media.height + 1 );
	} );

	for ( const [ alignment, check ] of [
		[ 'top', ( title: Box, media: Box ) => title.y - media.y < media.height / 3 ],
		[ 'bottom', ( title: Box, media: Box ) => media.y + media.height - ( title.y + title.height ) < media.height / 3 ],
	] as const ) {
		test( `CAP-21: overlay Vertical Alignment ${ alignment } moves the text there`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { caption_placement: 'overlay', caption_vertical_alignment: alignment } );
			const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
			const title = await box( firstItem( gallery ).locator( '.fg-caption-title' ) );

			expect( check( title, media ) ).toBe( true );
		} );
	}

	test( 'CAP-22: a top caption sits above the image', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'top' } );
		const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( gallery ).locator( '.fg-caption' ) );

		expect( caption.y + caption.height ).toBeLessThanOrEqual( media.y + 1 );
	} );

	test( 'CAP-23: a bottom caption sits below the image', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'bottom' } );
		const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( gallery ).locator( '.fg-caption' ) );

		expect( caption.y ).toBeGreaterThanOrEqual( media.y + media.height - 1 );
	} );

	test( 'CAP-24: Instant Photos puts the caption below the photo whatever placement is stored', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { layout: 'instant-photos', caption_placement: 'overlay' } );
		const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( gallery ).locator( '.fg-caption' ) );

		await expect( gallery.root ).toHaveAttribute( 'data-fg-caption', 'bottom' );
		expect( caption.y ).toBeGreaterThan( media.y + media.height / 2 );
	} );

	test( 'CAP-25: Image Viewer stamps no placement', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { layout: 'image-viewer', caption_placement: 'top' } );

		await expect( gallery.root ).not.toHaveAttribute( 'data-fg-caption', /.*/ );
	} );

	for ( const layout of [ 'masonry', 'justified' ] ) {
		test( `CAP-26: ${ layout } leaves room for bottom captions`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { layout, caption_placement: 'bottom' } );
			await page.waitForTimeout( 500 );

			const boxes = await gallery.items().evaluateAll( ( items ) =>
				items.map( ( item ) => {
					const rect = item.getBoundingClientRect();
					const caption = item.querySelector( '.fg-caption' )?.getBoundingClientRect();
					return { left: rect.left, right: rect.right, top: rect.top, bottom: Math.max( rect.bottom, caption?.bottom ?? 0 ) };
				} )
			);
			for ( const [ i, a ] of boxes.entries() ) {
				for ( const b of boxes.slice( i + 1 ) ) {
					const overlapX = Math.min( a.right, b.right ) - Math.max( a.left, b.left );
					const overlapY = Math.min( a.bottom, b.bottom ) - Math.max( a.top, b.top );
					expect( overlapX > 1 && overlapY > 1, `items ${ i } and another overlap` ).toBe( false );
				}
			}
		} );
	}

	test( 'CAP-27: Caption Distance from Media separates top and bottom captions only', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gap = { desktop: 24, tablet: 24, mobile: 24 };
		const bottom = await open( page, { caption_placement: 'bottom', caption_gap: gap } );
		const media = await box( firstItem( bottom ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( bottom ).locator( '.fg-caption' ) );
		expect( Math.round( caption.y - ( media.y + media.height ) ) ).toBe( 24 );

		const overlay = await open( page, { caption_placement: 'overlay', caption_gap: gap } );
		expect( await overlay.cssVar( 'caption-gap' ) ).toBe( '0' );
	} );
} );

test.describe( 'when the caption shows', () => {
	test( 'CAP-30: Always Visible shows the caption at rest and on hover', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_visibility: 'always' } );

		await expect( gallery.root ).not.toHaveAttribute( 'data-fg-caption-show', /.*/ );
		await expectShown( firstItem( gallery ) );
		await firstItem( gallery ).hover();
		await expectShown( firstItem( gallery ) );
	} );

	test( 'CAP-31: Show on Hover hides the caption until the pointer is over the item', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_visibility: 'show_on_hover' } );

		await expectHidden( firstItem( gallery ) );
		await firstItem( gallery ).hover();
		await expectShown( firstItem( gallery ) );
	} );

	test( 'CAP-32: Hide on Hover shows the caption until the pointer is over the item', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_visibility: 'hide_on_hover' } );

		await expectShown( firstItem( gallery ) );
		await firstItem( gallery ).hover();
		await expectHidden( firstItem( gallery ) );
	} );

	for ( const effect of CAPTION_EFFECTS ) {
		test( `CAP-33: ${ effect } owns the caption over Caption Visibility`, { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { hover_effect: effect, caption_visibility: 'hide_on_hover' } );

			await expect( gallery.root ).toHaveAttribute( 'data-fg-hover', effect );
			await expect( gallery.root ).not.toHaveAttribute( 'data-fg-caption-show', /.*/ );
			await expectHidden( firstItem( gallery ) );
			await firstItem( gallery ).hover();
			await expectShown( firstItem( gallery ) );
		} );
	}

	test( 'CAP-34: a caption effect is off on Instant Photos, so Caption Visibility applies', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { layout: 'instant-photos', hover_effect: 'caption-fade', caption_visibility: 'show_on_hover' } );

		await expect( gallery.root ).toHaveAttribute( 'data-fg-caption-show', 'show_on_hover' );
		await expectHidden( firstItem( gallery ) );
		await firstItem( gallery ).hover();
		await expectShown( firstItem( gallery ) );
	} );

	test( 'CAP-35: a caption effect with both parts hidden is not applied', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { hover_effect: 'caption-fade', caption_hide_title: true, caption_hide_description: true } );

		await expect( gallery.root ).not.toHaveAttribute( 'data-fg-hover', 'caption-fade' );
		await expect( gallery.root.locator( '.fg-caption' ) ).toHaveCount( 0 );
	} );

	test( 'CAP-36: caption-rise below the image never covers it', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { hover_effect: 'caption-rise', caption_placement: 'bottom' } );
		await firstItem( gallery ).hover();
		await expectShown( firstItem( gallery ) );

		const media = await box( firstItem( gallery ).locator( '.fg-item-media' ) );
		const caption = await box( firstItem( gallery ).locator( '.fg-caption' ) );
		expect( caption.y ).toBeGreaterThanOrEqual( media.y + media.height - 1 );
	} );

	test( 'CAP-37: with reduced motion, Show on Hover switches without a transition', { tag: [ '@layout' ] }, async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		const gallery = await open( page, { caption_visibility: 'show_on_hover' } );

		const duration = await firstItem( gallery )
			.locator( '.fg-caption' )
			.evaluate( ( element ) => getComputedStyle( element ).transitionDuration );
		expect( duration ).toBe( '0s' );
	} );

	for ( const settings of HOVER_ONLY ) {
		const name = settings.hover_effect ?? 'Show on Hover';
		test( `CAP-38: keyboard focus on an item shows its caption (${ name })`, { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { ...settings, item_click_behavior: 'lightbox' } );

			await expectHidden( firstItem( gallery ) );
			await firstItem( gallery ).locator( 'a' ).first().focus();
			await expectShown( firstItem( gallery ) );
			await expectHidden( gallery.items().nth( 1 ) );
		} );
	}

	test( 'CAP-40: an album with Show on Hover hides tile captions until hover', { tag: [ '@layout' ] }, async ( { page } ) => {
		const child = galleryPage( { layout: 'grid' }, small().slice( 0, 2 ) ).id;
		const { url } = album( [ child ], { layout: 'grid', caption_visibility: 'show_on_hover' } );
		await page.goto( url );
		const tile = page.locator( '.fotogrids-album .fg-item' ).first();
		await expect( tile ).toBeVisible();

		await expectHidden( tile );
		await tile.hover();
		await expectShown( tile );
	} );
} );

test.describe( 'when the caption shows, on touch', () => {
	test.use( { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } } );

	for ( const settings of HOVER_ONLY ) {
		const name = settings.hover_effect ?? 'Show on Hover';
		test( `CAP-39: the first tap shows the caption and the second opens the item (${ name })`, { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { ...settings, item_click_behavior: 'lightbox' } );
			const lightbox = new Lightbox( page );
			const item = firstItem( gallery );

			await expect( gallery.root ).toHaveAttribute( 'data-fg-caption-reveal', 'hover' );
			await expectHidden( item );
			await item.tap();
			await expectShown( item );
			await expect( lightbox.dialog() ).toBeHidden();

			await item.tap();
			await expect( lightbox.dialog() ).toBeVisible( { timeout: 15000 } );
		} );
	}

	test( 'CAP-39: tapping another item moves the shown caption, and tapping outside hides it', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_visibility: 'show_on_hover', item_click_behavior: 'lightbox' } );
		const [ a, b ] = [ gallery.items().nth( 0 ), gallery.items().nth( 1 ) ];

		await a.tap();
		await expectShown( a );
		await b.tap();
		await expectShown( b );
		await expectHidden( a );

		await page.tap( 'body', { position: { x: 2, y: 2 } } );
		await expectHidden( b );
	} );

	for ( const settings of [ { caption_visibility: 'always' }, { caption_visibility: 'hide_on_hover' } ] ) {
		test( `CAP-39: with ${ settings.caption_visibility } the first tap opens the item`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { ...settings, item_click_behavior: 'lightbox' } );
			const lightbox = new Lightbox( page );

			await expect( gallery.root ).not.toHaveAttribute( 'data-fg-caption-reveal', /.*/ );
			await expectShown( firstItem( gallery ) );
			await firstItem( gallery ).tap();
			await expect( lightbox.dialog() ).toBeVisible( { timeout: 15000 } );
		} );
	}
} );

test.describe( 'whether the caption can be read', () => {
	test( 'CAP-50: unset colours are white over the image', { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'overlay' } );

		expect( await color( gallery.root.locator( '.fg-caption-title' ).first() ) ).toBe( WHITE );
		expect( await color( gallery.root.locator( '.fg-caption-description' ).first() ) ).toBe( WHITE_70 );
	} );

	for ( const placement of [ 'top', 'bottom' ] ) {
		test( `CAP-51: unset colours follow the theme's text colour with ${ placement } placement`, { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, { caption_placement: placement } );
			const text = parse( await color( gallery.root ) );
			const title = parse( await color( gallery.root.locator( '.fg-caption-title' ).first() ) );
			const description = parse( await color( gallery.root.locator( '.fg-caption-description' ).first() ) );

			expect( title ).toEqual( text );
			expect( `rgb(${ title.slice( 0, 3 ).map( Math.round ).join( ', ' ) })` ).not.toBe( WHITE );
			expect( description.slice( 0, 3 ).map( Math.round ) ).toEqual( text.slice( 0, 3 ).map( Math.round ) );
			expect( description[ 3 ] ).toBeCloseTo( 0.7, 2 );
		} );
	}

	test( 'CAP-52: unset colours follow a light text colour set by the section around the gallery', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'bottom' } );
		await gallery.root.evaluate( ( element ) => {
			( element.parentElement as HTMLElement ).style.color = 'rgb(240, 240, 240)';
			( element.parentElement as HTMLElement ).style.background = 'rgb(20, 20, 20)';
		} );

		await expect.poll( () => color( gallery.root.locator( '.fg-caption-title' ).first() ) ).toBe( 'rgb(240, 240, 240)' );
	} );

	for ( const placement of [ 'overlay', 'top', 'bottom' ] ) {
		test( `CAP-53: chosen colours are kept with ${ placement } placement`, { tag: [ '@critical', '@layout' ] }, async ( { page } ) => {
			const gallery = await open( page, {
				caption_placement: placement,
				caption_title_color: 'rgba(200, 30, 30, 1)',
				caption_description_color: 'rgba(20, 40, 160, 1)',
			} );

			expect( await color( gallery.root.locator( '.fg-caption-title' ).first() ) ).toBe( 'rgb(200, 30, 30)' );
			expect( await color( gallery.root.locator( '.fg-caption-description' ).first() ) ).toBe( 'rgb(20, 40, 160)' );
		} );
	}

	test( 'CAP-54: Instant Photos captions are dark on the white frame', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { layout: 'instant-photos' } );

		expect( await color( gallery.root.locator( '.fg-caption-title' ).first() ) ).toBe( 'rgb(51, 51, 51)' );
		expect( await color( gallery.root.locator( '.fg-caption-description' ).first() ) ).toBe( 'rgb(119, 119, 119)' );
	} );

	test( 'CAP-55: the Image Viewer title follows the text colour around it', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { layout: 'image-viewer' } );
		const title = gallery.root.locator( '.fg-viewer-title-wrapper' );
		await expect( title ).toBeVisible();

		expect( await color( title ) ).toBe( await color( gallery.root ) );
	} );

	test( 'CAP-56: the overlay tint is the overlay colour at its opacity, and darker on hover', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {
			caption_placement: 'overlay',
			caption_overlay_color: 'rgba(10, 20, 30, 1)',
			caption_overlay_opacity: 40,
			caption_overlay_hover_opacity: 80,
		} );
		const tint = firstItem( gallery ).locator( '.fg-caption-bg' );

		expect( await tint.evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) ).toBe( 'rgba(10, 20, 30, 0.4)' );
		await firstItem( gallery ).hover();
		await expect
			.poll( () => tint.evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) )
			.toBe( 'rgba(10, 20, 30, 0.8)' );
	} );

	test( 'CAP-57: top and bottom captions have no tint behind the text', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_placement: 'bottom' } );

		expect( await gallery.cssVar( 'caption-overlay-bg' ) ).toBe( '' );
		expect(
			await firstItem( gallery )
				.locator( '.fg-caption-bg' )
				.evaluate( ( element ) => getComputedStyle( element ).backgroundColor )
		).toBe( 'rgba(0, 0, 0, 0)' );
	} );

	for ( const template of [ 'brick-wall', 'event-recap', 'listings-grid', 'spotlight-single', 'travel-log' ] ) {
		test( `CAP-58: the ${ template } template's captions are readable on a light theme`, { tag: [ '@layout' ] }, async ( { page } ) => {
			const file = path.resolve( 'src/includes/rest/templates/templates/gallery', `${ template }.json` );
			const { settings } = JSON.parse( readFileSync( file, 'utf8' ) );
			const gallery = await open( page, settings );
			const title = gallery.root.locator( '.fg-caption-title' ).first();

			await expect( title ).toBeVisible();
			expect( await color( title ) ).not.toBe( WHITE );
			expect( await color( title ) ).toBe( await color( gallery.root ) );
		} );
	}
} );

test.describe( 'how much of the caption fits', () => {
	test( 'CAP-70: the title is clamped to its line limit', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {
			caption_limit_title_length: 'lines',
			caption_max_title_lines: { desktop: 2, tablet: 2, mobile: 2 },
		} );

		expect(
			await gallery.root
				.locator( '.fg-caption-title' )
				.first()
				.evaluate( ( element ) => getComputedStyle( element ).webkitLineClamp )
		).toBe( '2' );
	} );

	test( 'CAP-71: the title is cut to its character limit', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {
			caption_limit_title_length: 'characters',
			caption_max_title_characters: { desktop: 4, tablet: 4, mobile: 4 },
		} );
		const text = ( await gallery.root.locator( '.fg-caption-title' ).first().innerText() ).trim();

		expect( text.startsWith( 'Smal' ) ).toBe( true );
		expect( text ).not.toContain( 'Small 1' );
	} );

	test( 'CAP-72: with no limit the full title shows, unclamped', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, { caption_limit_title_length: 'no' } );
		const title = gallery.root.locator( '.fg-caption-title' ).first();

		await expect( title ).toHaveText( 'Small 1' );
		expect( await title.evaluate( ( element ) => getComputedStyle( element ).webkitLineClamp ) ).toBe( 'none' );
	} );

	test( 'CAP-73: the description follows its own limits', { tag: [ '@layout' ] }, async ( { page } ) => {
		const gallery = await open( page, {
			caption_limit_description_length: 'characters',
			caption_max_desc_characters: { desktop: 7, tablet: 7, mobile: 7 },
		} );
		const text = ( await gallery.root.locator( '.fg-caption-description' ).first().innerText() ).trim();

		expect( text.startsWith( 'Caption' ) ).toBe( true );
		expect( text ).not.toContain( 'for item 1' );
	} );
} );
