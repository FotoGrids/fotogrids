/**
 * Tests for admin/src/components/blocks/MediaUpload.jsx
 *
 * `uploadMedia()` reports successes through onFileChange and failures through
 * onError, and never signals that a batch is done, so the component counts
 * both. These cover that counting, including the batch where part of the set
 * fails and the successes still have to reach the gallery.
 */
import React, { act } from 'react';
import { renderElement } from '@tests/helpers/render-component';

const mockUploadMedia = jest.fn();

jest.mock('@wordpress/media-utils', () => ({
	uploadMedia: (...args) => mockUploadMedia(...args),
}));

const MediaUpload = require('@/admin/src/components/blocks/MediaUpload').default;

const imageFile = (name) => new File(['x'], name, { type: 'image/png' });

/**
 * Drop files onto the rendered upload zone.
 *
 * @param {HTMLElement} container Rendered container.
 * @param {File[]}      files     Files to drop.
 * @return {void}
 */
const dropFiles = (container, files) => {
	const zone = container.querySelector('.fotogrids-upload-area');

	act(() => {
		const event = new Event('drop', { bubbles: true });
		event.dataTransfer = { files };
		zone.dispatchEvent(event);
	});
};

describe('MediaUpload', () => {
	it('ignores files that are not images', () => {
		const { container } = renderElement(<MediaUpload onUploadComplete={jest.fn()} />);

		dropFiles(container, [new File(['x'], 'notes.txt', { type: 'text/plain' })]);

		expect(mockUploadMedia).not.toHaveBeenCalled();
	});

	it('reports the IDs once every file has settled', () => {
		const onUploadComplete = jest.fn();
		const { container } = renderElement(
			<MediaUpload onUploadComplete={onUploadComplete} />
		);

		dropFiles(container, [imageFile('a.png'), imageFile('b.png')]);

		expect(mockUploadMedia).toHaveBeenCalledTimes(1);

		const args = mockUploadMedia.mock.calls[0][0];
		expect(args.filesList).toHaveLength(2);
		expect(args.allowedTypes).toEqual(['image']);

		// Blob placeholders carry no ID and must not count as settled.
		act(() => {
			args.onFileChange([{ url: 'blob:a' }, { url: 'blob:b' }]);
		});
		expect(onUploadComplete).not.toHaveBeenCalled();

		act(() => {
			args.onFileChange([{ id: 21 }, { url: 'blob:b' }]);
		});
		expect(onUploadComplete).not.toHaveBeenCalled();

		act(() => {
			args.onFileChange([{ id: 21 }, { id: 22 }]);
		});

		expect(onUploadComplete).toHaveBeenCalledWith([21, 22]);
	});

	it('still reports successes when part of the batch fails', () => {
		const onUploadComplete = jest.fn();
		const { container } = renderElement(
			<MediaUpload onUploadComplete={onUploadComplete} />
		);

		dropFiles(container, [imageFile('a.png'), imageFile('b.png')]);

		const args = mockUploadMedia.mock.calls[0][0];

		act(() => {
			args.onFileChange([{ id: 31 }]);
			args.onError(new Error('File too large'));
		});

		expect(onUploadComplete).toHaveBeenCalledWith([31]);
		expect(container.textContent).toContain('File too large');
	});

	it('does not call back when every file fails', () => {
		const onUploadComplete = jest.fn();
		const { container } = renderElement(
			<MediaUpload onUploadComplete={onUploadComplete} />
		);

		dropFiles(container, [imageFile('a.png')]);

		act(() => {
			mockUploadMedia.mock.calls[0][0].onError(new Error('Unsupported file type'));
		});

		expect(onUploadComplete).not.toHaveBeenCalled();
		expect(container.textContent).toContain('Unsupported file type');
	});
});
