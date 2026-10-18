import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { GalleryEditor, PAST_DEBOUNCE } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The caption controls in the gallery editor.
 *
 * Scoped: each test edits a gallery it created.
 */

async function openCaptions( page: import( '@playwright/test' ).Page, id: number ): Promise< CollectionSettings > {
	const editor = new GalleryEditor( page );
	const panel = new CollectionSettings( page );
	await editor.open( id );
	await panel.openTab( 'Captions' );
	await expect( panel.field( 'caption_hide_title' ) ).toBeVisible();
	return panel;
}

function storedMeta( id: number, key: string ): string {
	return wpEval( `echo get_post_meta( ${ id }, 'fotogrids_${ key }', true );` ).trim();
}

for ( const layout of [ 'instant-photos', 'image-viewer' ] ) {
	test( `CAP-80: Caption Placement is not offered for ${ layout }`, { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
		const panel = await openCaptions( page, galleryPage( { layout } ).id );

		await expect( panel.field( 'caption_hide_title' ) ).toBeVisible();
		await expect( panel.field( 'caption_placement' ) ).toHaveCount( 0 );
	} );
}

test( 'CAP-80: Caption Placement is offered for Grid', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await openCaptions( page, galleryPage( { layout: 'grid' } ).id );

	await expect( panel.field( 'caption_placement' ) ).toBeVisible();
} );

test( 'CAP-81: overlay controls show for overlay, distance for top and bottom', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const overlay = await openCaptions( page, galleryPage( { layout: 'grid', caption_placement: 'overlay' } ).id );
	await expect( overlay.field( 'caption_overlay_color' ) ).toBeVisible();
	await expect( overlay.field( 'caption_vertical_alignment' ) ).toBeVisible();
	await expect( overlay.field( 'caption_gap' ) ).toHaveCount( 0 );

	const bottom = await openCaptions( page, galleryPage( { layout: 'grid', caption_placement: 'bottom' } ).id );
	await expect( bottom.field( 'caption_gap' ) ).toBeVisible();
	await expect( bottom.field( 'caption_overlay_color' ) ).toHaveCount( 0 );
	await expect( bottom.field( 'caption_vertical_alignment' ) ).toHaveCount( 0 );
} );

test( 'CAP-82: hiding the title hides its colour and source', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const shown = await openCaptions( page, galleryPage( { layout: 'grid' } ).id );
	await expect( shown.field( 'caption_title_color' ) ).toBeVisible();

	const hidden = await openCaptions( page, galleryPage( { layout: 'grid', caption_hide_title: true } ).id );
	await expect( hidden.field( 'caption_title_color' ) ).toHaveCount( 0 );
	await expect( hidden.field( 'caption_title_source' ) ).toHaveCount( 0 );
} );

test( 'CAP-87: the caption colour fields say what an unset colour does', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const panel = await openCaptions( page, galleryPage( { layout: 'grid' } ).id );

	await expect( panel.field( 'caption_title_color' ).locator( '.fotogrids-setting__description' ) ).toContainText( 'When not set' );
	await expect( panel.field( 'caption_description_color' ).locator( '.fotogrids-setting__description' ) ).toContainText( 'When not set' );
} );

test( 'CAP-86: Reset returns a chosen caption colour to Default, and it is saved', { tag: [ '@critical', '@admin', '@settings' ] }, async ( { page } ) => {
	const { id } = galleryPage( { layout: 'grid', caption_placement: 'bottom', caption_title_color: 'rgba(200, 30, 30, 1)' } );
	const panel = await openCaptions( page, id );
	const field = panel.field( 'caption_title_color' );

	await expect( field.locator( '.fotogrids-color-text' ) ).toHaveValue( 'rgba(200, 30, 30, 1)' );
	await expect( panel.field( 'caption_description_color' ).locator( '.fotogrids-color-picker__reset' ) ).toHaveCount( 0 );

	await field.locator( '.fotogrids-color-picker__reset' ).click();

	await expect( field.locator( '.fotogrids-color-text' ) ).toHaveValue( '' );
	await expect( field.locator( '.fotogrids-color-text' ) ).toHaveAttribute( 'placeholder', 'Default' );
	await expect( field.locator( '.fotogrids-color-picker__reset' ) ).toHaveCount( 0 );
	await expect.poll( () => storedMeta( id, 'caption_title_color' ), { timeout: PAST_DEBOUNCE * 2 } ).toBe( '' );
} );

test( 'CAP-85: the editor preview follows a placement change', { tag: [ '@admin', '@settings' ] }, async ( { page } ) => {
	const { id } = galleryPage( { layout: 'grid', caption_placement: 'overlay' } );
	const panel = await openCaptions( page, id );

	await panel.field( 'caption_placement' ).getByRole( 'button', { name: 'Bottom' } ).click();
	await expect.poll( () => storedMeta( id, 'caption_placement' ), { timeout: PAST_DEBOUNCE * 2 } ).toBe( 'bottom' );

	await page.locator( '.fotogrids-gallery-tab' ).filter( { hasText: 'Preview' } ).click();
	await expect( page.locator( '.fotogrids-preview-container .fotogrids-collection' ) ).toHaveAttribute( 'data-fg-caption', 'bottom', {
		timeout: 15000,
	} );
} );
