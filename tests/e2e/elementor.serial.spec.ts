import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import type { Frame, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { storageStateFor, wpCli, wpEval } from './support/roles';

/**
 * The FotoGrids Gallery widget in Elementor: picked in the editor, bound to a
 * dynamic tag, and rendered on the published page.
 *
 * Serial: activates a page builder for the whole site.
 */

test.describe.configure( { mode: 'serial' } );

const BUILDER = 'elementor';
const BUILDER_VERSION = '4.3.5';

const TAG_PLUGIN = path.join( process.env.WP_PATH ?? '', 'wp-content', 'mu-plugins', 'fg-e2e-elementor-tag.php' );

let builderWasActive = false;

/** Pages this spec created, deleted afterwards. */
const createdPages: number[] = [];

const five = (): number[] => fixture< number[] >( 'F-small', 'items' );

let serial = 0;

/** A title no other test's picker search will match. */
function unique( prefix: string ): string {
	serial += 1;
	return `${ prefix } ${ Date.now() }-${ process.pid }-${ serial }`;
}

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/**
 * A published Elementor page holding one FotoGrids Gallery widget.
 *
 * @param settings The widget's settings, as Elementor stores them.
 * @param meta     Post meta to set on the page.
 */
function elementorPage(
	settings: Record< string, unknown >,
	meta: Record< string, string > = {}
): { id: number; url: string } {
	const data = [
		{
			id: 'fgc0001',
			elType: 'container',
			settings: {},
			elements: [ { id: 'fgw0001', elType: 'widget', widgetType: 'fotogrids-gallery', settings, elements: [] } ],
		},
	];
	const encoded = Buffer.from( JSON.stringify( { data, meta } ), 'utf8' ).toString( 'base64' );

	const page = JSON.parse(
		wpEval( `
			$in = json_decode( base64_decode( '${ encoded }' ), true );
			$id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Elementor widget', 'post_name' => 'elementor-widget-' . strtolower( wp_generate_password( 8, false ) ) ) );
			update_post_meta( $id, '_fg_scoped', 1 );
			update_post_meta( $id, '_elementor_edit_mode', 'builder' );
			update_post_meta( $id, '_elementor_template_type', 'wp-page' );
			update_post_meta( $id, '_elementor_version', ELEMENTOR_VERSION );
			update_post_meta( $id, '_elementor_data', wp_slash( wp_json_encode( $in['data'] ) ) );
			foreach ( (array) $in['meta'] as $key => $value ) {
				update_post_meta( $id, $key, $value );
			}
			echo wp_json_encode( array( 'id' => $id, 'url' => get_permalink( $id ) ) );
		` )
	);
	createdPages.push( page.id );

	return page;
}

/** The widget settings Elementor has stored for the page. */
function storedSettings( pageId: number ): Record< string, unknown > {
	return JSON.parse(
		wpEval(
			`$data = json_decode( get_post_meta( ${ pageId }, '_elementor_data', true ), true ); echo wp_json_encode( $data[0]['elements'][0]['settings'] );`
		).trim()
	);
}

/** Item ids a render shows, in order. */
function itemsIn( root: ReturnType< Page[ 'locator' ] > ): Promise< number[] > {
	return root
		.locator( '.fg-item [data-id]' )
		.evaluateAll( ( nodes ) => nodes.map( ( node ) => Number( node.getAttribute( 'data-id' ) ) ) );
}

async function openEditor( page: Page, pageId: number ): Promise< Frame > {
	await page.goto( `/wp-admin/post.php?post=${ pageId }&action=elementor` );
	const handle = await page.waitForSelector( '#elementor-preview-iframe', { timeout: 60000 } );
	const frame = await handle.contentFrame();
	if ( ! frame ) {
		throw new Error( 'The Elementor editor has no preview frame.' );
	}
	await frame.waitForSelector( '.elementor-widget-fotogrids-gallery', { timeout: 60000 } );

	return frame;
}

test.beforeAll( () => {
	const installed = wp( [ 'plugin', 'list', '--field=name' ] ).split( '\n' );
	if ( ! installed.includes( BUILDER ) ) {
		wp( [ 'plugin', 'install', BUILDER, `--version=${ BUILDER_VERSION }` ] );
	}

	builderWasActive = 'active' === wp( [ 'plugin', 'get', BUILDER, '--field=status' ] );
	if ( ! builderWasActive ) {
		wp( [ 'plugin', 'activate', BUILDER ] );
	}
	// Activation sends the next admin load to Elementor's onboarding, and the
	// editor opens a promotion over the panel once per site.
	wp( [ 'transient', 'delete', 'elementor_activation_redirect' ] );
	wp( [ 'option', 'update', 'elementor_angie_guide_auto_shown', 'yes' ] );

	mkdirSync( path.dirname( TAG_PLUGIN ), { recursive: true } );
	copyFileSync( path.resolve( 'tests/harness/elementor-test-tag.php' ), TAG_PLUGIN );
} );

test.afterAll( () => {
	rmSync( TAG_PLUGIN, { force: true } );

	if ( createdPages.length ) {
		wp( [ 'post', 'delete', ...createdPages.map( String ), '--force' ] );
	}

	if ( ! builderWasActive ) {
		wp( [ 'plugin', 'deactivate', BUILDER ] );
	}
} );

test.describe( 'in the editor', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	/**
	 * INS-14. Pick a gallery with the widget's picker: the preview inside the
	 * editor iframe renders it, and saving stores its id on the widget.
	 */
	test( 'INS-14: a gallery picked in the widget previews in the editor and saves', {
		tag: [ '@admin', '@layout' ],
	}, async ( { page } ) => {
		const title = unique( 'Elementor picked' );
		const items = five().slice( 0, 3 );
		const { id } = galleryPage( { layout: 'grid' }, items, title );
		const target = elementorPage( { gallery_source: 'picker', gallery_id: '' } );

		const preview = await openEditor( page, target.id );
		const widget = preview.locator( '.elementor-widget-fotogrids-gallery' );
		await expect( widget ).toContainText( 'Select a gallery to display.' );

		// Select the widget so its settings open in the panel.
		await page.evaluate( () => {
			const win = window as any;
			win.$e.run( 'document/elements/select', { container: win.elementor.getContainer( 'fgw0001' ) } );
		} );
		await page.locator( '.fg-pb-elementor-picker__browse' ).click();
		const picker = page.locator( '.fg-pb-picker-modal' );
		await picker.getByRole( 'searchbox' ).or( picker.getByLabel( 'Search' ) ).first().fill( title );
		const card = picker.locator( '.fg-pb-picker-card' ).filter( { hasText: title } );
		await expect( card ).toHaveCount( 1 );
		await card.click();

		const rendered = widget.locator( `[data-fg-gallery-id="${ id }"]` );
		await expect.poll( () => itemsIn( rendered ), { timeout: 20000 } ).toEqual( items );
		await expect( rendered.locator( '.fg-item' ).first() ).toBeVisible();

		await page.getByRole( 'button', { name: /^(Publish|Update)$/ } ).click();
		await expect
			.poll( () => storedSettings( target.id ).gallery_id, { timeout: 20000 } )
			.toBe( String( id ) );
	} );
} );

/**
 * INS-15. In dynamic mode the gallery id comes from a dynamic tag: two pages
 * bound to the same tag show the gallery each page's own meta names.
 */
test( 'INS-15: a widget bound to a dynamic tag renders the gallery the tag resolves to', {
	tag: '@layout',
}, async ( { page } ) => {
	const first = five().slice( 0, 2 );
	const second = five().slice( 2, 5 );
	const galleries = [ galleryPage( { layout: 'grid' }, first ).id, galleryPage( { layout: 'grid' }, second ).id ];
	const bound = {
		gallery_source: 'dynamic',
		gallery_id_dynamic: '',
		__dynamic__: {
			gallery_id_dynamic: '[elementor-tag id="fgt0001" name="fg-test-gallery" settings="%7B%7D"]',
		},
	};

	for ( const [ index, galleryId ] of galleries.entries() ) {
		const { url } = elementorPage( bound, { fg_test_gallery: String( galleryId ) } );
		await page.goto( url );
		const gallery = new GalleryRender( page, galleryId );
		await gallery.waitFor();
		expect( await itemsIn( gallery.root ) ).toEqual( [ first, second ][ index ] );
	}
} );

/**
 * INS-16. The published widget renders through the shortcode renderer as an
 * Elementor request: its Lightbox links tell Elementor's own lightbox to stay
 * out, which the same gallery's shortcode does not.
 */
test( 'INS-16: the published widget renders as an Elementor request and opens the FotoGrids Lightbox', {
	tag: [ '@layout', '@lightbox' ],
}, async ( { page } ) => {
	const { id, url: shortcodeUrl } = galleryPage( { layout: 'grid', item_click_behavior: 'lightbox' }, five().slice( 0, 3 ) );
	const { url } = elementorPage( { gallery_source: 'picker', gallery_id: String( id ) } );

	await page.goto( url );
	const gallery = new GalleryRender( page, id );
	await gallery.waitFor();
	const triggers = gallery.root.locator( '[data-fg-lightbox-trigger]' );
	await expect( triggers ).toHaveCount( 3 );
	await expect( gallery.root.locator( '[data-fg-lightbox-trigger][data-elementor-open-lightbox="no"]' ) ).toHaveCount( 3 );

	await new Lightbox( page ).openFrom( gallery );
	await expect( page.locator( '.elementor-lightbox' ) ).toBeHidden();

	await page.goto( shortcodeUrl );
	await gallery.waitFor();
	await expect( triggers ).toHaveCount( 3 );
	await expect( gallery.root.locator( '[data-elementor-open-lightbox]' ) ).toHaveCount( 0 );
} );
