/**
 * Saving walkthrough progress.
 */
import { saveState } from '@modules/Walkthrough/assets/src/utils/api';

const config = {
	ajaxUrl: '/wp-admin/admin-ajax.php',
	nonce: 'n0nce',
	preference: 'walkthrough',
};

afterEach(() => {
	delete window.fetch;
});

it('posts the tour state to the user preference action', async () => {
	window.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: true }),
		})
	);

	await expect(saveState('gallery', 'done', config)).resolves.toBe(true);

	const [url, options] = window.fetch.mock.calls[0];
	expect(url).toBe(config.ajaxUrl);
	expect(options.method).toBe('POST');
	expect(options.keepalive).toBe(true);
	expect(options.body.get('action')).toBe('fotogrids_update_user_preference');
	expect(options.body.get('nonce')).toBe('n0nce');
	expect(options.body.get('preference')).toBe('walkthrough');
	expect(options.body.get('value')).toBe('gallery:done');
});

it('reports a refused save as false', async () => {
	window.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: false }),
		})
	);
	await expect(saveState('album', 'skipped', config)).resolves.toBe(false);
});

it('reports an HTTP error as false', async () => {
	window.fetch = jest.fn(() => Promise.resolve({ ok: false }));
	await expect(saveState('album', 'skipped', config)).resolves.toBe(false);
});

it('swallows a network failure', async () => {
	window.fetch = jest.fn(() => Promise.reject(new Error('offline')));
	await expect(saveState('dashboard', 'done', config)).resolves.toBe(false);
});

it('does nothing without an endpoint', async () => {
	window.fetch = jest.fn();
	await expect(saveState('gallery', 'done', {})).resolves.toBe(false);
	expect(window.fetch).not.toHaveBeenCalled();
});

it('reads the localised config by default', async () => {
	window.fotogridsWalkthrough = config;
	window.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ success: true }),
		})
	);
	await saveState('gallery', 'skipped');
	expect(window.fetch.mock.calls[0][1].body.get('preference')).toBe(
		'walkthrough'
	);
	delete window.fotogridsWalkthrough;
});
