/**
 * Tests for the Settings > Defaults Setup Mode panel and its helpers.
 */
import React, { act } from 'react';
import SetupModePanel from '@/admin/src/components/plugin-settings/setup-mode/SetupModePanel';
import {
	buildSaveBody,
	canEditSiteMode,
	changeSiteMode,
	normalizeMode,
	readSiteMode,
	saveSiteMode,
} from '@/admin/src/components/plugin-settings/setup-mode/setup-mode';
import { renderElement } from '@tests/helpers/render-component';

const h = React.createElement;

const jsonResponse = (body, ok = true) => ({
	ok,
	json: () => Promise.resolve(body),
});

const flush = () =>
	act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});

let view;

beforeEach(() => {
	window.fotogridsAdmin = {
		ajaxUrl: '/wp-admin/admin-ajax.php',
		nonce: 'abc123',
		siteSettingsMode: 'easy',
		settingsMode: 'advanced',
		capabilities: { manage_fotogrids_settings: true },
	};
	window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
	window.fetch = jest.fn(() =>
		Promise.resolve(jsonResponse({ success: true, data: { value: 'advanced' } }))
	);
});

afterEach(() => {
	view?.unmount();
	view = null;
	delete window.fotogridsToast;
	delete window.fetch;
});

const mount = () => {
	view = renderElement(h(SetupModePanel));
	return view.container;
};

const radio = (container, value) =>
	container.querySelector(`input[type="radio"][value="${value}"]`);

const click = (node) =>
	act(() => {
		node.click();
	});

describe('helpers', () => {
	test('normalizeMode falls back to easy', () => {
		expect(normalizeMode('advanced')).toBe('advanced');
		expect(normalizeMode('easy')).toBe('easy');
		expect(normalizeMode('')).toBe('easy');
		expect(normalizeMode(undefined)).toBe('easy');
		expect(normalizeMode('expert')).toBe('easy');
	});

	test('readSiteMode reads the site default, not the user mode', () => {
		expect(readSiteMode()).toBe('easy');
		expect(readSiteMode({ siteSettingsMode: 'advanced', settingsMode: 'easy' })).toBe(
			'advanced'
		);
		expect(readSiteMode(undefined)).toBe('easy');
	});

	test('canEditSiteMode is false only when the capability is explicitly missing', () => {
		expect(canEditSiteMode({ capabilities: { manage_fotogrids_settings: true } })).toBe(true);
		expect(canEditSiteMode({ capabilities: { manage_fotogrids_settings: false } })).toBe(
			false
		);
		expect(canEditSiteMode({})).toBe(true);
		expect(canEditSiteMode(undefined)).toBe(true);
	});

	test('buildSaveBody targets the site option', () => {
		const body = buildSaveBody('advanced', 'n1');
		expect(body.get('action')).toBe('fotogrids_update_plugin_setting');
		expect(body.get('nonce')).toBe('n1');
		expect(body.get('setting')).toBe('fotogrids_settings_mode');
		expect(body.get('value')).toBe('advanced');
		expect(buildSaveBody('easy', undefined).get('nonce')).toBe('');
	});

	test('saveSiteMode posts to admin-ajax and returns the saved value', async () => {
		const fetchFn = jest.fn(() =>
			Promise.resolve(jsonResponse({ success: true, data: { value: 'advanced' } }))
		);
		const result = await saveSiteMode('advanced', window.fotogridsAdmin, fetchFn);

		expect(result).toEqual({ ok: true, value: 'advanced' });
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('/wp-admin/admin-ajax.php');
		expect(init.method).toBe('POST');
		expect(init.body.get('setting')).toBe('fotogrids_settings_mode');
	});

	test('saveSiteMode falls back to the requested mode when the response has no value', async () => {
		const fetchFn = () => Promise.resolve(jsonResponse({ success: true }));
		await expect(saveSiteMode('advanced', window.fotogridsAdmin, fetchFn)).resolves.toEqual({
			ok: true,
			value: 'advanced',
		});
	});

	test.each([
		['an HTTP error', () => Promise.resolve(jsonResponse({}, false))],
		['a refusal', () => Promise.resolve(jsonResponse({ success: false }))],
		['a network error', () => Promise.reject(new Error('offline'))],
	])('saveSiteMode reports failure on %s', async (_label, fetchFn) => {
		await expect(saveSiteMode('advanced', window.fotogridsAdmin, fetchFn)).resolves.toEqual({
			ok: false,
		});
	});

	test('saveSiteMode does nothing without a url, nonce or fetch', async () => {
		const fetchFn = jest.fn();
		const savedAjaxurl = window.ajaxurl;
		delete window.ajaxurl;

		await expect(saveSiteMode('easy', { nonce: 'n' }, fetchFn)).resolves.toEqual({ ok: false });
		await expect(saveSiteMode('easy', { ajaxUrl: '/a' }, fetchFn)).resolves.toEqual({
			ok: false,
		});
		await expect(saveSiteMode('easy', { ajaxUrl: '/a', nonce: 'n' }, null)).resolves.toEqual({
			ok: false,
		});
		expect(fetchFn).not.toHaveBeenCalled();
		window.ajaxurl = savedAjaxurl;
	});

	test('changeSiteMode skips a pick of the current mode', async () => {
		const setMode = jest.fn();
		const save = jest.fn();

		await expect(
			changeSiteMode({ next: 'easy', current: 'easy', setMode, save, messages: {} })
		).resolves.toBe(true);
		expect(setMode).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	test('changeSiteMode works without an admin object or toast', async () => {
		const setMode = jest.fn();
		const save = () => Promise.resolve({ ok: true });

		await expect(
			changeSiteMode({
				next: 'advanced',
				current: 'easy',
				setMode,
				save,
				admin: null,
				toast: null,
				messages: {},
			})
		).resolves.toBe(true);

		await expect(
			changeSiteMode({
				next: 'advanced',
				current: 'easy',
				setMode,
				save: () => Promise.resolve({ ok: false }),
				admin: null,
				toast: null,
				messages: {},
			})
		).resolves.toBe(false);
	});
});

describe('SetupModePanel', () => {
	test('renders the title, copy and both cards with the site default selected', () => {
		window.fotogridsAdmin.siteSettingsMode = 'advanced';
		const container = mount();

		expect(container.textContent).toContain('Setup Mode');
		expect(container.textContent).toContain('Default mode for new users');
		expect(container.textContent).toContain("Used by everyone who hasn't picked a mode yet.");
		expect(container.textContent).toContain(
			'Only the essential settings. Everything else keeps its default.'
		);
		expect(container.textContent).toContain(
			'Every setting, for full control over look and behaviour.'
		);
		expect(radio(container, 'advanced').checked).toBe(true);
		expect(radio(container, 'easy').checked).toBe(false);

		const group = container.querySelector('[role="radiogroup"]');
		const label = container.querySelector(`#${group.getAttribute('aria-labelledby')}`);
		expect(label.textContent).toBe('Default mode for new users');
	});

	test('picking a mode saves the site option and shows a success toast', async () => {
		const container = mount();

		await click(radio(container, 'advanced'));
		expect(radio(container, 'advanced').checked).toBe(true);
		await flush();

		expect(window.fetch).toHaveBeenCalledTimes(1);
		const body = window.fetch.mock.calls[0][1].body;
		expect(body.get('action')).toBe('fotogrids_update_plugin_setting');
		expect(body.get('setting')).toBe('fotogrids_settings_mode');
		expect(body.get('value')).toBe('advanced');
		expect(body.get('nonce')).toBe('abc123');

		expect(window.fotogridsAdmin.siteSettingsMode).toBe('advanced');
		expect(window.fotogridsAdmin.settingsMode).toBe('advanced');
		expect(window.fotogridsToast.success).toHaveBeenCalledWith('Default mode saved.');
		expect(window.fotogridsToast.error).not.toHaveBeenCalled();
	});

	test('the user mode is left alone when the site default changes', async () => {
		window.fotogridsAdmin.settingsMode = 'easy';
		window.fetch = jest.fn(() =>
			Promise.resolve(jsonResponse({ success: true, data: { value: 'advanced' } }))
		);
		const container = mount();

		await click(radio(container, 'advanced'));
		await flush();

		expect(window.fotogridsAdmin.siteSettingsMode).toBe('advanced');
		expect(window.fotogridsAdmin.settingsMode).toBe('easy');
	});

	test('a failed save rolls the selection back and shows an error toast', async () => {
		window.fetch = jest.fn(() => Promise.resolve(jsonResponse({ success: false })));
		const container = mount();

		await click(radio(container, 'advanced'));
		await flush();

		expect(radio(container, 'easy').checked).toBe(true);
		expect(radio(container, 'advanced').checked).toBe(false);
		expect(window.fotogridsAdmin.siteSettingsMode).toBe('easy');
		expect(window.fotogridsToast.error).toHaveBeenCalledTimes(1);
		expect(window.fotogridsToast.success).not.toHaveBeenCalled();
	});

	test('clicking the selected card sends nothing', async () => {
		const container = mount();

		await click(radio(container, 'easy'));
		await flush();

		expect(window.fetch).not.toHaveBeenCalled();
	});

	test('a second pick while saving is ignored', async () => {
		let resolve;
		window.fetch = jest.fn(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const container = mount();

		await click(radio(container, 'advanced'));
		await click(radio(container, 'easy'));
		expect(window.fetch).toHaveBeenCalledTimes(1);

		await act(async () => {
			resolve(jsonResponse({ success: true, data: { value: 'advanced' } }));
		});
		await flush();
		expect(radio(container, 'advanced').checked).toBe(true);
	});

	test('is read-only without manage_fotogrids_settings', async () => {
		window.fotogridsAdmin.capabilities = { manage_fotogrids_settings: false };
		const container = mount();

		expect(radio(container, 'easy').disabled).toBe(true);
		expect(radio(container, 'advanced').disabled).toBe(true);
		expect(container.textContent).toContain("Your role can't change the default mode.");

		await click(radio(container, 'advanced'));
		await flush();
		expect(window.fetch).not.toHaveBeenCalled();
		expect(radio(container, 'easy').checked).toBe(true);
	});
});
