/**
 * Tests for the unsaved-work guard on the three modals that hold a
 * part-filled form: ZIP import, folder import and video embed.
 *
 * Each modal is rendered on its own, with no ModalRoot mounted. The admin
 * bundles these modals into `metabox`, which webpack keeps separate from
 * `global-modal-init` where the only ModalRoot lives, so a dialog routed
 * through the imperative registry never renders on the real screen.
 */
import React from 'react';
import ZipImportModal from '@/admin/src/components/ZipImportModal';
import FolderImportModal from '@/admin/src/components/FolderImportModal';
import VideoEmbedModal from '@/admin/src/components/VideoEmbedModal';
import { renderElement, act, changeValue } from '@tests/helpers/render-component';

const h = React.createElement;

const STRINGS = {
	cancel: 'Cancel',
	done: 'Done',
	addToGallery: 'Add to Gallery',
	adding: 'Adding',
	uploading: 'Uploading',
	loading: 'Loading',
	unsavedChangesConfirm: 'You have unsaved changes.',
	unsavedChangesTitle: 'Discard changes?',
	unsavedChangesDiscard: 'Discard',
	unsavedChangesKeepEditing: 'Keep editing',
	uploadFromZipModalTitle: 'Import from ZIP',
	uploadFromZipUploadAndAdd: 'Upload and add',
	uploadFromZipChoose: 'Choose a ZIP',
	uploadFromFolderModalTitle: 'Import from folder',
	uploadFromFolderOnServer: 'On the server',
	uploadFromFolderOnComputer: 'On my computer',
	uploadFromFolderUploadAndAdd: 'Upload and add',
	uploadFromFolderImagesReady: 'images ready',
	uploadFromFolderEmpty: 'Nothing here',
	addVideoEmbed: 'Add Video Embed',
	editVideoEmbed: 'Edit Video Embed',
};

const buttons = () => Array.from(document.body.querySelectorAll('button'));

const buttonByText = (text) =>
	buttons().find((node) => node.textContent.trim() === text);

const confirmDialog = () => document.body.querySelector('.fg-confirm');

const clickAsync = async (node) => {
	expect(node).toBeTruthy();
	await act(async () => {
		node.dispatchEvent(
			new window.MouseEvent('click', { bubbles: true, cancelable: true })
		);
	});
};

const pressEscape = async () => {
	await act(async () => {
		document.dispatchEvent(
			new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
	});
};

/**
 * Put files on a hidden file input and fire the change React listens for.
 *
 * @param {string} id    Input element id.
 * @param {File[]} files Files to report.
 */
const selectFiles = async (id, files) => {
	const input = document.getElementById(id);
	expect(input).toBeTruthy();
	Object.defineProperty(input, 'files', { value: files, configurable: true });
	await act(async () => {
		input.dispatchEvent(new window.Event('change', { bubbles: true }));
	});
};

const zipFile = () => new File(['archive'], 'photos.zip', { type: 'application/zip' });
const imageFile = () => new File(['binary'], 'shot.jpg', { type: 'image/jpeg' });

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ZipImportModal unsaved guard', () => {
	const render = (onClose) =>
		renderElement(
			h(ZipImportModal, {
				isOpen: true,
				onClose,
				onAddItems: jest.fn(),
				galleryId: 7,
				strings: STRINGS,
			})
		);

	it('closes without asking when no archive has been chosen', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});

	it('asks before discarding a chosen archive and stays open on Keep editing', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await selectFiles('fotogrids-zip-upload-input', [zipFile()]);
		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();

		await clickAsync(buttonByText('Keep editing'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
		handle.unmount();
	});

	it('closes once Discard is confirmed', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await selectFiles('fotogrids-zip-upload-input', [zipFile()]);
		await clickAsync(buttonByText('Cancel'));
		await clickAsync(buttonByText('Discard'));

		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});

	it('guards the Esc key as well as the Cancel button', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await selectFiles('fotogrids-zip-upload-input', [zipFile()]);
		await pressEscape();

		expect(confirmDialog()).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();
		handle.unmount();
	});

	it('guards an overlay click as well as the Cancel button', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await selectFiles('fotogrids-zip-upload-input', [zipFile()]);
		await clickAsync(document.body.querySelector('.fg-modal__overlay'));

		expect(confirmDialog()).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();
		handle.unmount();
	});
});

describe('FolderImportModal unsaved guard', () => {
	const render = (onClose) =>
		renderElement(
			h(FolderImportModal, {
				isOpen: true,
				onClose,
				onAddItems: jest.fn(),
				onUploadComplete: jest.fn(),
				galleryId: 7,
				strings: STRINGS,
			})
		);

	beforeEach(() => {
		wp.apiFetch.mockResolvedValue({
			path: '',
			parent: null,
			breadcrumbs: [],
			folders: [],
			files: [],
			total: 0,
			page: 1,
		});
	});

	const queueLocalFolder = async () => {
		await clickAsync(buttonByText('On my computer'));
		await selectFiles('fotogrids-folder-upload-input', [imageFile()]);
	};

	it('closes without asking when nothing is selected or queued', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});

	it('asks before discarding a queued folder and stays open on Keep editing', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await queueLocalFolder();
		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();

		await clickAsync(buttonByText('Keep editing'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
		handle.unmount();
	});

	it('closes once Discard is confirmed', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await queueLocalFolder();
		await clickAsync(buttonByText('Cancel'));
		await clickAsync(buttonByText('Discard'));

		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});
});

describe('VideoEmbedModal unsaved guard', () => {
	const EDIT_ITEM = {
		id: 42,
		source: 'youtube',
		embed: {
			embed_url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
			video_id: 'aaaaaaaaaaa',
			caption: 'A clip',
			settings: {},
		},
	};

	const render = (onClose, editItem = null) =>
		renderElement(
			h(VideoEmbedModal, {
				isOpen: true,
				onClose,
				onAdd: jest.fn(),
				onUpdate: jest.fn(),
				editItem,
				strings: STRINGS,
			})
		);

	it('gives the URL field a pattern the v flag accepts', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		const { pattern } = document.getElementById('fg-embed-url');
		expect(pattern).toBeTruthy();
		// The pattern attribute compiles with the `v` flag, which treats a
		// bare '-' inside a character class as a reserved punctuator.
		expect(() => new RegExp(`^(?:${pattern})$`, 'v')).not.toThrow();
		expect(
			new RegExp(`^(?:${pattern})$`, 'v').test(
				'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
			)
		).toBe(true);
		handle.unmount();
	});

	it('closes without asking when the form was never touched', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});

	it('treats an edit-mode prefill as unchanged', async () => {
		const onClose = jest.fn();
		const handle = render(onClose, EDIT_ITEM);

		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});

	it('asks before discarding a typed link and stays open on Keep editing', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		changeValue(
			document.getElementById('fg-embed-url'),
			'https://www.youtube.com/watch?v=bbbbbbbbbbb'
		);
		await clickAsync(buttonByText('Cancel'));

		expect(confirmDialog()).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();

		await clickAsync(buttonByText('Keep editing'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
		handle.unmount();
	});

	it('closes once Discard is confirmed', async () => {
		const onClose = jest.fn();
		const handle = render(onClose);

		changeValue(
			document.getElementById('fg-embed-url'),
			'https://www.youtube.com/watch?v=bbbbbbbbbbb'
		);
		await clickAsync(buttonByText('Cancel'));
		await clickAsync(buttonByText('Discard'));

		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});
});
