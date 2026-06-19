/**
 * Tests for components/setup-wizard/persist-setting.js
 */
import { persistSetting } from '@/admin/src/components/setup-wizard/persist-setting';

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
				json: () => Promise.resolve({ success: true, data: { value: '1' } }),
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
					Promise.resolve({ success: true, data: { value: 'advanced' } }),
			})
		);
		await persistSetting('fotogrids_settings_mode', 'advanced');
		expect(window.fotogridsAdmin.settingsMode).toBe('advanced');
	});

	it('returns ok:false on a non-OK HTTP response', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));
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
		const res = await persistSetting('fotogrids_user_persona', 'photographer');
		expect(res).toEqual({ ok: true, value: 'photographer' });
		expect(window.fotogridsAdmin.userPersona).toBe('photographer');
	});
});
