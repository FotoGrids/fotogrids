/**
 * Tests for src/assets/admin/src/components/plugin-settings/tabs/DefaultsTab.jsx:
 * each subtab saves its own type and shows what it saved when opened again.
 */
import React, { act } from 'react';
import apiFetch from '@wordpress/api-fetch';
import DefaultsTab, {
	toPanelValue,
	panelPayload,
} from '@/admin/src/components/plugin-settings/tabs/DefaultsTab';
import { confirmLeave } from '@/admin/src/components/shared/SidebarTabs/elements/unsaved-changes';
import { renderElement } from '@tests/helpers/render-component';

jest.mock('@wordpress/api-fetch');

const h = React.createElement;

const payload = (type, layout) => ({
	postType: `fotogrids_${type}`,
	isDefaultsMode: true,
	settings: { layout, columns: { desktop: 3 }, lightbox: true },
	defaults: { layout: 'grid', columns: { desktop: 3 }, lightbox: true },
});

const change = (key, value) =>
	act(() => {
		document.dispatchEvent(
			new window.CustomEvent('fotogrids:setting_changed', {
				detail: { key, value, scope: 'defaults' },
			})
		);
	});

const mount = (type) => ({ view: renderElement(h(DefaultsTab, { type })) });

const leave = async () => {
	let result;
	await act(async () => {
		result = await confirmLeave('Defaults');
	});
	return result;
};

// Saves persist across the tests in this file.
beforeEach(() => {
	apiFetch.mockReset();
	apiFetch.mockImplementation(({ data }) =>
		Promise.resolve({ type: data.type, defaults: data.defaults })
	);
	window.fotogridsDefaultsByKind = {
		gallery: payload('gallery', 'justified'),
		album: payload('album', 'masonry'),
	};
	window.fotogridsSettings = {
		isDefaultsMode: true,
		...payload('gallery', 'justified'),
	};
	window.fotogridsAdmin = { autosave: '1' };
	delete window.FotoGridsAdmin;
});

afterEach(() => {
	document.body.innerHTML = '';
	delete window.fotogridsDefaultsByKind;
	delete window.fotogridsSettings;
});

describe('toPanelValue', () => {
	it('decodes JSON text the way the page loader does', () => {
		expect(toPanelValue('["exif","caption"]', [])).toEqual(['exif', 'caption']);
		expect(toPanelValue('5', 3)).toBe(5);
		expect(toPanelValue('masonry', 'grid')).toBe('masonry');
		expect(toPanelValue('null', 'grid')).toBe('null');
	});

	it('leaves booleans and non-strings as stored', () => {
		expect(toPanelValue('1', true)).toBe('1');
		expect(toPanelValue({ desktop: 4 }, {})).toEqual({ desktop: 4 });
	});
});

describe('panelPayload', () => {
	it('layers saved values over the localized settings', () => {
		const result = panelPayload(payload('album', 'grid'), {
			layout: 'masonry',
			columns: '{"desktop":5}',
			not_a_setting: 'x',
		});

		expect(result.settings.layout).toBe('masonry');
		expect(result.settings.columns).toEqual({ desktop: 5 });
		expect(result.settings).not.toHaveProperty('not_a_setting');
		expect(result.postType).toBe('fotogrids_album');
	});
});

describe('DefaultsTab', () => {
	it('mounts the panel with its own type’s payload', () => {
		const { view } = mount('album');

		expect(window.fotogridsSettings.postType).toBe('fotogrids_album');
		expect(window.fotogridsSettings.settings.layout).toBe('masonry');
		view.unmount();
	});

	it('saves with its type and shows the saved value when opened again', async () => {
		const first = mount('gallery');
		change('layout', 'slider');

		expect(await leave()).toBe(true);
		expect(apiFetch).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/fotogrids/v1/admin/collection-defaults',
				method: 'POST',
				data: { type: 'gallery', defaults: { layout: 'slider' } },
			})
		);
		first.view.unmount();

		const album = mount('album');
		expect(window.fotogridsSettings.settings.layout).toBe('masonry');
		album.view.unmount();

		const again = mount('gallery');
		expect(window.fotogridsSettings.settings.layout).toBe('slider');
		again.view.unmount();
	});
});
