/**
 * Tests for src/assets/admin/src/components/plugin-settings/tabs/DefaultsTab.jsx:
 * each subtab saves its own type, shows what it saved when opened again, and
 * never drops a change when the user moves away.
 */
import React, { act, createRef } from 'react';
import apiFetch from '@wordpress/api-fetch';
import DefaultsTab, {
	toPanelValue,
	panelPayload,
} from '@/admin/src/components/plugin-settings/tabs/DefaultsTab';
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

const mount = (type) => {
	const ref = createRef();
	const view = renderElement(h(DefaultsTab, { type, ref }));
	return { ref, view };
};

const leave = async (ref) => {
	let result;
	await act(async () => {
		result = await ref.current.confirmLeave();
	});
	return result;
};

// What a subtab saved stays with the page, so later tests see earlier saves.
beforeEach(() => {
	apiFetch.mockReset();
	apiFetch.mockImplementation(({ data }) =>
		Promise.resolve({ type: data.type, defaults: data.defaults })
	);
	window.fotogridsDefaultsSettings = {
		gallery: payload('gallery', 'justified'),
		album: payload('album', 'masonry'),
	};
	window.fotogridsAdmin = { autosave: '1' };
	delete window.FotoGridsAdmin;
});

afterEach(() => {
	document.body.innerHTML = '';
	delete window.fotogridsDefaultsSettings;
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

		expect(await leave(first.ref)).toBe(true);
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

	it('lets the user leave at once when nothing is pending', async () => {
		const { ref, view } = mount('gallery');

		expect(await leave(ref)).toBe(true);
		expect(apiFetch).not.toHaveBeenCalled();
		view.unmount();
	});

	it('keeps the user on the subtab when the save fails', async () => {
		apiFetch.mockImplementation(() => Promise.reject(new Error('500')));
		const { ref, view } = mount('gallery');
		change('layout', 'slider');

		expect(await leave(ref)).toBe(false);
		view.unmount();
	});

	describe('with Autosave off', () => {
		const confirm = jest.fn();

		beforeEach(() => {
			window.fotogridsAdmin = { autosave: '0' };
			window.FotoGridsAdmin = { modal: { confirm } };
			confirm.mockReset();
		});

		it('saves when the user chooses Save changes', async () => {
			confirm.mockImplementation((opts) => {
				opts.onClose('confirm');
				return Promise.resolve(true);
			});
			const { ref, view } = mount('album');
			change('layout', 'justified');

			expect(await leave(ref)).toBe(true);
			expect(confirm.mock.calls[0][0].message).toContain('Album Defaults');
			expect(apiFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { type: 'album', defaults: { layout: 'justified' } },
				})
			);
			view.unmount();
		});

		it('drops the change when the user chooses Discard changes', async () => {
			confirm.mockImplementation((opts) => {
				opts.onClose('cancel');
				return Promise.resolve(false);
			});
			const { ref, view } = mount('gallery');
			change('layout', 'slider');

			expect(await leave(ref)).toBe(true);
			expect(apiFetch).not.toHaveBeenCalled();
			expect(await leave(ref)).toBe(true);
			expect(confirm).toHaveBeenCalledTimes(1);
			view.unmount();
		});

		it('stays when the dialog is closed any other way', async () => {
			confirm.mockImplementation((opts) => {
				opts.onClose('esc');
				return Promise.resolve(false);
			});
			const { ref, view } = mount('gallery');
			change('layout', 'slider');

			expect(await leave(ref)).toBe(false);
			expect(apiFetch).not.toHaveBeenCalled();
			view.unmount();
		});

		it('falls back to the browser dialog without the modal API', async () => {
			delete window.FotoGridsAdmin;
			const native = jest.spyOn(window, 'confirm').mockReturnValue(false);
			const { ref, view } = mount('gallery');
			change('layout', 'slider');

			expect(await leave(ref)).toBe(false);
			expect(native).toHaveBeenCalled();
			native.mockRestore();
			view.unmount();
		});
	});
});
