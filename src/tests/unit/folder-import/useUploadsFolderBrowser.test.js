/**
 * Tests for useUploadsFolderBrowser.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import useUploadsFolderBrowser, {
	EMPTY_LISTING,
} from '@/admin/src/components/folder-import/useUploadsFolderBrowser';

const listing = (overrides = {}) => ({
	path: '',
	parent: null,
	breadcrumbs: [{ label: 'Uploads', path: '' }],
	folders: [{ name: '2024', count: 3 }],
	files: [{ name: 'a.jpg', path: 'a.jpg' }],
	total: 2,
	page: 1,
	...overrides,
});

const renderBrowser = (props = {}) =>
	renderHook((hookProps) => useUploadsFolderBrowser(hookProps), {
		initialProps: {
			galleryId: 7,
			isOpen: true,
			loadFailedMessage: 'Could not load folder',
			...props,
		},
	});

describe('useUploadsFolderBrowser', () => {
	beforeEach(() => {
		wp.apiFetch.mockReset();
	});

	it('does not fetch while closed', () => {
		const { result } = renderBrowser({ isOpen: false });

		expect(wp.apiFetch).not.toHaveBeenCalled();
		expect(result.current.listing).toEqual(EMPTY_LISTING);
		expect(result.current.path).toBe('');
	});

	it('loads the uploads root when opened', async () => {
		wp.apiFetch.mockResolvedValueOnce(listing());

		const { result } = renderBrowser();

		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(wp.apiFetch).toHaveBeenCalledWith({
			path: '/fotogrids/v1/media/folders?gallery_id=7&path=&page=1',
		});
		expect(result.current.listing).toEqual(listing());
		expect(result.current.path).toBe('');
		expect(result.current.error).toBeNull();
	});

	it('encodes the folder path and takes the path from the response', async () => {
		wp.apiFetch
			.mockResolvedValueOnce(listing())
			.mockResolvedValueOnce(listing({ path: '2024/05', page: 1 }));

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.loadFolder('2024/05'));

		expect(wp.apiFetch).toHaveBeenLastCalledWith({
			path: '/fotogrids/v1/media/folders?gallery_id=7&path=2024%2F05&page=1',
		});
		expect(result.current.path).toBe('2024/05');
	});

	it('appends the next page onto the current listing', async () => {
		wp.apiFetch
			.mockResolvedValueOnce(listing({ path: 'shoots' }))
			.mockResolvedValueOnce(
				listing({
					path: 'shoots',
					page: 2,
					folders: [],
					files: [{ name: 'b.jpg', path: 'shoots/b.jpg' }],
				})
			);

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.loadMore());

		expect(wp.apiFetch).toHaveBeenLastCalledWith({
			path: '/fotogrids/v1/media/folders?gallery_id=7&path=shoots&page=2',
		});
		expect(result.current.listing.page).toBe(2);
		expect(result.current.listing.files.map((f) => f.name)).toEqual([
			'a.jpg',
			'b.jpg',
		]);
		expect(result.current.loadingMore).toBe(false);
	});

	it('falls back to loadFailedMessage when a load rejects without a message', async () => {
		wp.apiFetch.mockRejectedValueOnce({});

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.error).toBe('Could not load folder');
		expect(result.current.listing).toEqual(EMPTY_LISTING);
	});

	it('surfaces the request message and moves the path to the failed folder', async () => {
		wp.apiFetch
			.mockResolvedValueOnce(listing())
			.mockRejectedValueOnce(new Error('Folder is outside uploads'));

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.loadFolder('../etc'));

		expect(result.current.error).toBe('Folder is outside uploads');
		expect(result.current.listing).toEqual(EMPTY_LISTING);
		expect(result.current.path).toBe('../etc');
	});

	it('keeps the listing when loading more fails', async () => {
		wp.apiFetch.mockResolvedValueOnce(listing()).mockRejectedValueOnce({});

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(() => result.current.loadMore());

		expect(result.current.error).toBe('Could not load folder');
		expect(result.current.listing).toEqual(listing());
		expect(result.current.loadingMore).toBe(false);
	});

	it('clears the error on request', async () => {
		wp.apiFetch.mockRejectedValueOnce(new Error('Nope'));

		const { result } = renderBrowser();
		await waitFor(() => expect(result.current.error).toBe('Nope'));

		act(() => result.current.clearError());

		expect(result.current.error).toBeNull();
	});

	it('resets listing, path and error when closed', async () => {
		wp.apiFetch
			.mockResolvedValueOnce(listing())
			.mockRejectedValueOnce(new Error('Nope'));

		const { result, rerender } = renderBrowser();
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(() => result.current.loadFolder('2024'));
		expect(result.current.error).toBe('Nope');

		rerender({ galleryId: 7, isOpen: false });

		expect(result.current.listing).toEqual(EMPTY_LISTING);
		expect(result.current.path).toBe('');
		expect(result.current.error).toBeNull();
	});
});
