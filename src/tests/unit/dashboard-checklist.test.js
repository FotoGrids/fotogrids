/**
 * Tests for src/assets/admin/src/components/dashboard/Checklist.jsx
 */
import React from 'react';
import Checklist from '@/admin/src/components/dashboard/Checklist';
import { renderElement } from '@tests/helpers/render-component';

const rows = (container) =>
	Array.from(container.querySelectorAll('.fg-abc-checklist-items li'));

const width = (container) =>
	container.querySelector('.progress-bar-fill').style.width;

describe('dashboard Checklist', () => {
	it('completes only the two static steps on a fresh install', () => {
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 0,
				galleriesPublished: 0,
				settingsConfigured: false,
			})
		);

		expect(
			rows(container).map((li) => li.classList.contains('completed'))
		).toEqual([true, true, false, false, false]);
		expect(width(container)).toBe('40%');

		unmount();
	});

	it('links every incomplete step to an admin screen', () => {
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
			'admin.php?page=fotogrids-settings&tab=defaults',
			'edit.php?post_type=fotogrids_gallery',
		]);

		unmount();
	});

	it('completes the gallery step for a draft gallery', () => {
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 1,
				galleriesPublished: 0,
				settingsConfigured: false,
			})
		);

		const completed = rows(container).map((li) =>
			li.classList.contains('completed')
		);
		expect(completed[2]).toBe(true);
		expect(completed[4]).toBe(false);
		expect(width(container)).toBe('60%');

		unmount();
	});

	it('completes the settings step once settings are configured', () => {
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 0,
				galleriesPublished: 0,
				settingsConfigured: true,
			})
		);

		expect(rows(container)[3].classList.contains('completed')).toBe(true);
		expect(width(container)).toBe('60%');

		unmount();
	});

	it('reaches 100% and drops all links when every step is done', () => {
		const { container, unmount } = renderElement(
			React.createElement(Checklist, {
				galleriesTotal: 2,
				galleriesPublished: 1,
				settingsConfigured: true,
			})
		);

		expect(
			rows(container).every((li) => li.classList.contains('completed'))
		).toBe(true);
		expect(container.querySelectorAll('.fg-abc-checklist-link')).toHaveLength(
			0
		);
		expect(width(container)).toBe('100%');

		unmount();
	});
});
