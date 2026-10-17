import type { Frame, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { storageStateFor, wpEval } from './support/roles';

/**
 * The gallery block inside the block editor: inserting it, its live preview
 * and the preview-only toggles, and converting a core gallery into one.
 *
 * Scoped: every gallery and post here is created by the test that reads it.
 */

test.use( { storageState: storageStateFor( 'administrator' ) } );

const five = (): number[] => fixture< number[] >( 'F-small', 'items' );

let serial = 0;

/** A title no other test's picker search will match. */
function unique( prefix: string ): string {
	serial += 1;
	return `${ prefix } ${ Date.now() }-${ process.pid }-${ serial }`;
}

/** A draft post holding this block markup, purged with the spec's collections. */
function draftWith( content: string ): number {
	const encoded = Buffer.from( content, 'utf8' ).toString( 'base64' );
	const id = Number(
		wpEval(
			`echo wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'draft', 'post_title' => 'Block editor', 'post_name' => 'block-editor-' . strtolower( wp_generate_password( 8, false ) ), 'post_content' => base64_decode( '${ encoded}' ) ) );`
		).trim()
	);
	adopt( id );
	return id;
}

function savedContent( postId: number ): string {
	return wpEval( `echo get_post_field( 'post_content', ${ postId } );` ).trim();
}

/** Open the editor with the welcome guide out of the way; returns the canvas. */
async function openEditor( page: Page, path: string ): Promise< Frame > {
	await page.goto( path );
	await page.waitForFunction( () => ( window as any ).wp?.data?.select( 'core/editor' )?.getCurrentPostId?.() );
	await page.evaluate( () => {
		const wp = ( window as any ).wp;
		wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false );
	} );

	const handle = await page.waitForSelector( 'iframe[name="editor-canvas"]' );
	const frame = await handle.contentFrame();
	if ( ! frame ) {
		throw new Error( 'The block editor canvas has no frame.' );
	}
	return frame;
}

/** The attachment ids a preview shows, in order. */
function previewItems( canvas: Frame, galleryId: number ): Promise< number[] > {
	return canvas
		.locator( `[data-fg-gallery-id="${ galleryId }"] .fg-item [data-id]` )
		.evaluateAll( ( nodes ) => nodes.map( ( node ) => Number( node.getAttribute( 'data-id' ) ) ) );
}

/** Save the post through the editor and wait for it to finish. */
async function save( page: Page ): Promise< void > {
	await page.evaluate( () => ( window as any ).wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => {
		const editor = ( window as any ).wp.data.select( 'core/editor' );
		return ! editor.isSavingPost() && ! editor.isEditedPostDirty();
	} );
}

/**
 * INS-07. Insert the block from the inserter, pick a gallery in the picker,
 * and the live preview renders that gallery; the saved post carries its id.
 */
test( 'INS-07: a gallery block inserted and picked in the editor previews and saves the gallery', {
	tag: [ '@admin', '@layout' ],
}, async ( { page } ) => {
	const title = unique( 'Picked' );
	const items = five().slice( 0, 3 );
	const { id } = galleryPage( { layout: 'grid' }, items, title );
	const post = draftWith( '' );

	const canvas = await openEditor( page, `/wp-admin/post.php?post=${ post }&action=edit` );

	await page.getByRole( 'button', { name: /^(Toggle block inserter|Block Inserter|Add block)$/ } ).first().click();
	await page.getByPlaceholder( 'Search' ).fill( 'FotoGrids Gallery' );
	await page.getByRole( 'option', { name: 'FotoGrids Gallery' } ).click();

	await canvas.getByRole( 'button', { name: 'Select a gallery' } ).click();
	const picker = page.locator( '.fg-pb-picker-modal' );
	await picker.getByRole( 'searchbox' ).or( picker.getByLabel( 'Search' ) ).first().fill( title );
	const card = picker.locator( '.fg-pb-picker-card' ).filter( { hasText: title } );
	await expect( card ).toHaveCount( 1 );
	await card.click();
	await expect( picker ).toHaveCount( 0 );

	await expect.poll( () => previewItems( canvas, id ), { timeout: 15000 } ).toEqual( items );

	await save( page );
	expect( savedContent( post ) ).toContain( `<!-- wp:fotogrids/gallery {"galleryId":${ id }} /-->` );
} );

/** Open the selected block's Preview panel in the settings sidebar. */
async function openPreviewPanel( page: Page, clientId: string ): Promise< void > {
	await page.evaluate( ( id ) => {
		const wp = ( window as any ).wp;
		wp.data.dispatch( 'core/block-editor' ).selectBlock( id );
		wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' );
	}, clientId );
	const panel = page.getByRole( 'button', { name: 'Preview', exact: true } );
	if ( 'false' === ( await panel.getAttribute( 'aria-expanded' ) ) ) {
		await panel.click();
	}
}

function firstBlock( page: Page ): Promise< { clientId: string; attributes: Record< string, unknown > } > {
	return page.evaluate( () => {
		const block = ( window as any ).wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ];
		return { clientId: block.clientId, attributes: block.attributes };
	} );
}

/**
 * INS-12. The block's two preview toggles change only the editor preview:
 * off, items do not open the Lightbox and Load More does nothing; on, both
 * work. The published page renders the same either way.
 */
test( 'INS-12: the preview toggles change the editor preview and not the published page', {
	tag: [ '@admin', '@layout' ],
}, async ( { page } ) => {
	const { id } = galleryPage( {
		layout: 'grid',
		item_click_behavior: 'lightbox',
		pagination_type: 'paginated',
		pagination_method: 'load_more',
		items_per_page: { desktop: 2, tablet: 2, mobile: 2 },
	} );
	const block = ( flags: boolean ) =>
		`<!-- wp:fotogrids/gallery ${ JSON.stringify( { galleryId: id, previewClickBehavior: flags, previewPagination: flags } ) } /-->`;
	const post = draftWith( block( false ) );

	const canvas = await openEditor( page, `/wp-admin/post.php?post=${ post }&action=edit` );
	const root = canvas.locator( `[data-fg-gallery-id="${ id }"]` );
	const items = root.locator( '.fg-item' );
	const loadMore = root.locator( '.fg-pagination__load-more' );
	const lightbox = canvas.locator( 'dialog.fg-lightbox' );

	await expect( items ).toHaveCount( 2, { timeout: 15000 } );
	await expect( root.locator( '[data-fg-lightbox-trigger]' ) ).toHaveCount( 0 );
	await items.first().click();
	await expect( loadMore ).toBeVisible();
	await loadMore.click();
	await page.waitForTimeout( 1000 );
	await expect( items ).toHaveCount( 2 );
	await expect( lightbox ).toHaveCount( 0 );

	await openPreviewPanel( page, ( await firstBlock( page ) ).clientId );
	await page.getByRole( 'checkbox', { name: 'Make items clickable' } ).check();
	await page.getByRole( 'checkbox', { name: 'Enable pagination controls' } ).check();

	await expect( root.locator( '[data-fg-lightbox-trigger]' ) ).toHaveCount( 2, { timeout: 15000 } );
	await root.locator( '.fg-pagination__load-more' ).click();
	await expect( items ).toHaveCount( 4 );
	await root.locator( '[data-fg-lightbox-trigger]' ).first().click();
	await expect( lightbox ).toBeVisible();

	expect( ( await firstBlock( page ) ).attributes ).toMatchObject( {
		previewClickBehavior: true,
		previewPagination: true,
	} );

	// The published render ignores both flags.
	const rendered = ( flags: boolean ) =>
		wpEval(
			`echo do_blocks( base64_decode( '${ Buffer.from( block( flags ) ).toString( 'base64' ) }' ) );`
		).replace( /fg-\d+-\d+/g, 'ID' );
	expect( rendered( true ) ).toBe( rendered( false ) );
	expect( rendered( false ) ).toContain( 'data-fg-lightbox-trigger' );
	expect( rendered( false ) ).toContain( 'fg-pagination__load-more' );
} );

/**
 * INS-13. Transforming a core Gallery block into a FotoGrids Gallery imports
 * its images into a new gallery, which the block then previews.
 */
test( 'INS-13: a core gallery transformed into a FotoGrids gallery imports its images', {
	tag: [ '@admin', '@layout' ],
}, async ( { page } ) => {
	const images = five().slice( 1, 4 );
	const post = draftWith( '' );

	const canvas = await openEditor( page, `/wp-admin/post.php?post=${ post }&action=edit` );
	await page.evaluate( ( ids ) => {
		const wp = ( window as any ).wp;
		const gallery = wp.blocks.createBlock(
			'core/gallery',
			{},
			ids.map( ( id: number ) => wp.blocks.createBlock( 'core/image', { id } ) )
		);
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( gallery );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( gallery.clientId );
	}, images );

	await page.getByRole( 'toolbar', { name: 'Block tools' } ).getByRole( 'button', { name: /^Gallery/ } ).first().click();
	await page.getByRole( 'menuitem', { name: 'FotoGrids Gallery' } ).click();

	await expect
		.poll( async () => Number( ( await firstBlock( page ) ).attributes.galleryId ), { timeout: 15000 } )
		.toBeGreaterThan( 0 );
	const { attributes } = await firstBlock( page );
	const galleryId = Number( attributes.galleryId );
	adopt( galleryId );

	expect( attributes._pendingImportAttachmentIds ).toEqual( [] );
	await expect.poll( () => previewItems( canvas, galleryId ), { timeout: 15000 } ).toEqual( images );
	expect(
		JSON.parse(
			wpEval(
				`echo wp_json_encode( array_map( 'intval', FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${ galleryId } ) ) );`
			).trim()
		)
	).toEqual( images );
} );
