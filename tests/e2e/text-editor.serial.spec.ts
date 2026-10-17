import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { firstItem } from './support/fixtures';
import { galleryPage } from './support/collections';
import { GalleryEditor } from './support/gallery-editor';
import { storageStateFor, wpEval } from './support/roles';
import { restoreRoles, snapshotRoles } from './support/site';

/**
 * The caption and description editor in the Item Edit modal: typing, line
 * breaks, formatting, links, HTML mode, undo and the permission. Also the
 * title field beside it, for titles stored with entities.
 *
 * Serial: creates attachments of its own and changes role capabilities. Runs in
 * Chromium with the suite, and in Firefox and WebKit in the editor browsers job.
 */

test.describe.configure( { mode: 'serial' } );

const CAPABILITY = 'format_fotogrids_item_text';

let attachments: number[] = [];

function attachment( author: string, caption = '', description = '' ): number {
	const encode = ( value: string ) => `base64_decode( '${ Buffer.from( value ).toString( 'base64' ) }' )`;
	const id = Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-text-editor.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ firstItem( 'F-small' ) } ), $path );
			$user = get_user_by( 'login', '${ author }' );
			$id   = wp_insert_attachment( wp_slash( array(
				'post_mime_type' => 'image/jpeg',
				'post_title'     => 'Editor test',
				'post_excerpt'   => ${ encode( caption ) },
				'post_content'   => ${ encode( description ) },
				'post_status'    => 'inherit',
				'post_author'    => $user ? $user->ID : 1,
			) ), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			echo $id;
		` ).trim()
	);
	attachments.push( id );
	return id;
}

function stored( id: number ): { caption: string; description: string; title: string } {
	return JSON.parse(
		wpEval(
			`$p = get_post( ${ id } ); echo wp_json_encode( array( 'caption' => $p->post_excerpt, 'description' => $p->post_content, 'title' => $p->post_title ) );`
		)
	);
}

async function openItem( page: Page, galleryId: number, itemId: number ): Promise< void > {
	const editor = new GalleryEditor( page );
	await editor.open( galleryId );
	await editor.item( itemId ).hover();
	await editor.editItem( itemId ).click();
	await expect( page.locator( '#fotogrids-item-caption' ) ).toBeVisible( { timeout: 15000 } );
}

async function saveItem( page: Page, itemId: number ): Promise< void > {
	const saved = page.waitForResponse(
		( r ) => decodeURIComponent( r.url() ).includes( `/items/${ itemId }/save` ) && 200 === r.status()
	);
	await page.getByRole( 'button', { name: 'Save Changes' } ).click();
	await saved;
}

function tool( page: Page, field: string, name: string ) {
	return page
		.locator( `.fotogrids-text-editor:has(#${ field })` )
		.getByRole( 'toolbar' )
		.getByRole( 'button', { name, exact: true } );
}

test.afterAll( () => {
	for ( const id of attachments ) {
		wpEval( `wp_delete_attachment( ${ id }, true );` );
	}
	attachments = [];
} );

test.describe( 'as an administrator', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'typing, a line break, bold and a link are saved as formatted text', { tag: [ '@admin' ] }, async ( { page } ) => {
		const itemId = attachment( 'admin' );
		const { id } = galleryPage( {}, [ itemId ] );
		await openItem( page, id, itemId );

		const caption = page.locator( '#fotogrids-item-caption' );
		await caption.click();
		await page.keyboard.type( 'Harbour at dawn' );
		await page.keyboard.press( 'Enter' );
		await page.keyboard.type( 'second line' );

		await caption.evaluate( ( el ) => {
			const text = el.firstChild as Text;
			const range = document.createRange();
			range.setStart( text, 0 );
			range.setEnd( text, 7 );
			const selection = window.getSelection()!;
			selection.removeAllRanges();
			selection.addRange( range );
		} );
		await page.keyboard.press( `ControlOrMeta+b` );
		await expect( caption.locator( 'strong' ) ).toHaveText( 'Harbour' );
		await expect( tool( page, 'fotogrids-item-caption', 'Bold' ) ).toHaveAttribute( 'aria-pressed', 'true' );

		await caption.evaluate( ( el ) => {
			const walker = document.createTreeWalker( el, NodeFilter.SHOW_TEXT );
			let node: Node | null;
			while ( ( node = walker.nextNode() ) ) {
				const at = ( node as Text ).data.indexOf( 'dawn' );
				if ( at !== -1 ) {
					const range = document.createRange();
					range.setStart( node, at );
					range.setEnd( node, at + 4 );
					window.getSelection()!.removeAllRanges();
					window.getSelection()!.addRange( range );
					return;
				}
			}
		} );
		await tool( page, 'fotogrids-item-caption', 'Link' ).click();
		await page.locator( '#fotogrids-item-caption-link-url' ).fill( 'example.com/dawn' );
		await page.getByRole( 'button', { name: 'Apply' } ).click();
		await expect( caption.locator( 'a' ) ).toHaveAttribute( 'href', 'https://example.com/dawn' );
		await page.keyboard.press( 'ArrowRight' );
		await page.keyboard.type( '!' );
		await expect( caption.locator( 'a' ) ).toHaveText( 'dawn' );

		await saveItem( page, itemId );
		expect( stored( itemId ).caption ).toBe(
			'<strong>Harbour</strong> at <a href="https://example.com/dawn">dawn</a>!\nsecond line'
		);
	} );

	test( 'undo reverts formatting, and pasted HTML keeps only allowed formatting', { tag: [ '@admin' ] }, async ( { page } ) => {
		const itemId = attachment( 'admin', 'Quiet harbour' );
		const { id } = galleryPage( {}, [ itemId ] );
		await openItem( page, id, itemId );

		const caption = page.locator( '#fotogrids-item-caption' );
		await caption.click();
		await page.keyboard.press( `ControlOrMeta+a` );
		await page.keyboard.press( `ControlOrMeta+i` );
		await expect( caption.locator( 'em' ) ).toHaveText( 'Quiet harbour' );
		await page.keyboard.press( `ControlOrMeta+z` );
		await expect( caption.locator( 'em' ) ).toHaveCount( 0 );

		await page.keyboard.press( 'End' );
		await caption.evaluate( ( el ) => {
			const data = new DataTransfer();
			data.setData( 'text/html', ' <b style="color:red">bold</b><img src=x onerror="window.__fgXss=1"><script>window.__fgXss=1</script>' );
			data.setData( 'text/plain', ' bold' );
			const event = new ClipboardEvent( 'paste', { bubbles: true, cancelable: true } );
			// Firefox empties the data of a scripted paste event, so it is attached directly.
			Object.defineProperty( event, 'clipboardData', { value: data } );
			el.dispatchEvent( event );
		} );
		await expect( caption.locator( 'b' ) ).toHaveText( 'bold' );
		await expect( caption.locator( 'img, script, [style]' ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => ( window as Window & { __fgXss?: number } ).__fgXss ) ).toBeUndefined();

		await saveItem( page, itemId );
		expect( stored( itemId ).caption ).toBe( 'Quiet harbour <b>bold</b>' );
	} );

	test( 'markup the editor cannot show opens in HTML mode and is kept', { tag: [ '@admin' ] }, async ( { page } ) => {
		const itemId = attachment( 'admin', '', 'Before <span class="note">kept</span> after' );
		const { id } = galleryPage( {}, [ itemId ] );
		await openItem( page, id, itemId );

		const description = page.locator( 'textarea#fotogrids-item-description' );
		await expect( description ).toHaveValue( 'Before <span class="note">kept</span> after' );
		await expect( tool( page, 'fotogrids-item-description', 'Visual' ) ).toHaveAttribute( 'aria-disabled', 'true' );

		await page.locator( '#fotogrids-item-title' ).fill( 'Renamed' );
		await saveItem( page, itemId );
		expect( stored( itemId ) ).toMatchObject( {
			title: 'Renamed',
			description: 'Before <span class="note">kept</span> after',
		} );

		await description.fill( 'Before <em>kept</em> after' );
		await expect( tool( page, 'fotogrids-item-description', 'Visual' ) ).not.toHaveAttribute( 'aria-disabled', 'true' );
		await tool( page, 'fotogrids-item-description', 'Visual' ).click();
		await expect( page.locator( 'div#fotogrids-item-description em' ) ).toHaveText( 'kept' );
		await saveItem( page, itemId );
		expect( stored( itemId ).description ).toBe( 'Before <em>kept</em> after' );
	} );
} );

test.describe( 'as an author without the permission', () => {
	test.use( { storageState: storageStateFor( 'author' ) } );

	let roles: string;

	test.beforeAll( () => {
		roles = snapshotRoles();
		wpEval( `get_role( 'author' )->remove_cap( '${ CAPABILITY }' );` );
	} );

	test.afterAll( () => {
		restoreRoles( roles );
	} );

	test( 'the toolbar says why it is off, and a title change keeps the formatting', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		const caption = 'By <a href="https://example.com/admin">the admin</a>';
		const itemId = attachment( 'fg-author', caption );
		const { id } = galleryPage( {}, [ itemId ], undefined, 'fg-author', 'draft' );
		await openItem( page, id, itemId );

		await expect( tool( page, 'fotogrids-item-caption', 'Bold' ) ).toHaveAttribute( 'aria-disabled', 'true' );
		await expect( page.locator( '.fotogrids-text-editor__reason' ).first() ).toContainText( "Your role can't add formatting" );
		await expect( page.locator( '#fotogrids-item-caption a' ) ).toHaveText( 'the admin' );

		await page.locator( '#fotogrids-item-title' ).fill( 'Retitled' );
		await saveItem( page, itemId );
		expect( stored( itemId ) ).toMatchObject( { title: 'Retitled', caption } );

		const area = page.locator( '#fotogrids-item-caption' );
		await area.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' too' );
		await saveItem( page, itemId );
		expect( stored( itemId ).caption ).toBe( 'By the admin too' );
	} );
} );

test.describe( 'the title field', () => {
	function storeTitle( id: number, title: string ): void {
		wpEval(
			`global $wpdb; $wpdb->update( $wpdb->posts, array( 'post_title' => base64_decode( '${ Buffer.from( title ).toString( 'base64' ) }' ) ), array( 'ID' => ${ id } ) ); clean_post_cache( ${ id } );`
		);
	}

	test.describe( 'as an administrator', () => {
		test.use( { storageState: storageStateFor( 'administrator' ) } );

		test( 'a title stored with entities shows its characters and is not rewritten', { tag: [ '@admin' ] }, async ( { page } ) => {
			const itemId = attachment( 'admin', 'Before' );
			storeTitle( itemId, 'Tom &amp; Jerry &quot;live&quot;' );
			const { id } = galleryPage( {}, [ itemId ] );
			await openItem( page, id, itemId );

			const title = page.locator( '#fotogrids-item-title' );
			await expect( title ).toHaveValue( 'Tom & Jerry "live"' );
			await expect( page.getByRole( 'button', { name: 'Save Changes' } ) ).toBeDisabled();

			const caption = page.locator( '#fotogrids-item-caption' );
			await caption.click();
			await page.keyboard.press( 'End' );
			await page.keyboard.type( ' after' );
			await saveItem( page, itemId );
			expect( stored( itemId ) ).toMatchObject( { title: 'Tom &amp; Jerry &quot;live&quot;', caption: 'Before after' } );

			await title.fill( 'Tom & Jerry' );
			await saveItem( page, itemId );
			expect( stored( itemId ).title ).toBe( 'Tom & Jerry' );
		} );
	} );

	test.describe( 'as an author', () => {
		test.use( { storageState: storageStateFor( 'author' ) } );

		test( 'a title the author saves reopens as typed', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
			const itemId = attachment( 'fg-author' );
			storeTitle( itemId, 'Fish &amp; Chips' );
			const { id } = galleryPage( {}, [ itemId ], undefined, 'fg-author', 'draft' );
			await openItem( page, id, itemId );

			const title = page.locator( '#fotogrids-item-title' );
			await expect( title ).toHaveValue( 'Fish & Chips' );

			await title.fill( 'Fish & Chips again' );
			await saveItem( page, itemId );
			expect( stored( itemId ).title ).toBe( 'Fish &amp; Chips again' );

			await openItem( page, id, itemId );
			await expect( page.locator( '#fotogrids-item-title' ) ).toHaveValue( 'Fish & Chips again' );
		} );
	} );
} );
