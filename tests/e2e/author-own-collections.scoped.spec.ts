import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adopt, album, galleryPage } from './support/collections';
import { storageStateFor, wpCli } from './support/roles';

/**
 * ROLE-03 and ROLE-04. An author's own galleries and albums, in every state they
 * can put them in, and everyone else's.
 *
 * Publishing moves a post onto `edit_published_*` and `delete_published_*`, so
 * each row is checked for a gallery and an album, before and after publishing.
 *
 * Scoped: every collection here is created by the test that reads it.
 */

const AUTHOR = 'fg-author';

const KINDS = [
	{ kind: 'gallery', type: 'fotogrids_gallery' },
	{ kind: 'album', type: 'fotogrids_album' },
] as const;

type Kind = ( typeof KINDS )[ number ][ 'kind' ];

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

function stored( id: number, field: string ): string {
	return wp( [ 'post', 'get', String( id ), `--field=${ field }` ] );
}

/** A collection of either kind, owned and in the state asked for. */
function make( kind: Kind, owner: string, status: string, title: string ): number {
	return 'gallery' === kind
		? galleryPage( { layout: 'grid' }, undefined, title, owner, status ).id
		: album( [], {}, title, owner, status ).id;
}

/** Open the editor and report what the server answered. */
async function open( page: Page, id: number ): Promise< number | undefined > {
	const response = await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	return response?.status();
}

/** Press Publish or Update, and wait for WordPress to take the form. */
async function submit( page: Page ): Promise< void > {
	await Promise.all( [
		page.waitForResponse(
			( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() )
		),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );
}

test.describe( 'an author', () => {
	test.use( { storageState: storageStateFor( 'author' ) } );

	for ( const { kind, type } of KINDS ) {
		test( `ROLE-03: publishing a new ${ kind } returns the author to its editor`, { tag: [ '@critical', '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			await page.goto( `/wp-admin/post-new.php?post_type=${ type }` );
			await page.locator( '#title' ).fill( `Published by an author (${ kind })` );

			await submit( page );

			const id = Number( new URL( page.url() ).searchParams.get( 'post' ) );
			expect( id, `publishing left the author on ${ page.url() }` ).toBeGreaterThan( 0 );
			adopt( id );

			expect( stored( id, 'post_status' ) ).toBe( 'publish' );
			expect( new URL( page.url() ).pathname ).toBe( '/wp-admin/post.php' );
			await expect( page.locator( '#title' ) ).toHaveValue(
				`Published by an author (${ kind })`
			);
		} );

		test( `ROLE-03: renames an own published ${ kind } with Update`, { tag: [ '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			const id = make( kind, AUTHOR, 'publish', 'Before' );

			expect( await open( page, id ) ).toBe( 200 );
			await page.locator( '#title' ).fill( 'After' );
			await submit( page );

			expect( stored( id, 'post_title' ) ).toBe( 'After' );
			expect( stored( id, 'post_status' ) ).toBe( 'publish' );
		} );

		test( `ROLE-03: opens an own ${ kind } in every other state`, { tag: [ '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			for ( const status of [ 'draft', 'pending', 'private' ] ) {
				const id = make( kind, AUTHOR, status, `Own ${ status }` );
				expect( await open( page, id ), `own ${ status } ${ kind }` ).toBe( 200 );
			}

			const scheduled = make( kind, AUTHOR, 'draft', 'Own scheduled' );
			// Without edit_date, WordPress keeps a draft's date at now and publishes it.
			wp( [
				'eval',
				`wp_update_post( array( 'ID' => ${ scheduled }, 'post_status' => 'future', 'post_date' => '2099-01-01 10:00:00', 'edit_date' => true ) );`,
			] );
			expect( stored( scheduled, 'post_status' ) ).toBe( 'future' );
			expect( await open( page, scheduled ), `own scheduled ${ kind }` ).toBe( 200 );
		} );
	}

	test( 'ROLE-07: saves content on an own published gallery and is still refused its settings', { tag: [ '@permissions', '@settings' ] }, async ( {
		page,
	} ) => {
		const { id } = galleryPage( { layout: 'grid' }, undefined, 'Content', AUTHOR, 'publish' );

		expect( await open( page, id ) ).toBe( 200 );
		const nonce = await page.locator( '#fotogrids_meta_box_nonce' ).first().inputValue();

		const response = await page.request.post( '/wp-admin/admin-ajax.php', {
			form: {
				action: 'fotogrids_save_collection',
				nonce,
				post_id: String( id ),
				post_title: 'Content saved',
				fotogrids_layout: 'masonry',
			},
		} );
		const body = ( await response.json() ) as {
			success: boolean;
			data?: { skipped_for_permissions?: string[] };
		};

		expect( body.success ).toBe( true );
		expect( stored( id, 'post_title' ) ).toBe( 'Content saved' );
		expect( wp( [ 'post', 'meta', 'get', String( id ), 'fotogrids_layout' ] ) ).toBe( 'grid' );
		expect( body.data?.skipped_for_permissions ?? [] ).toContain( 'layout' );
	} );
} );

test.describe( 'an author, trashing', () => {
	test.use( {
		storageState: storageStateFor( 'author' ),
		allowConsoleErrors:
			'trashing redirects to the list screen, which answers 403 for an author — FotoGrids/backstage#382',
	} );

	for ( const { kind } of KINDS ) {
		test( `ROLE-03: moves an own published ${ kind } to the trash`, { tag: [ '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			const id = make( kind, AUTHOR, 'publish', 'Trash me' );

			try {
				expect( await open( page, id ) ).toBe( 200 );

				const trash = page.locator( '#delete-action a.submitdelete' );
				await expect( trash, 'no Move to Trash link was offered' ).toBeVisible();
				await Promise.all( [ page.waitForURL( /trashed=1/ ), trash.click() ] );

				expect( stored( id, 'post_status' ) ).toBe( 'trash' );
			} finally {
				// The purge does not look in the trash.
				wp( [ 'post', 'delete', String( id ), '--force' ] );
			}
		} );
	}
} );

test.describe( 'an author, on collections they do not own', () => {
	test.use( {
		storageState: storageStateFor( 'author' ),
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	for ( const { kind } of KINDS ) {
		test( `ROLE-04: is refused another user's ${ kind } in every state`, { tag: [ '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			for ( const owner of [ 'admin', 'fg-editor' ] ) {
				for ( const status of [ 'publish', 'draft', 'pending', 'private' ] ) {
					const id = make( kind, owner, status, `${ owner } ${ status }` );
					expect( await open( page, id ), `${ owner }'s ${ status } ${ kind }` ).toBe( 403 );
				}
			}
		} );

		test( `ROLE-04: cannot trash another user's published ${ kind }`, { tag: [ '@permissions', '@admin' ] }, async ( {
			page,
		} ) => {
			const id = make( kind, 'admin', 'publish', 'Not theirs' );

			const response = await page.goto( `/wp-admin/post.php?post=${ id }&action=trash` );

			expect( response?.status() ).toBe( 403 );
			expect( stored( id, 'post_status' ) ).toBe( 'publish' );
		} );
	}
} );

test.describe( "other roles, on an author's published collection", () => {
	for ( const { kind } of KINDS ) {
		test( `ROLE-04: an editor opens and renames an author's published ${ kind }`, { tag: [ '@permissions', '@admin' ] }, async ( {
			browser,
		} ) => {
			const id = make( kind, AUTHOR, 'publish', 'Author owned' );
			const context = await browser.newContext( { storageState: storageStateFor( 'editor' ) } );
			const page = await context.newPage();

			expect( await open( page, id ) ).toBe( 200 );
			await page.locator( '#title' ).fill( 'Renamed by an editor' );
			await submit( page );

			expect( stored( id, 'post_title' ) ).toBe( 'Renamed by an editor' );
			await context.close();
		} );

		test( `ROLE-05: a contributor and a subscriber are refused an author's published ${ kind }`, { tag: [ '@permissions', '@admin' ] }, async ( {
			browser,
		} ) => {
			const id = make( kind, AUTHOR, 'publish', 'Author owned' );

			for ( const role of [ 'contributor', 'subscriber' ] as const ) {
				const context = await browser.newContext( { storageState: storageStateFor( role ) } );
				const page = await context.newPage();

				expect( await open( page, id ), role ).toBe( 403 );
				await context.close();
			}
		} );
	}
} );
