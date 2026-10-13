/**
 * Tests for the capability gating on the FotoGrids Dashboard.
 */
import React from 'react';
import { userCan } from '@/admin/src/utils/capabilities';
import CreateOptions from '@/admin/src/components/dashboard/CreateOptions';
import Checklist from '@/admin/src/components/dashboard/Checklist';
import MainCTA from '@/admin/src/components/dashboard/MainCTA';
import OverviewStats from '@/admin/src/components/dashboard/OverviewStats';
import { renderElement } from '@tests/helpers/render-component';

const EDITOR = {
	manage_fotogrids: false,
	manage_fotogrids_settings: false,
	edit_fotogrids_galleries: true,
	edit_fotogrids_albums: true,
	view_fotogrids_stats: true,
};

const ALBUMS_ONLY = {
	...EDITOR,
	edit_fotogrids_galleries: false,
	view_fotogrids_stats: false,
};

const grant = (capabilities) => {
	window.fotogridsAdmin = { capabilities };
};

const reasons = (container) =>
	Array.from(container.querySelectorAll('.fg-abc-locked-reason')).map(
		(node) => node.textContent.replace(/^lock/, '')
	);

afterEach(() => {
	delete window.fotogridsAdmin;
});

describe('userCan', () => {
	it('reads a missing snapshot as allowed', () => {
		expect(userCan('manage_fotogrids')).toBe(true);
	});

	it('allows only a capability the snapshot grants', () => {
		grant(EDITOR);

		expect(userCan('edit_fotogrids_galleries')).toBe(true);
		expect(userCan('manage_fotogrids')).toBe(false);
		expect(userCan('not_in_the_snapshot')).toBe(false);
	});
});

describe('Dashboard Create card', () => {
	it('links every option for a user holding every capability', () => {
		grant({
			...EDITOR,
			manage_fotogrids: true,
			manage_fotogrids_settings: true,
		});
		const { container, unmount } = renderElement(
			React.createElement(CreateOptions)
		);

		expect(container.querySelectorAll('a.create-option')).toHaveLength(4);
		expect(reasons(container)).toEqual([]);

		unmount();
	});

	it('keeps Templates and Settings visible but disabled for an editor', () => {
		grant(EDITOR);
		const { container, unmount } = renderElement(
			React.createElement(CreateOptions)
		);

		expect(
			Array.from(container.querySelectorAll('a.create-option')).map((a) =>
				a.getAttribute('href')
			)
		).toEqual([
			'post-new.php?post_type=fotogrids_gallery',
			'post-new.php?post_type=fotogrids_album',
		]);
		expect(
			container.querySelectorAll('.create-option.is-disabled')
		).toHaveLength(2);
		expect(reasons(container)).toEqual([
			"Your role can't use templates.",
			"Your role can't change settings.",
		]);

		unmount();
	});
});

describe('Dashboard setup checklist', () => {
	it('disables the settings step for a user who cannot change settings', () => {
		grant(EDITOR);
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 0,
				galleriesPublished: 0,
				settingsConfigured: false,
			})
		);

		expect(
			Array.from(
				container.querySelectorAll('.fg-abc-checklist-link')
			).map((a) => a.getAttribute('href'))
		).toEqual([
			'post-new.php?post_type=fotogrids_gallery',
			'edit.php?post_type=fotogrids_gallery',
		]);
		expect(reasons(container)).toEqual([
			"Your role can't change settings.",
		]);

		unmount();
	});

	it('leaves a completed step ticked whatever the user holds', () => {
		grant(ALBUMS_ONLY);
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 1,
				galleriesPublished: 1,
				settingsConfigured: true,
			})
		);

		expect(container.querySelectorAll('li.completed')).toHaveLength(5);
		expect(reasons(container)).toEqual([]);

		unmount();
	});
});

describe('Dashboard main call to action', () => {
	it('disables gallery creation for a user who cannot create galleries', () => {
		grant(ALBUMS_ONLY);
		const { container, unmount } = renderElement(
			React.createElement(MainCTA, { galleriesCount: 0, itemsCount: 0 })
		);

		expect(container.querySelector('a')).toBeNull();
		expect(
			container.querySelector('.fg-abc-main-cta-disabled').textContent
		).toBe('Get Started');
		expect(reasons(container)).toEqual([
			"Your role can't create or edit galleries.",
		]);

		unmount();
	});
});

describe('Dashboard overview', () => {
	const stats = { galleries: 3, albums: 1, items: 12, views: 40, shares: 2 };

	it('links the cards to Statistics for a user who can open it', () => {
		grant(EDITOR);
		const { container, unmount } = renderElement(
			React.createElement(OverviewStats, { stats, loading: false })
		);

		expect(
			container.querySelectorAll(
				'a[href="admin.php?page=fotogrids-stats"]'
			)
		).toHaveLength(5);
		expect(reasons(container)).toEqual([]);

		unmount();
	});

	it('shows the figures without links for a user who cannot open Statistics', () => {
		grant(ALBUMS_ONLY);
		const { container, unmount } = renderElement(
			React.createElement(OverviewStats, { stats, loading: false })
		);

		expect(container.querySelectorAll('a')).toHaveLength(0);
		expect(container.textContent).toContain('40');
		expect(reasons(container)).toEqual([
			"Your role can't open Statistics.",
		]);

		unmount();
	});
});
