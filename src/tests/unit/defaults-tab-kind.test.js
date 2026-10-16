/**
 * Tests for the per-kind settings payload applied by
 * src/assets/admin/src/components/plugin-settings/tabs/DefaultsTab.jsx
 */
import React from 'react';
import DefaultsTab from '@/admin/src/components/plugin-settings/tabs/DefaultsTab';
import { renderElement } from '@tests/helpers/render-component';

jest.mock('@wordpress/api-fetch');

const byKind = {
	gallery: {
		postType: 'fotogrids_gallery',
		collectionKind: 'gallery',
		documentationUrl: 'https://example.test/docs/galleries',
		defaults: { single_item_auto_progress: false },
		settings: { single_item_auto_progress: false },
	},
	album: {
		postType: 'fotogrids_album',
		collectionKind: 'album',
		documentationUrl: 'https://example.test/docs/albums',
		defaults: {},
		settings: {},
	},
};

describe('DefaultsTab per-kind settings', () => {
	let seenAtMount;
	let view;

	beforeEach(() => {
		seenAtMount = null;
		window.fotogridsSettings = {
			isDefaultsMode: true,
			...byKind.gallery,
		};
		window.fotogridsDefaultsByKind = byKind;
		window.FotoGridsCollectionSettings = {
			CollectionSettings: () => {
				seenAtMount = { ...window.fotogridsSettings };
				return null;
			},
		};
	});

	afterEach(() => {
		view?.unmount();
		delete window.fotogridsSettings;
		delete window.fotogridsDefaultsByKind;
		delete window.FotoGridsCollectionSettings;
	});

	it('mounts the album subtab with the album payload', () => {
		view = renderElement(<DefaultsTab type="album" />);

		expect(seenAtMount).toMatchObject(byKind.album);
		expect(seenAtMount.isDefaultsMode).toBe(true);
	});

	it('mounts the gallery subtab with the gallery payload', () => {
		window.fotogridsSettings = { isDefaultsMode: true, ...byKind.album };

		view = renderElement(<DefaultsTab type="gallery" />);

		expect(seenAtMount).toMatchObject(byKind.gallery);
	});

	it('falls back to the post type and kind without a per-kind payload', () => {
		delete window.fotogridsDefaultsByKind;

		view = renderElement(<DefaultsTab type="album" />);

		expect(seenAtMount.postType).toBe('fotogrids_album');
		expect(seenAtMount.collectionKind).toBe('album');
	});
});
