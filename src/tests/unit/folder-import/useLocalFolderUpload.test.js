/**
 * Tests for useLocalFolderUpload.
 */

import { renderHook, act } from '@testing-library/react';
import { uploadMedia } from '@wordpress/media-utils';
import useLocalFolderUpload from '@/admin/src/components/folder-import/useLocalFolderUpload';

jest.mock('@wordpress/media-utils', () => ({ uploadMedia: jest.fn() }));

const file = (name, type = '', webkitRelativePath = '') => ({
	name,
	type,
	webkitRelativePath,
});

const renderUpload = (props = {}) =>
	renderHook((hookProps) => useLocalFolderUpload(hookProps), {
		initialProps: {
			isOpen: true,
			onUploadComplete: jest.fn(),
			onFinished: jest.fn(),
			noImagesMessage: 'No images in that folder',
			failedMessage: 'Upload failed',
			...props,
		},
	});

/**
 * Capture the callbacks uploadMedia receives so each file can be settled by hand.
 *
 * @returns {{ calls: Array }}
 */
const captureUploads = () => {
	const captured = { calls: [] };
	uploadMedia.mockImplementation((args) => {
		captured.calls.push(args);
		return Promise.resolve();
	});
	return captured;
};

describe('useLocalFolderUpload', () => {
	describe('pickFiles', () => {
		it('keeps images by MIME type or by extension and drops the rest', () => {
			const { result } = renderUpload();

			act(() =>
				result.current.pickFiles([
					file('one.jpg', 'image/jpeg', 'Trip/one.jpg'),
					file('two.HEIC', '', 'Trip/two.HEIC'),
					file('notes.txt', 'text/plain', 'Trip/notes.txt'),
					file('clip.mov', 'video/quicktime', 'Trip/clip.mov'),
					file('', '', 'Trip/'),
				])
			);

			expect(result.current.files.map((f) => f.name)).toEqual([
				'one.jpg',
				'two.HEIC',
			]);
			expect(result.current.folderName).toBe('Trip');
			expect(result.current.error).toBeNull();
		});

		it('reports noImagesMessage when the folder holds no images', () => {
			const { result } = renderUpload();

			act(() =>
				result.current.pickFiles([
					file('notes.txt', 'text/plain', 'Docs/notes.txt'),
				])
			);

			expect(result.current.files).toEqual([]);
			expect(result.current.folderName).toBe('Docs');
			expect(result.current.error).toBe('No images in that folder');
		});

		it('treats an empty or missing pick as no selection', () => {
			const { result } = renderUpload();

			act(() => result.current.pickFiles(null));

			expect(result.current.files).toEqual([]);
			expect(result.current.folderName).toBe('');
			expect(result.current.error).toBeNull();
		});

		it('leaves the folder name empty when the files carry no relative path', () => {
			const { result } = renderUpload();

			act(() => result.current.pickFiles([file('a.png', 'image/png')]));

			expect(result.current.folderName).toBe('');
			expect(result.current.files).toHaveLength(1);
		});
	});

	describe('startUpload', () => {
		it('does nothing without picked images', () => {
			const { result } = renderUpload();

			act(() => result.current.startUpload());

			expect(uploadMedia).not.toHaveBeenCalled();
			expect(result.current.uploading).toBe(false);
		});

		it('tracks the batch and reports the uploaded IDs once every file settles', () => {
			const captured = captureUploads();
			const onUploadComplete = jest.fn();
			const onFinished = jest.fn();
			const { result } = renderUpload({ onUploadComplete, onFinished });

			act(() =>
				result.current.pickFiles([
					file('a.jpg', 'image/jpeg', 'F/a.jpg'),
					file('b.jpg', 'image/jpeg', 'F/b.jpg'),
				])
			);
			act(() => result.current.startUpload());

			const args = captured.calls[0];
			expect(args.filesList).toHaveLength(2);
			expect(args.allowedTypes).toEqual(['image']);
			expect(result.current.uploading).toBe(true);
			expect(result.current.counts).toEqual({ done: 0, total: 2 });
			expect(result.current.percent).toBe(0);

			act(() => args.onFileChange([{ id: 11 }]));

			expect(result.current.counts).toEqual({ done: 1, total: 2 });
			expect(result.current.percent).toBe(50);
			expect(onUploadComplete).not.toHaveBeenCalled();

			act(() => args.onFileChange([{ id: 11 }, { id: 12 }]));

			expect(result.current.uploading).toBe(false);
			expect(result.current.counts).toEqual({ done: 0, total: 0 });
			expect(result.current.percent).toBe(0);
			expect(onUploadComplete).toHaveBeenCalledWith([11, 12]);
			expect(onFinished).toHaveBeenCalledTimes(1);
		});

		it('ignores placeholder attachments that have no ID yet', () => {
			const captured = captureUploads();
			const { result } = renderUpload();

			act(() => result.current.pickFiles([file('a.jpg', 'image/jpeg')]));
			act(() => result.current.startUpload());

			act(() => captured.calls[0].onFileChange([{ url: 'blob:x' }]));
			act(() => captured.calls[0].onFileChange(null));

			expect(result.current.uploading).toBe(true);
			expect(result.current.counts).toEqual({ done: 0, total: 1 });
		});

		it('counts per-file errors toward the batch and reports only what uploaded', () => {
			const captured = captureUploads();
			const onUploadComplete = jest.fn();
			const onFinished = jest.fn();
			const { result } = renderUpload({ onUploadComplete, onFinished });

			act(() =>
				result.current.pickFiles([
					file('a.jpg', 'image/jpeg'),
					file('b.jpg', 'image/jpeg'),
				])
			);
			act(() => result.current.startUpload());

			const args = captured.calls[0];
			act(() => args.onError(new Error('b.jpg is too large')));
			act(() => args.onFileChange([{ id: 21 }]));

			expect(result.current.error).toBe('b.jpg is too large');
			expect(result.current.uploading).toBe(false);
			expect(onUploadComplete).toHaveBeenCalledWith([21]);
			expect(onFinished).toHaveBeenCalledTimes(1);
		});

		it('skips onUploadComplete when every file fails', () => {
			const captured = captureUploads();
			const onUploadComplete = jest.fn();
			const onFinished = jest.fn();
			const { result } = renderUpload({ onUploadComplete, onFinished });

			act(() => result.current.pickFiles([file('a.jpg', 'image/jpeg')]));
			act(() => result.current.startUpload());
			act(() => captured.calls[0].onError(new Error('Server error')));

			expect(onUploadComplete).not.toHaveBeenCalled();
			expect(onFinished).toHaveBeenCalledTimes(1);
			expect(result.current.error).toBe('Server error');
		});

		it('releases the busy state when uploadMedia rejects up front', async () => {
			uploadMedia.mockRejectedValueOnce(
				new Error('Sorry, this file type is not permitted.')
			);
			const { result } = renderUpload();

			act(() => result.current.pickFiles([file('a.jpg', 'image/jpeg')]));
			await act(async () => result.current.startUpload());

			expect(result.current.error).toBe(
				'Sorry, this file type is not permitted.'
			);
			expect(result.current.uploading).toBe(false);
			expect(result.current.counts).toEqual({ done: 0, total: 0 });
		});

		it('falls back to failedMessage when the rejection carries no message', async () => {
			uploadMedia.mockRejectedValueOnce(undefined);
			const { result } = renderUpload();

			act(() => result.current.pickFiles([file('a.jpg', 'image/jpeg')]));
			await act(async () => result.current.startUpload());

			expect(result.current.error).toBe('Upload failed');
			expect(result.current.uploading).toBe(false);
		});
	});

	it('clears files, folder name, counts and error when closed', () => {
		const captured = captureUploads();
		const { result, rerender } = renderUpload();

		act(() =>
			result.current.pickFiles([
				file('a.jpg', 'image/jpeg', 'Trip/a.jpg'),
				file('b.jpg', 'image/jpeg', 'Trip/b.jpg'),
			])
		);
		act(() => result.current.startUpload());
		act(() => captured.calls[0].onError(new Error('Server error')));

		expect(result.current.counts).toEqual({ done: 1, total: 2 });
		expect(result.current.error).toBe('Server error');

		rerender({ isOpen: false });

		expect(result.current.files).toEqual([]);
		expect(result.current.folderName).toBe('');
		expect(result.current.counts).toEqual({ done: 0, total: 0 });
		expect(result.current.error).toBeNull();
	});
});
