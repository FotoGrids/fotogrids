/**
 * Tests for components/setup-wizard/persist-setting.js
 */
import {
	persistSetting,
	persistUserPreference,
} from '@/admin/src/components/setup-wizard/persist-setting';

describe('persistSetting', () => {
	beforeEach(() => {
		window.fotogridsAdmin = {
			ajaxUrl: 'https://x/admin-ajax.php',
			nonce: 'n',
		};
	});

	afterEach(() => {
		delete window.fotogridsAdmin;
	});

	it('no-ops without an ajax url or nonce', async () => {
		window.fotogridsAdmin = {};
		delete window.ajaxurl;
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		await expect(persistSetting('fotogrids_x', '1')).resolves.toEqual({
			ok: false,
		});
		warn.mockRestore();
	});

	it('posts the setting and returns the saved value on success', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({ success: true, data: { value: '1' } }),
			})
		);
		const res = await persistSetting('fotogrids_share_statistics', true);
		expect(res).toEqual({ ok: true, value: '1' });
		const body = global.fetch.mock.calls[0][1].body;
		expect(body.get('action')).toBe('fotogrids_update_plugin_setting');
		expect(body.get('value')).toBe('1'); // boolean true -> '1'
	});

	it('mirrors saved values back into fotogridsAdmin globals', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						success: true,
						data: { value: 'advanced' },
					}),
			})
		);
		window.fotogridsAdmin.settingsMode = 'easy';
		await persistSetting('fotogrids_settings_mode', 'advanced');
		expect(window.fotogridsAdmin.siteSettingsMode).toBe('advanced');
		expect(window.fotogridsAdmin.settingsMode).toBe('easy');
	});

	it('returns ok:false on a non-OK HTTP response', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() =>
			Promise.resolve({ ok: false, status: 500 })
		);
		await expect(persistSetting('fotogrids_x', 'v')).resolves.toEqual({
			ok: false,
		});
		warn.mockRestore();
	});

	it('returns ok:false when the server refuses', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: false }),
			})
		);
		await expect(persistSetting('fotogrids_x', 'v')).resolves.toEqual({
			ok: false,
		});
		warn.mockRestore();
	});

	it('returns ok:false when fetch throws', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.reject(new Error('down')));
		await expect(persistSetting('fotogrids_x', 'v')).resolves.toEqual({
			ok: false,
		});
		warn.mockRestore();
	});

	it('falls back to the input value when the response omits data.value', async () => {
		global.fetch = jest.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true, data: {} }),
			})
		);
		const res = await persistSetting(
			'fotogrids_user_persona',
			'photographer'
		);
		expect(res).toEqual({ ok: true, value: 'photographer' });
		expect(window.fotogridsAdmin.userPersona).toBe('photographer');
	});
});

describe('persistUserPreference', () => {
	const respond = (json) =>
		jest.fn(() =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(json) })
		);

	beforeEach(() => {
		window.fotogridsAdmin = {
			ajaxUrl: 'https://x/admin-ajax.php',
			nonce: 'n',
			settingsMode: 'easy',
			siteSettingsMode: 'easy',
			showSettingsModeTip: '1',
		};
	});

	afterEach(() => {
		delete window.fotogridsAdmin;
	});

	it('posts the preference with the admin nonce', async () => {
		global.fetch = respond({ success: true, data: { value: 'advanced' } });
		await persistUserPreference('settings_mode', 'advanced');
		const [url, init] = global.fetch.mock.calls[0];
		expect(url).toBe('https://x/admin-ajax.php');
		expect(init.body.get('action')).toBe(
			'fotogrids_update_user_preference'
		);
		expect(init.body.get('nonce')).toBe('n');
		expect(init.body.get('preference')).toBe('settings_mode');
		expect(init.body.get('value')).toBe('advanced');
	});

	it('mirrors a saved mode into settingsMode only', async () => {
		global.fetch = respond({ success: true, data: { value: 'advanced' } });
		const res = await persistUserPreference('settings_mode', 'advanced');
		expect(res).toEqual({ ok: true, value: 'advanced' });
		expect(window.fotogridsAdmin.settingsMode).toBe('advanced');
		expect(window.fotogridsAdmin.siteSettingsMode).toBe('easy');
	});

	it('clears showSettingsModeTip when the tip is dismissed', async () => {
		global.fetch = respond({ success: true, data: { value: '1' } });
		await persistUserPreference('settings_mode_tip_dismissed', '1');
		expect(window.fotogridsAdmin.showSettingsModeTip).toBe('');
	});

	it('leaves globals alone when the server refuses', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = respond({ success: false });
		await expect(
			persistUserPreference('settings_mode', 'advanced')
		).resolves.toEqual({ ok: false });
		expect(window.fotogridsAdmin.settingsMode).toBe('easy');
		warn.mockRestore();
	});

	it('no-ops without a nonce', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		window.fotogridsAdmin = { ajaxUrl: 'https://x/admin-ajax.php' };
		global.fetch = jest.fn();
		await expect(
			persistUserPreference('settings_mode', 'easy')
		).resolves.toEqual({ ok: false });
		expect(global.fetch).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
