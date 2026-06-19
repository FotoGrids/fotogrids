/**
 * Tests for src/assets/admin/src/components/AlbumAssignment.js
 */
import AlbumAssignment from '@/admin/src/components/AlbumAssignment';
import { renderElement, click, changeValue, act } from '@tests/helpers/render-component';

const CONFIG = {
	postId: 5,
	restUrl: 'https://x/wp-json/fotogrids/v1/',
	nonce: 'n',
	assignedAlbums: [{ ID: 1, title: 'Trips' }],
	allAlbums: [
		{ id: 1, title: 'Trips', gallery_count: 2 },
		{ id: 2, title: 'Food', gallery_count: 0 },
		{ id: 3, title: 'Pets', gallery_count: 1 },
	],
	strings: {
		albums: 'Albums',
		assignedTo: 'Assigned to',
		notAssignedTo: 'Not assigned to any album',
		searchPlaceholder: 'Search albums',
		noAvailableAlbumsFound: 'No albums available',
		noMoreAlbumsFound: 'No more albums',
		createNewAlbum: 'Create new album',
		saved: 'Saved',
	},
};

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe('AlbumAssignment', () => {
	beforeEach(() => {
		window.fotogridsAlbumAssignment = { ...CONFIG };
		global.wp.apiFetch.mockReset();
	});

	afterEach(() => {
		delete window.fotogridsAlbumAssignment;
	});

	it('shows assigned albums and available (unassigned) albums', async () => {
		const handle = renderElement(wp.element.createElement(AlbumAssignment));
		await flush();
		expect(
			handle.container.querySelector('.fotogrids-assigned-album')
		).not.toBeNull();
		// available list excludes already-assigned 'Trips'
		const available = handle.container.querySelectorAll(
			'.fotogrids-album-item.available'
		);
		expect(available.length).toBe(2);
	});

	it('filters available albums by the search term', async () => {
		const handle = renderElement(wp.element.createElement(AlbumAssignment));
		await flush();
		changeValue(
			handle.container.querySelector('.fotogrids-search-input'),
			'food'
		);
		const available = handle.container.querySelectorAll(
			'.fotogrids-album-item.available'
		);
		expect(available.length).toBe(1);
		expect(available[0].textContent).toContain('Food');
	});

	it('assigns an album via apiFetch when an available album is clicked', async () => {
		global.wp.apiFetch.mockResolvedValue({});
		const handle = renderElement(wp.element.createElement(AlbumAssignment));
		await flush();
		const foodCard = [
			...handle.container.querySelectorAll('.fotogrids-album-item.available'),
		].find((c) => c.textContent.includes('Food'));
		await act(async () => {
			click(foodCard.querySelector('button') || foodCard);
			// settle the async handleAlbumToggle (apiFetch + follow-up setStates)
			for (let i = 0; i < 10; i++) await Promise.resolve();
		});
		expect(global.wp.apiFetch).toHaveBeenCalled();
	});

	it('unassigns an album via DELETE when the assigned album is toggled', async () => {
		global.wp.apiFetch.mockResolvedValue({});
		const handle = renderElement(wp.element.createElement(AlbumAssignment));
		await flush();
		const removeBtn = handle.container
			.querySelector('.fotogrids-assigned-album')
			.querySelector('button');
		await act(async () => {
			click(removeBtn);
			for (let i = 0; i < 10; i++) await Promise.resolve();
		});
		expect(global.wp.apiFetch).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'DELETE' })
		);
	});
});
