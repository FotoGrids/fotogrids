import { test, expect } from './support/test';
import { fixture } from './support/fixtures';
import { apiAnonymous, wpEval } from './support/roles';

/**
 * The public view page settings endpoint, read as a logged-out visitor.
 *
 * Readonly: reads seeded fixtures and changes nothing.
 */

const SITE_KEYS = [
	'index',
	'noindex',
	'layout_mode',
	'base_prefix',
	'base_gallery_segment',
	'base_album_segment',
	'accent_color',
	'theme',
	'max_width',
	'show_header',
	'show_footer',
	'integrated_show_title_block',
	'integrated_hide_featured_image',
	'integrated_allow_comments',
	'integrated_include_in_archives',
	'integrated_post_navigation',
].sort();

/**
 * A guest gets the site-wide view settings and the permalink of a published
 * collection, nothing of the collection's own settings, and a 404 for anything
 * not published or not a collection.
 */
test(
	'VIEW-15: GET /view/{id}/settings shows a guest only site view settings, and only for published collections',
	{ tag: ['@api', '@gate'] },
	async ({ playwright }) => {
		const guest = await apiAnonymous(playwright);
		const get = (id: number) =>
			guest.get(`/wp-json/fotogrids/v1/view/${id}/settings`);

		const locked = fixture<number>('F-pw', 'gallery');
		const response = await get(locked);
		expect(response.status()).toBe(200);
		const body = await response.json();

		expect(Object.keys(body).sort()).toEqual(['id', 'settings', 'url']);
		expect(body.id).toBe(locked);
		expect(body.url).toBe(
			wpEval(`echo get_permalink( ${locked} );`).trim()
		);
		expect(Object.keys(body.settings).sort()).toEqual(SITE_KEYS);

		const text = await response.text();
		const secret = wpEval(
			`echo get_post_meta( ${locked}, 'fotogrids_password', true );`
		).trim();
		expect(secret).not.toBe('');
		expect(text).not.toContain(secret);
		expect(text).not.toContain(fixture<string>('F-pw', 'password'));

		for (const hidden of [
			fixture<number>('F-draft', 'draft'),
			fixture<number>('F-draft', 'private'),
			fixture<number>('F-draft', 'trashed'),
			fixture<number[]>('F-small', 'items')[0],
			999999,
		]) {
			const miss = await get(hidden);
			expect(miss.status(), String(hidden)).toBe(404);
			expect((await miss.json()).code).toBe('fotogrids_not_found');
		}

		await guest.dispose();
	}
);
