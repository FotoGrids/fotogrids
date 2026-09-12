import { execFileSync } from 'child_process';
import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * API-layer checks that the REST routes returning gallery item data outside
 * the render pipeline apply the same access rules as a rendered gallery, and
 * that the template preview requires an editor.
 *
 * Fixtures are created with WP-CLI: `npx wp-env run cli wp` by default, or the
 * command in WP_CLI when running against another site.
 */

const BASE_URL = process.env.WP_BASE_URL ?? 'http://localhost:8888';
const ADMIN_USER = process.env.WP_ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.WP_ADMIN_PASS ?? 'password';
const SUBSCRIBER_USER = 'fg-rest-subscriber';
const SUBSCRIBER_PASS = 'fg-rest-subscriber-pass';
const GALLERY_PASSWORD = 'open-sesame';

type Fixtures = {
	item: number;
	orphan: number;
	publicGallery: number;
	registeredGallery: number;
	passwordGallery: number;
	guestNonce: string;
};

const FIXTURE_PHP = String.raw`
require_once ABSPATH . 'wp-admin/includes/image.php';
$png = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' );
$attachment = function ( $name ) use ( $png ) {
	$upload = wp_upload_bits( $name . '.png', null, $png );
	$id     = wp_insert_attachment( array( 'post_mime_type' => 'image/png', 'post_title' => $name, 'post_content' => 'Private description', 'post_status' => 'inherit' ), $upload['file'] );
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );
	return $id;
};
$gallery = function ( $title, $items, $meta ) {
	$id = wp_insert_post( array( 'post_type' => 'fotogrids_gallery', 'post_status' => 'publish', 'post_title' => $title ) );
	update_post_meta( $id, 'fotogrids_gallery_items', wp_json_encode( $items ) );
	foreach ( $meta as $key => $value ) {
		update_post_meta( $id, $key, $value );
	}
	return $id;
};
$item   = $attachment( 'fg-rest-item' );
$orphan = $attachment( 'fg-rest-orphan' );
$user   = username_exists( '${SUBSCRIBER_USER}' );
if ( ! $user ) {
	$user = wp_insert_user( array( 'user_login' => '${SUBSCRIBER_USER}', 'user_pass' => '${SUBSCRIBER_PASS}', 'user_email' => 'fg-rest-subscriber@example.com', 'role' => 'subscriber' ) );
}
wp_set_password( '${SUBSCRIBER_PASS}', $user );
wp_set_current_user( 0 );
echo 'FGFIXTURES' . wp_json_encode( array(
	'item'              => $item,
	'orphan'            => $orphan,
	'publicGallery'     => $gallery( 'REST auth public', array( $item ), array() ),
	'registeredGallery' => $gallery( 'REST auth registered', array( $item ), array( 'fotogrids_who_can_view' => 'registered_users' ) ),
	'passwordGallery'   => $gallery( 'REST auth password', array( $item ), array(
		'fotogrids_password_protect'  => '1',
		'fotogrids_password_remember' => '1',
		'fotogrids_password'          => \FotoGrids\Password_Crypto::encrypt( '${GALLERY_PASSWORD}' ),
	) ),
	'guestNonce'        => wp_create_nonce( 'wp_rest' ),
) );
`;

function createFixtures(): Fixtures {
	const cli = process.env.WP_CLI
		? process.env.WP_CLI.split(' ')
		: ['npx', 'wp-env', 'run', 'cli', 'wp'];
	const output = execFileSync(
		cli[0],
		[...cli.slice(1), 'eval', FIXTURE_PHP],
		{ encoding: 'utf8' }
	);
	const match = output.match(/FGFIXTURES(\{.*\})/);
	if (!match) {
		throw new Error(`Fixture script printed no fixtures:\n${output}`);
	}
	return JSON.parse(match[1]);
}

function route(path: string, query: Record<string, string | number> = {}) {
	const params = new URLSearchParams({ rest_route: path });
	for (const [key, value] of Object.entries(query)) {
		params.set(key, String(value));
	}
	return `/?${params.toString()}`;
}

async function signIn(
	playwright: typeof import('@playwright/test'),
	user: string,
	pass: string
): Promise<{ context: APIRequestContext; nonce: string }> {
	const context = await playwright.request.newContext({ baseURL: BASE_URL });
	await context.get('/wp-login.php');
	await context.post('/wp-login.php', {
		form: {
			log: user,
			pwd: pass,
			'wp-submit': 'Log In',
			redirect_to: '/wp-admin/',
			testcookie: '1',
		},
		maxRedirects: 0,
	});
	const nonceResponse = await context.get(
		'/wp-admin/admin-ajax.php?action=rest-nonce'
	);
	const nonce = (await nonceResponse.text()).trim();
	expect(nonce, `rest-nonce for ${user}`).toMatch(/^[0-9a-f]{10}$/);
	return { context, nonce };
}

function slides(galleryId: number) {
	return { data: { gallery_id: galleryId, offset: 0, limit: 10 } };
}

test.describe.configure({ mode: 'serial' });

test.describe('REST routes that return item data outside the render pipeline', () => {
	let fx: Fixtures;
	let anon: APIRequestContext;

	test.beforeAll(async ({ playwright }) => {
		fx = createFixtures();
		anon = await playwright.request.newContext({ baseURL: BASE_URL });
	});

	test.afterAll(async () => {
		await anon.dispose();
	});

	test('SEC-01: an anonymous lightbox item request with no gallery is refused', async () => {
		const response = await anon.get(
			route(`/fotogrids/v1/lightbox/item/${fx.orphan}`)
		);
		expect(response.status()).toBe(401);
	});

	test('SEC-01: naming a public gallery does not unlock an item outside it', async () => {
		const response = await anon.get(
			route(`/fotogrids/v1/lightbox/item/${fx.orphan}`, {
				gallery_id: fx.publicGallery,
			})
		);
		expect(response.status()).toBe(401);
	});

	test('an item in a public gallery stays readable anonymously', async () => {
		const response = await anon.get(
			route(`/fotogrids/v1/lightbox/item/${fx.item}`, {
				gallery_id: fx.publicGallery,
			})
		);
		expect(response.status()).toBe(200);
		expect((await response.json()).id).toBe(fx.item);
	});

	test('SEC-02: a lightbox item in a password gallery is refused until unlocked', async ({
		playwright,
	}) => {
		const itemRoute = route(`/fotogrids/v1/lightbox/item/${fx.item}`, {
			gallery_id: fx.passwordGallery,
		});
		expect((await anon.get(itemRoute)).status()).toBe(401);

		const visitor = await playwright.request.newContext({
			baseURL: BASE_URL,
		});
		const unlock = await visitor.post(
			route(`/fotogrids/v1/gallery/${fx.passwordGallery}/unlock`),
			{ data: { password: GALLERY_PASSWORD } }
		);
		expect(unlock.status()).toBe(200);
		expect((await visitor.get(itemRoute)).status()).toBe(200);
		await visitor.dispose();
	});

	test('SEC-02: a lightbox item in a registered-users gallery needs a signed-in visitor', async ({
		playwright,
	}) => {
		const itemRoute = route(`/fotogrids/v1/lightbox/item/${fx.item}`, {
			gallery_id: fx.registeredGallery,
		});
		expect((await anon.get(itemRoute)).status()).toBe(401);

		const { context, nonce } = await signIn(
			playwright,
			SUBSCRIBER_USER,
			SUBSCRIBER_PASS
		);
		const response = await context.get(itemRoute, {
			headers: { 'X-WP-Nonce': nonce },
		});
		expect(response.status()).toBe(200);
		await context.dispose();
	});

	test('SEC-03: lightbox slides for a registered-users gallery need a signed-in visitor', async ({
		playwright,
	}) => {
		const slidesRoute = route('/fotogrids/v1/gallery/lightbox/slides');
		expect(
			(
				await anon.post(slidesRoute, slides(fx.registeredGallery))
			).status()
		).toBe(401);

		const { context, nonce } = await signIn(
			playwright,
			SUBSCRIBER_USER,
			SUBSCRIBER_PASS
		);
		const response = await context.post(slidesRoute, {
			...slides(fx.registeredGallery),
			headers: { 'X-WP-Nonce': nonce },
		});
		expect(response.status()).toBe(200);
		expect((await response.json()).total).toBe(1);
		await context.dispose();
	});

	test('SEC-04: lightbox slides for a password gallery are refused until unlocked', async ({
		playwright,
	}) => {
		const slidesRoute = route('/fotogrids/v1/gallery/lightbox/slides');
		expect(
			(await anon.post(slidesRoute, slides(fx.passwordGallery))).status()
		).toBe(401);

		const visitor = await playwright.request.newContext({
			baseURL: BASE_URL,
		});
		await visitor.post(
			route(`/fotogrids/v1/gallery/${fx.passwordGallery}/unlock`),
			{ data: { password: GALLERY_PASSWORD } }
		);
		const response = await visitor.post(
			slidesRoute,
			slides(fx.passwordGallery)
		);
		expect(response.status()).toBe(200);
		expect((await response.json()).total).toBe(1);
		await visitor.dispose();
	});

	test('lightbox slides for a public gallery stay readable anonymously', async () => {
		const response = await anon.post(
			route('/fotogrids/v1/gallery/lightbox/slides'),
			slides(fx.publicGallery)
		);
		expect(response.status()).toBe(200);
		expect((await response.json()).total).toBe(1);
	});

	test('SEC-05: the template preview needs an editor, whatever nonce is sent', async ({
		playwright,
	}) => {
		const preview = (nonce?: string) =>
			route('/fotogrids/v1/templates/preview', {
				template_id: 'clean-grid',
				category: 'gallery',
				...(nonce ? { _wpnonce: nonce } : {}),
			});

		expect((await anon.get(preview())).status()).toBe(401);
		// Core answers a malformed nonce with rest_cookie_invalid_nonce (403).
		expect([401, 403]).toContain(
			(await anon.get(preview('0123456789'))).status()
		);
		expect((await anon.get(preview(fx.guestNonce))).status()).toBe(401);

		const subscriber = await signIn(
			playwright,
			SUBSCRIBER_USER,
			SUBSCRIBER_PASS
		);
		expect(
			(await subscriber.context.get(preview(subscriber.nonce))).status()
		).toBe(403);
		await subscriber.context.dispose();

		const admin = await signIn(playwright, ADMIN_USER, ADMIN_PASS);
		const response = await admin.context.get(preview(admin.nonce));
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/html');
		await admin.context.dispose();
	});
});
