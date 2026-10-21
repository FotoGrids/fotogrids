import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { album, galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';
import { storageStateFor, wpEval } from './support/roles';

/**
 * Formatted captions and descriptions on every surface that shows them.
 *
 * Serial: creates attachments of its own and changes the Gallery Items
 * settings, which apply site-wide.
 */

test.describe.configure( { mode: 'serial' } );
test.use( { storageState: storageStateFor( 'administrator' ) } );

const SETTINGS = 'fotogrids_text_formatting';

const CAPTION =
	'Boats <strong>leaving</strong> the <a href="https://example.com/pier">north pier</a> at &quot;dawn&quot;\nSecond line';
const DESCRIPTION =
	'<em>Long</em> exposure, &quot;quiet&quot; <a href="https://example.com/notes">notes</a>' +
	'<img src=x onerror="window.__fgXss=1"><script>window.__fgXss=1</script>' +
	'<a href="javascript:window.__fgXss=1" onclick="window.__fgXss=1" data-x="1" style="color:red">bad link</a>' +
	'<svg><a href="https://evil.example">svg</a></svg>';

let itemId: number;
let before = '';

function attachment( caption: string, description: string ): number {
	const encode = ( value: string ) => `base64_decode( '${ Buffer.from( value ).toString( 'base64' ) }' )`;
	return Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-item-text-formatting.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$id = wp_insert_attachment( wp_slash( array(
				'post_mime_type' => 'image/jpeg',
				'post_title'     => 'Harbour <b>at</b> dawn',
				'post_excerpt'   => ${ encode( caption ) },
				'post_content'   => ${ encode( description ) },
				'post_status'    => 'inherit',
			) ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			echo $id;
		` ).trim()
	);
}

function saveSettings( settings: Record< string, unknown > ): void {
	wpEval(
		`\\FotoGrids\\Settings\\Text_Formatting_Settings_Store::save( json_decode( '${ JSON.stringify( settings ) }', true ) );`
	);
}

/**
 * Every element and attribute inside the subtree is on the allowlist, and
 * every link uses an allowed protocol.
 */
async function expectOnlyAllowedMarkup( locator: Locator ): Promise< void > {
	const problems = await locator.evaluateAll( ( roots ) => {
		const allowed: Record< string, string[] > = {
			A: [ 'href', 'title', 'target', 'rel' ],
			STRONG: [],
			B: [],
			EM: [],
			I: [],
			BR: [],
			SPAN: [ 'class' ],
		};
		const found: string[] = [];
		for ( const root of roots ) {
			root.querySelectorAll( '*' ).forEach( ( el ) => {
				const attributes = allowed[ el.tagName ];
				if ( ! attributes ) {
					found.push( `element ${ el.tagName }` );
					return;
				}
				for ( const attribute of Array.from( el.attributes ) ) {
					if ( ! attributes.includes( attribute.name ) ) {
						found.push( `${ el.tagName }[${ attribute.name }]` );
					}
				}
				if ( 'SPAN' === el.tagName && 'fg-formatted-text-sr' !== el.getAttribute( 'class' ) ) {
					found.push( 'span without the screen-reader class' );
				}
				if ( 'A' === el.tagName && ! /^(https?:|mailto:|tel:|\/|#)/i.test( el.getAttribute( 'href' ) ?? '' ) ) {
					found.push( `href ${ el.getAttribute( 'href' ) }` );
				}
			} );
		}
		return found;
	} );
	expect( problems ).toEqual( [] );
}

async function expectNothingRan( page: Page ): Promise< void > {
	expect( await page.evaluate( () => ( window as Window & { __fgXss?: number } ).__fgXss ) ).toBeUndefined();
}

test.beforeAll( () => {
	before = wpEval( `echo wp_json_encode( get_option( '${ SETTINGS }', null ) );` ).trim();
	wpEval( `delete_option( '${ SETTINGS }' );` );
	itemId = attachment( CAPTION, DESCRIPTION );
} );

test.afterAll( () => {
	if ( itemId ) {
		wpEval( `wp_delete_attachment( ${ itemId }, true );` );
	}
	if ( ! before || 'null' === before ) {
		wpEval( `delete_option( '${ SETTINGS }' );` );
	} else {
		wpEval( `update_option( '${ SETTINGS }', json_decode( base64_decode( '${ Buffer.from( before ).toString( 'base64' ) }' ), true ) );` );
	}
	wpEval( '\\FotoGrids\\FotoGrids_Cache::flush_all();' );
} );

test( 'a thumbnail caption shows formatting and line breaks, with links as text', { tag: [ '@layout', '@critical' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { caption_visibility: 'always' }, [ itemId ] );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	const description = gallery.root.locator( '.fg-caption-description' ).first();
	await expect( description.locator( 'strong' ) ).toHaveText( 'leaving' );
	await expect( description.locator( 'br' ) ).toHaveCount( 1 );
	await expect( description.locator( 'a' ) ).toHaveCount( 0 );
	await expect( description ).toContainText( 'north pier at "dawn"' );
	const title = gallery.root.locator( '.fg-caption-title' ).first();
	await expect( title ).toHaveText( 'Harbour at dawn' );
	await expect( title.locator( '*' ) ).toHaveCount( 0 );
	await expectOnlyAllowedMarkup( description );
} );

test( 'the classic Lightbox shows working links and nothing unsafe', { tag: [ '@lightbox', '@critical' ] }, async ( { page } ) => {
	const { id, url } = galleryPage( { lightbox_info_blocks: JSON.stringify( [ 'caption', 'description' ] ) }, [ itemId ] );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();
	await lightbox.openFrom( gallery );
	if ( ! ( await lightbox.info().isVisible() ) ) {
		await lightbox.infoToggle().click();
	}

	const caption = lightbox.info().locator( '.fg-lb-info-caption' );
	const link = caption.locator( 'a' );
	await expect( link ).toHaveAttribute( 'href', 'https://example.com/pier' );
	await expect( link ).toHaveAttribute( 'target', '_blank' );
	await expect( link ).toHaveAttribute( 'rel', 'noopener' );
	await expect( link.locator( '.fg-formatted-text-sr' ) ).toHaveText( ' (opens in a new tab)' );

	const description = lightbox.info().locator( '.fg-lb-info-description' );
	await expect( description.locator( 'em' ) ).toHaveText( 'Long' );
	await expect( description ).toContainText( 'bad link' );
	await expectOnlyAllowedMarkup( lightbox.info().locator( '.fg-lb-info-caption, .fg-lb-info-description' ) );
	await expectNothingRan( page );

	await link.focus();
	await expect( link ).toBeFocused();
	const popup = page.waitForEvent( 'popup' );
	await page.keyboard.press( 'Enter' );
	await ( await popup ).close();
	await expect( lightbox.dialog() ).toBeVisible();
} );

for ( const [ variant, overlay, captionSelector ] of [
	[ 'mini', '.fg-lb-mv', '.fg-lb-mv-caption' ],
	[ 'grid', '.fg-lb-grid', '.fg-lb-grid-tile-caption' ],
] as const ) {
	test( `the ${ variant } Lightbox opens on text holding &quot; and formats it`, { tag: [ '@lightbox' ] }, async ( { page } ) => {
		const { id, url } = galleryPage(
			{ layout: 'grid', lightbox_variant: variant, lightbox_lite_caption_show: true, lightbox_lite_caption_source: 'description' },
			[ itemId ]
		);
		const gallery = new GalleryRender( page, id );

		await page.goto( url );
		await gallery.waitFor();
		await gallery.items().first().click();
		await expect( page.locator( overlay ) ).toBeVisible();

		const caption = page.locator( captionSelector ).first();
		await expect( caption ).toContainText( 'exposure, "quiet" notes' );
		await expect( caption.locator( 'em' ) ).toHaveText( 'Long' );
		await expect( caption.locator( 'a' ) ).toHaveCount( 'mini' === variant ? 1 : 0 );
		await expectOnlyAllowedMarkup( caption );
		await expectNothingRan( page );
	} );
}

test( 'an album tile shows a gallery description written with blocks as clean text', { tag: [ '@layout' ] }, async ( { page } ) => {
	const { id: galleryId } = galleryPage( {}, [ itemId ] );
	wpEval(
		`wp_update_post( wp_slash( array( 'ID' => ${ galleryId }, 'post_content' => "<!-- wp:paragraph -->\\n<p>First <strong>part</strong></p>\\n<!-- /wp:paragraph -->\\n\\n<!-- wp:paragraph -->\\n<p>[gallery ids=\\"1\\"]Second</p>\\n<!-- /wp:paragraph -->" ) ) ); \\FotoGrids\\FotoGrids_Cache::flush_all();`
	);
	const { url } = album( [ galleryId ], { caption_description_source: 'item_description', caption_visibility: 'always' } );

	await page.goto( url );
	const description = page.locator( '.fotogrids-album .fg-caption-description, .fg-caption-description' ).first();
	await expect( description ).toBeVisible( { timeout: 15000 } );
	await expect( description.locator( 'strong' ) ).toHaveText( 'part' );
	await expect( description ).toContainText( 'Second' );
	await expect( description ).not.toContainText( 'wp:paragraph' );
	await expect( description ).not.toContainText( '[gallery' );
	await expectOnlyAllowedMarkup( description );
} );

test( 'Plain text in Gallery Items settings shows every caption as typed', { tag: [ '@settings', '@lightbox' ] }, async ( { page } ) => {
	saveSettings( { mode: 'plain' } );

	const { id, url } = galleryPage( { caption_visibility: 'always', lightbox_info_blocks: JSON.stringify( [ 'caption' ] ) }, [ itemId ] );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();
	const description = gallery.root.locator( '.fg-caption-description' ).first();
	await expect( description ).toContainText( 'Boats leaving the north pier' );
	await expect( description.locator( 'strong' ) ).toHaveCount( 0 );

	await lightbox.openFrom( gallery );
	if ( ! ( await lightbox.info().isVisible() ) ) {
		await lightbox.infoToggle().click();
	}
	const caption = lightbox.info().locator( '.fg-lb-info-caption' );
	await expect( caption ).toContainText( 'north pier' );
	await expect( caption.locator( 'a, strong' ) ).toHaveCount( 0 );

	saveSettings( { mode: 'basic' } );
} );

test( 'link defaults from settings apply to links without a choice of their own', { tag: [ '@settings', '@lightbox' ] }, async ( { page } ) => {
	saveSettings( { mode: 'basic', links_new_tab: false, links_nofollow: true } );

	const { id, url } = galleryPage( { lightbox_info_blocks: JSON.stringify( [ 'caption' ] ) }, [ itemId ] );
	const gallery = new GalleryRender( page, id );
	const lightbox = new Lightbox( page );

	await page.goto( url );
	await gallery.waitFor();
	await lightbox.openFrom( gallery );
	if ( ! ( await lightbox.info().isVisible() ) ) {
		await lightbox.infoToggle().click();
	}
	const link = lightbox.info().locator( '.fg-lb-info-caption a' );
	await expect( link ).toHaveAttribute( 'rel', 'nofollow' );
	await expect( link ).not.toHaveAttribute( 'target', /.*/ );

	saveSettings( { mode: 'basic', links_new_tab: true, links_nofollow: false } );
} );

test( 'the Gallery Items tab saves the formatting mode', { tag: [ '@settings', '@admin' ] }, async ( { page } ) => {
	await page.goto( '/wp-admin/admin.php?page=fotogrids-settings&tab=gallery_items' );
	await expect( page.locator( '.fotogrids-save-bar' ) ).toBeVisible( { timeout: 20000 } );
	await page.waitForLoadState( 'networkidle' );

	const newTab = page.locator( '#fg-gallery-items-links-new-tab' );
	await expect( newTab ).toBeEnabled();
	await page.getByRole( 'radio', { name: 'Plain text' } ).click();
	await expect( newTab ).toBeDisabled();
	await expect( page.getByText( 'Links are off' ) ).toBeVisible();

	await expect.poll( () => wpEval( `echo \\FotoGrids\\Settings\\Text_Formatting_Settings_Store::get()['mode'];` ).trim(), { timeout: 15000 } ).toBe( 'plain' );

	saveSettings( { mode: 'basic' } );
} );
