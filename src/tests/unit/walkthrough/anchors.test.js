/**
 * The anchors and replay buttons the walkthrough relies on in existing
 * admin components.
 */
import React from 'react';
import LearnSection from '@/admin/src/components/dashboard/LearnSection';
import MainCTA from '@/admin/src/components/dashboard/MainCTA';
import CreateOptions from '@/admin/src/components/dashboard/CreateOptions';
import Checklist from '@/admin/src/components/dashboard/Checklist';
import MetaboxHeader from '@/admin/src/components/gallery-metabox/components/MetaboxHeader';
import AlbumGalleries from '@/admin/src/components/AlbumGalleries';
import { renderElement, click, act } from '@tests/helpers/render-component';

const h = React.createElement;
const strings = new Proxy({}, { get: (_t, p) => String(p) });

const anchor = (container, id) =>
	container.querySelector(`[data-fg-walkthrough="${id}"]`);

describe('Dashboard anchors', () => {
	it('marks the start card in both of its states', () => {
		[0, 3].forEach((galleriesCount) => {
			const view = renderElement(
				h(MainCTA, { galleriesCount, itemsCount: 0 })
			);
			expect(anchor(view.container, 'dashboard-start')).not.toBeNull();
			view.unmount();
		});
	});

	it('marks the Create and setup cards', () => {
		const create = renderElement(h(CreateOptions));
		expect(anchor(create.container, 'dashboard-create')).not.toBeNull();
		create.unmount();

		const setup = renderElement(
			h(Checklist, {
				galleriesTotal: 0,
				galleriesPublished: 0,
				settingsConfigured: false,
			})
		);
		expect(anchor(setup.container, 'dashboard-setup')).not.toBeNull();
		setup.unmount();
	});

	it('Take the tour in the Learn card starts the tour', () => {
		const listener = jest.fn();
		document.addEventListener('fotogrids:walkthrough:start', listener);
		const view = renderElement(h(LearnSection));

		expect(anchor(view.container, 'dashboard-learn')).not.toBeNull();
		const button = view.container.querySelector(
			'button.fg-abc-learn-option'
		);
		expect(button.textContent).toContain('Take the tour');
		click(button);

		document.removeEventListener('fotogrids:walkthrough:start', listener);
		view.unmount();
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe('Gallery Items anchors', () => {
	it('marks the Manage and Preview tabs and the Add New menu', () => {
		const view = renderElement(
			h(MetaboxHeader, {
				activeTab: 'manage',
				strings,
				onTabSwitch: jest.fn(),
				addDropdownOpen: false,
				onAddDropdownToggle: jest.fn(),
				onAddOption: jest.fn(),
				onClearAll: jest.fn(),
			})
		);

		expect(anchor(view.container, 'gallery-tab-manage').tagName).toBe(
			'BUTTON'
		);
		expect(anchor(view.container, 'gallery-tab-preview').tagName).toBe(
			'BUTTON'
		);
		expect(anchor(view.container, 'gallery-add-items')).not.toBeNull();
		view.unmount();
	});
});

describe('Album anchors', () => {
	afterEach(() => {
		delete window.fotogridsAlbumGalleries;
	});

	it('marks the available galleries section', async () => {
		window.fotogridsAlbumGalleries = {
			postId: 7,
			restUrl: '/r/',
			nonce: 'n',
			assignedGalleries: [],
			allGalleries: [],
			featuredGalleryId: null,
			strings,
		};
		const view = renderElement(h(AlbumGalleries));
		await act(async () => {
			await Promise.resolve();
		});

		expect(
			anchor(view.container, 'album-available-galleries')
		).not.toBeNull();
		view.unmount();
	});
});
