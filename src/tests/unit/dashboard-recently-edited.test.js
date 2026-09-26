/**
 * Tests for src/assets/admin/src/components/dashboard/RecentlyEdited.jsx
 */
import React from 'react';
import RecentlyEdited, {
	formatEditedDate,
} from '@/admin/src/components/dashboard/RecentlyEdited';
import { renderElement, act } from '@tests/helpers/render-component';

const ROWS = [
	{
		id: 12,
		title: 'Summer Portraits',
		placeholder: 'Gallery #12',
		type: 'fotogrids_gallery',
		type_label: 'Gallery',
		status: 'publish',
		modified_timestamp: Date.UTC(2026, 8, 24, 10) / 1000,
		modified_formatted: 'September 24, 2026 10:00 am',
		edit_url: 'https://example.test/wp-admin/post.php?post=12&action=edit',
	},
	{
		id: 15,
		title: '',
		placeholder: 'Album #15',
		type: 'fotogrids_album',
		type_label: 'Album',
		status: 'draft',
		modified_timestamp: Date.UTC(2026, 8, 23, 9) / 1000,
		modified_formatted: 'September 23, 2026 9:00 am',
		edit_url: 'https://example.test/wp-admin/post.php?post=15&action=edit',
	},
];

const flush = () =>
	act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});

describe('dashboard RecentlyEdited', () => {
	afterEach(() => {
		wp.apiFetch.mockReset();
	});

	it('requests five rows including private posts', async () => {
		wp.apiFetch.mockResolvedValue({ items: [] });

		const { unmount } = renderElement(React.createElement(RecentlyEdited));
		await flush();

		expect(wp.apiFetch).toHaveBeenCalledWith(
			expect.objectContaining({
				path: '/fotogrids/v1/admin/recently-edited?limit=5&include_private=1',
			})
		);

		unmount();
	});

	it('lists each row with its edit link, falling back to the placeholder', async () => {
		wp.apiFetch.mockResolvedValue({ items: ROWS });

		const { container, unmount } = renderElement(
			React.createElement(RecentlyEdited)
		);
		await flush();

		const links = Array.from(
			container.querySelectorAll('.fg-abc-recently-edited-link')
		);
		expect(links.map((a) => a.getAttribute('href'))).toEqual(
			ROWS.map((row) => row.edit_url)
		);
		expect(
			Array.from(
				container.querySelectorAll('.fg-abc-recently-edited-title')
			).map((el) => el.textContent)
		).toEqual(['Summer Portraits', 'Album #15']);

		unmount();
	});

	it('marks only unpublished rows with a status label', async () => {
		wp.apiFetch.mockResolvedValue({ items: ROWS });

		const { container, unmount } = renderElement(
			React.createElement(RecentlyEdited)
		);
		await flush();

		const statuses = container.querySelectorAll(
			'.fg-abc-recently-edited-status'
		);
		expect(statuses).toHaveLength(1);
		expect(statuses[0].textContent).toBe('Draft');

		unmount();
	});

	it('shows the empty message when the request fails', async () => {
		jest.spyOn(console, 'error').mockImplementation(() => {});
		wp.apiFetch.mockRejectedValue(new Error('offline'));

		const { container, unmount } = renderElement(
			React.createElement(RecentlyEdited)
		);
		await flush();

		expect(
			container.querySelector('.fg-abc-recently-edited-empty')
		).not.toBeNull();
		expect(
			container.querySelector('.fg-abc-recently-edited-items')
		).toBeNull();

		console.error.mockRestore();
		unmount();
	});

	it('links to the gallery list, and to the album list only when albums exist', async () => {
		wp.apiFetch.mockResolvedValue({ items: ROWS });

		const hrefs = (container) =>
			Array.from(
				container.querySelectorAll('.fg-abc-recently-edited-actions .fg-button')
			).map((a) => a.getAttribute('href'));

		const withoutAlbums = renderElement(React.createElement(RecentlyEdited));
		await flush();
		expect(hrefs(withoutAlbums.container)).toEqual([
			'edit.php?post_type=fotogrids_gallery',
		]);
		withoutAlbums.unmount();

		const withAlbums = renderElement(
			React.createElement(RecentlyEdited, { hasAlbums: true })
		);
		await flush();
		expect(hrefs(withAlbums.container)).toEqual([
			'edit.php?post_type=fotogrids_gallery',
			'edit.php?post_type=fotogrids_album',
		]);
		withAlbums.unmount();
	});
});

describe('formatEditedDate', () => {
	const NOW = new Date('2026-09-26T12:00:00Z');
	const at = (iso) => Date.parse(iso) / 1000;

	it('shows minutes for an edit within the last hour', () => {
		expect(formatEditedDate(at('2026-09-26T11:55:00Z'), NOW)).toBe(
			'5 minutes ago'
		);
	});

	it('never shows less than one minute', () => {
		expect(formatEditedDate(at('2026-09-26T11:59:45Z'), NOW)).toBe(
			'1 minute ago'
		);
	});

	it('shows hours for an edit within the last day', () => {
		expect(formatEditedDate(at('2026-09-26T09:10:00Z'), NOW)).toBe(
			'2 hours ago'
		);
		expect(formatEditedDate(at('2026-09-25T12:30:00Z'), NOW)).toBe(
			'23 hours ago'
		);
	});

	it('shows day and month once the edit is a day old', () => {
		const label = formatEditedDate(at('2026-09-24T10:00:00Z'), NOW);
		expect(label).toMatch(/24/);
		expect(label).not.toMatch(/ago|2026/);
	});

	it('adds the year for an earlier year', () => {
		expect(formatEditedDate(at('2025-06-15T10:00:00Z'), NOW)).toMatch(
			/2025/
		);
	});

	it('returns an empty string when the timestamp is missing', () => {
		expect(formatEditedDate(0, NOW)).toBe('');
		expect(formatEditedDate(undefined, NOW)).toBe('');
	});
});
