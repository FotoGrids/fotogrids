import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { fixture } from './support/fixtures';
import { pageFor } from './support/collections';
import { storageStateFor, wpCli } from './support/roles';
import { GalleryEditor } from './support/gallery-editor';

/**
 * SEC-19. A gallery's password never reaches the browser.
 *
 * Settings carry the ciphertext under `_password_encrypted` and blank the public
 * `password` key. The editor ships those settings wholesale, so it is the
 * payload the blanking exists for.
 *
 * Scoped: the page is this spec's; the fixture gallery is only read.
 */

/** The stored ciphertext, read where the browser cannot. */
function storedCiphertext( galleryId: number ): string {
	return execFileSync(
		wpCli(),
		[ 'post', 'meta', 'get', String( galleryId ), 'fotogrids_password' ],
		{ encoding: 'utf8' }
	).trim();
}

/** Neither secret, in whatever a client was handed. */
function expectNoSecrets(
	payload: string,
	{ password, ciphertext }: { password: string; ciphertext: string },
	where: string
): void {
	expect( payload, `${ where }: the plaintext password` ).not.toContain( password );
	expect( payload, `${ where }: the stored ciphertext` ).not.toContain( ciphertext );
	expect( payload, `${ where }: the ciphertext's key` ).not.toContain( '_password_encrypted' );
}

test.describe( 'the editor screen', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'the settings payload carries neither the password nor its ciphertext', { tag: [ '@gate', '@settings' ] }, async ( {
		page,
	} ) => {
		const galleryId = fixture< number >( 'F-pw', 'gallery' );
		const password = fixture< string >( 'F-pw', 'password' );
		const ciphertext = storedCiphertext( galleryId );

		expect( ciphertext, 'the fixture gallery has no stored password' ).not.toBe( '' );
		expect( ciphertext, 'the password is stored in the clear' ).not.toContain( password );

		await new GalleryEditor( page ).open( galleryId );

		const payload = await page.evaluate( () =>
			JSON.stringify( window.fotogridsSettings ?? null )
		);

		// Otherwise the assertions below would hold on an empty object.
		expect( payload, 'the editor handed the browser no settings' ).toContain( 'layout' );

		expectNoSecrets( payload, { password, ciphertext }, 'the editor settings payload' );
		expectNoSecrets( await page.content(), { password, ciphertext }, 'the editor screen' );
	} );
} );

test( 'the lock screen carries neither, and the unlock cookie is not the ciphertext', { tag: [ '@gate', '@settings' ] }, async ( {
	page,
} ) => {
	const galleryId = fixture< number >( 'F-pw', 'gallery' );
	const password = fixture< string >( 'F-pw', 'password' );
	const ciphertext = storedCiphertext( galleryId );
	const { url } = pageFor( galleryId );

	await page.goto( url );
	expectNoSecrets( await page.content(), { password, ciphertext }, 'the lock screen' );

	// page.request shares the cookie jar, so this unlocks it for the reload.
	const unlock = await page.request.post(
		`/?rest_route=${ encodeURIComponent( `/fotogrids/v1/gallery/${ galleryId }/unlock` ) }`,
		{ data: { password } }
	);
	expect( unlock.status() ).toBe( 200 );

	await page.reload();
	expectNoSecrets( await page.content(), { password, ciphertext }, 'the unlocked gallery' );

	const unlockCookie = ( await page.context().cookies() ).find( ( cookie ) =>
		cookie.name.startsWith( `fotogrids_unlocked_${ galleryId }` )
	);

	expect( unlockCookie, 'the unlock left no cookie, so nothing was proven' ).toBeDefined();
	expect( unlockCookie?.value, 'the cookie is the ciphertext itself' ).not.toBe( ciphertext );
	expect( unlockCookie?.value ).not.toContain( password );
} );
