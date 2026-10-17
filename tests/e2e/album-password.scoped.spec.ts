import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import {
	album,
	galleryPage,
	shortcodePage,
	type Settings,
} from './support/collections';
import { wpEval } from './support/roles';

/**
 * Password-protected albums. Scoped: every collection here is the spec's own.
 */

const PASSWORD = 'album-secret';
const CHILD_TITLE = 'Album password child';

const GATE = '.fotogrids-gate';
const TILES = '.fotogrids-album .fg-item';

/** An album of two galleries, behind PASSWORD. */
function passwordAlbum(settings: Settings = {}): {
	id: number;
	url: string;
	view: string;
} {
	const first = galleryPage({}, undefined, CHILD_TITLE);
	const second = galleryPage({}, undefined, 'Album password sibling');
	const created = album([first.id, second.id], {
		password_protect: true,
		password_remember: true,
		...settings,
	});

	wpEval(
		`update_post_meta( ${created.id}, 'fotogrids_password', \\FotoGrids\\Password_Crypto::encrypt( '${PASSWORD}' ) );`
	);

	return created;
}

function albumRoute(albumId: number): string {
	return `/?rest_route=${encodeURIComponent(`/fotogrids/v1/album/${albumId}`)}`;
}

async function unlockThroughForm(
	page: Page,
	albumId: number,
	password: string
): Promise<void> {
	const form = page.locator(`.fg-lock-form[data-album-id="${albumId}"]`);
	await form.locator('.fg-lock-input').fill(password);
	await form.locator('.fg-lock-submit').click();
}

test.describe('a locked album', () => {
	test(
		'ALB-PW-01: an embed shows the lock form and none of the album',
		{ tag: ['@gate', '@critical'] },
		async ({ page }) => {
			const { id, url } = passwordAlbum();

			const response = await page.goto(url);
			expect(response?.status()).toBe(200);
			expect(
				response?.headers()['cache-control'] ?? '',
				'a gated page must not be page-cached'
			).toContain('no-store');

			await expect(page.locator(GATE)).toBeVisible();
			await expect(
				page.locator(`.fg-lock-form[data-album-id="${id}"]`)
			).toBeVisible();
			await expect(page.locator('.fotogrids-album')).toHaveCount(0);
			await expect(page.locator('.fg-item')).toHaveCount(0);
			expect(await page.content()).not.toContain(CHILD_TITLE);
		}
	);

	test(
		'ALB-PW-02: its view page is locked and shares no cover',
		{ tag: '@gate' },
		async ({ page }) => {
			const open = album([
				galleryPage({}, undefined, 'Album password control').id,
			]);
			await page.goto(open.view);
			await expect(
				page.locator('meta[property="og:image"]'),
				'control: an open album shares its cover'
			).toHaveCount(1);

			const { id, view } = passwordAlbum();
			await page.goto(view);

			await expect(
				page.locator(`.fg-lock-form[data-album-id="${id}"]`)
			).toBeVisible();
			await expect(page.locator('.fg-item')).toHaveCount(0);
			await expect(page.locator('meta[property="og:image"]')).toHaveCount(
				0
			);
			await expect(
				page.locator('meta[name="twitter:image"]')
			).toHaveCount(0);
			expect(await page.content()).not.toContain(CHILD_TITLE);
		}
	);

	test(
		'ALB-PW-03: the album REST read refuses it, and asks caches not to store the refusal',
		{ tag: ['@gate', '@cache', '@api'] },
		async ({ page }) => {
			const open = album([
				galleryPage({}, undefined, 'Album password control').id,
			]);
			const control = await page.request.get(albumRoute(open.id));
			expect(control.status()).toBe(200);
			expect(
				control.headers()['cache-control'] ?? '',
				'control: an ungated album read stays cacheable'
			).not.toContain('no-store');

			const { id } = passwordAlbum();

			const response = await page.request.get(albumRoute(id));

			expect(response.status()).toBe(401);
			expect(response.headers()['cache-control'] ?? '').toContain(
				'no-store'
			);
			expect(await response.text()).not.toContain(CHILD_TITLE);
		}
	);

	test.describe('given a wrong password', () => {
		test.use({
			allowConsoleErrors:
				'the row drives a 401, which the browser logs as a failed request',
		});

		test(
			'ALB-PW-04: it is refused and the gate stays',
			{ tag: '@gate' },
			async ({ page }) => {
				const { id, url } = passwordAlbum();
				await page.goto(url);

				const refused = page.waitForResponse(
					(response) =>
						response.url().includes('/unlock') &&
						401 === response.status()
				);
				await unlockThroughForm(page, id, 'not-the-password');
				await refused;

				await expect(page.locator('.fg-lock-error')).toBeVisible();
				await expect(page.locator(TILES)).toHaveCount(0);
			}
		);
	});
});

test.describe('the right password', () => {
	test(
		'ALB-PW-05: unlocks the album and is remembered',
		{ tag: ['@gate', '@critical'] },
		async ({ page }) => {
			const { id, url } = passwordAlbum();
			await page.goto(url);

			await unlockThroughForm(page, id, PASSWORD);
			await expect(page.locator(TILES)).toHaveCount(2, {
				timeout: 15000,
			});
			await expect(page.locator(GATE)).toHaveCount(0);

			const cookies = await page.context().cookies();
			expect(
				cookies.some(
					(cookie) => cookie.name === `fotogrids_unlocked_${id}`
				)
			).toBe(true);

			await page.reload();
			await expect(page.locator(TILES)).toHaveCount(2);

			const read = await page.request.get(albumRoute(id));
			expect(read.status()).toBe(200);
			expect(
				read.headers()['cache-control'] ?? '',
				'an unlocked read must not be stored for other visitors'
			).toContain('no-store');
		}
	);

	test(
		'ALB-PW-06: without remember, unlocks this page only',
		{ tag: '@gate' },
		async ({ page }) => {
			const { id, url } = passwordAlbum({ password_remember: false });
			await page.goto(url);

			await unlockThroughForm(page, id, PASSWORD);
			await expect(page.locator(TILES)).toHaveCount(2, {
				timeout: 15000,
			});

			const cookies = await page.context().cookies();
			expect(
				cookies.some(
					(cookie) => cookie.name === `fotogrids_unlocked_${id}`
				)
			).toBe(false);

			await page.reload();
			await expect(
				page.locator(`.fg-lock-form[data-album-id="${id}"]`)
			).toBeVisible();
			await expect(page.locator(TILES)).toHaveCount(0);
		}
	);
});

test(
	'an album embed keeps its template when unlocked in place',
	{ tag: ['@gate', '@layout'] },
	async ({ page }) => {
		const { id } = passwordAlbum({ layout: 'grid' });
		await page.goto(shortcodePage(id, 'template="masonry"', 'album').url);

		await unlockThroughForm(page, id, PASSWORD);
		await expect(page.locator(TILES)).toHaveCount(2, { timeout: 15000 });
		await expect(
			page.locator(`.fotogrids-album[data-fg-album-id="${id}"]`)
		).toHaveAttribute('data-fg-layout', 'masonry');
	}
);

test(
	'an album embed with an unknown template renders its saved layout after unlock and reload',
	{ tag: ['@gate', '@layout'] },
	async ({ page }) => {
		const { id } = passwordAlbum({ layout: 'masonry' });
		const wrapper = page.locator(
			`.fotogrids-album[data-fg-album-id="${id}"]`
		);
		await page.goto(
			shortcodePage(id, 'template="kaleidoscope"', 'album').url
		);

		await unlockThroughForm(page, id, PASSWORD);
		await expect(page.locator(TILES)).toHaveCount(2, { timeout: 15000 });
		await expect(wrapper).toHaveAttribute('data-fg-layout', 'masonry');

		await page.reload();

		await expect(page.locator(TILES)).toHaveCount(2);
		await expect(wrapper).toHaveAttribute('data-fg-layout', 'masonry');
		await expect(page.locator(GATE)).toHaveCount(0);
	}
);
