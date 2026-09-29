import { execFileSync } from 'child_process';
import { test, expect } from './support/test';
import { fixture } from './support/fixtures';
import { pageFor } from './support/collections';
import { storageStateFor, wpCli } from './support/roles';
import { GalleryEditor } from './support/gallery-editor';

/**
 * SEC-19. A gallery's password never reaches the browser.
 *
 * The plaintext is encrypted at rest, and `Gallery_Repository::get_settings()`
 * carries the ciphertext under a synthetic `_password_encrypted` key while
 * blanking the public `password` one. The editor is where those settings are
 * handed to the browser wholesale, so that is the payload it exists for.
 *
 * Scoped: the page is this spec's; the fixture gallery it renders is only read.
 */

/** The stored ciphertext, read the way nothing in the browser can. */
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

	/**
	 * The editor is where a gallery's settings are handed to the browser
	 * wholesale, so it is the payload the blanking exists for.
	 */
	test( 'the settings payload carries neither the password nor its ciphertext', async ( {
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

		// The payload really is this gallery's settings, or the assertions
		// below would hold just as well on an empty object.
		expect( payload, 'the editor handed the browser no settings' ).toContain( 'layout' );

		expectNoSecrets( payload, { password, ciphertext }, 'the editor settings payload' );
		expectNoSecrets( await page.content(), { password, ciphertext }, 'the editor screen' );
	} );
} );

test( 'the lock screen carries neither, and the unlock cookie is not the ciphertext', async ( {
	page,
} ) => {
	const galleryId = fixture< number >( 'F-pw', 'gallery' );
	const password = fixture< string >( 'F-pw', 'password' );
	const ciphertext = storedCiphertext( galleryId );
	const { url } = pageFor( galleryId );

	await page.goto( url );
	expectNoSecrets( await page.content(), { password, ciphertext }, 'the lock screen' );

	// page.request shares the page's cookie jar, so this unlocks the gallery
	// for the reload below exactly as the lock screen's own form would.
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
