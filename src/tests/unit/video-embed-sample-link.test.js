/**
 * Tests for the FotoGrids sample videos in VideoEmbedModal: the link
 * placeholder per source, and loading the sample from an empty link field.
 */
import React from 'react';
import VideoEmbedModal from '@/admin/src/components/VideoEmbedModal';
import {
	renderElement,
	act,
	changeValue,
} from '@tests/helpers/render-component';

const h = React.createElement;

const YOUTUBE_SAMPLE = 'https://youtu.be/nxehlC9adbg';
const VIMEO_SAMPLE = 'https://vimeo.com/1238854752';

const STRINGS = {
	cancel: 'Cancel',
	loadVideo: 'Load video',
	unsavedChangesKeepEditing: 'Keep editing',
	unsavedChangesDiscard: 'Discard changes',
};

const urlInput = () => document.getElementById('fg-embed-url');

const loadButton = () =>
	document.body.querySelector('button[aria-label="Load video"]');

const sourceButton = (label) =>
	Array.from(document.body.querySelectorAll('.fg-button-group__button')).find(
		(node) => node.textContent.trim() === label
	);

const buttonByText = (text) =>
	Array.from(document.body.querySelectorAll('button')).find(
		(node) => node.textContent.trim() === text
	);

const clickAsync = async (node) => {
	expect(node).toBeTruthy();
	await act(async () => {
		node.dispatchEvent(
			new window.MouseEvent('click', { bubbles: true, cancelable: true })
		);
	});
};

const dispatchAsync = async (node, event) => {
	await act(async () => {
		node.dispatchEvent(event);
	});
};

const resolveRequests = () =>
	global.fetch.mock.calls
		.filter(([url]) => String(url).includes('items/resolve-embed'))
		.map(([, init]) => JSON.parse(init.body));

const render = (editItem = null) =>
	renderElement(
		h(VideoEmbedModal, {
			isOpen: true,
			onClose: jest.fn(),
			onAdd: jest.fn(),
			onUpdate: jest.fn(),
			editItem,
			strings: STRINGS,
		})
	);

beforeEach(() => {
	document.body.innerHTML = '';
	window.wpApiSettings = { root: 'https://example.com/wp-json/', nonce: 'n' };
	window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
	global.fetch.mockReset();
	global.fetch.mockImplementation((url, init) => {
		const { url: link } = JSON.parse(init.body);
		const id = link.includes('vimeo') ? '1238854752' : 'nxehlC9adbg';
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve({ video_id: id, title: 'Sample' }),
		});
	});
});

describe('VideoEmbedModal sample link', () => {
	it('opens in add mode with an empty link and the YouTube sample as placeholder', () => {
		const handle = render();

		expect(urlInput().value).toBe('');
		expect(urlInput().placeholder).toBe(YOUTUBE_SAMPLE);
		expect(loadButton().disabled).toBe(false);
		handle.unmount();
	});

	it('shows the Vimeo sample as placeholder after switching to Vimeo', async () => {
		const handle = render();

		await clickAsync(sourceButton('Vimeo'));

		expect(urlInput().value).toBe('');
		expect(urlInput().placeholder).toBe(VIMEO_SAMPLE);
		handle.unmount();
	});

	it('shows the sample placeholder again once a typed link is cleared', () => {
		const handle = render();

		changeValue(urlInput(), 'https://www.youtube.com/watch?v=bbbbbbbbbbb');
		changeValue(urlInput(), '');

		expect(urlInput().placeholder).toBe(YOUTUBE_SAMPLE);
		handle.unmount();
	});

	it('restores a typed link when switching back to its source', async () => {
		const handle = render();
		const typed = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';

		changeValue(urlInput(), typed);
		await clickAsync(sourceButton('Vimeo'));
		await clickAsync(sourceButton('YouTube'));

		expect(urlInput().value).toBe(typed);
		handle.unmount();
	});

	it('loads the YouTube sample when Load video is pressed on an empty link', async () => {
		const handle = render();

		await clickAsync(loadButton());

		expect(resolveRequests()).toEqual([
			{ source: 'video_youtube', url: YOUTUBE_SAMPLE },
		]);
		expect(urlInput().value).toBe(YOUTUBE_SAMPLE);
		expect(document.body.textContent).toContain('nxehlC9adbg');
		handle.unmount();
	});

	it('loads the Vimeo sample when Enter is pressed on an empty Vimeo link', async () => {
		const handle = render();

		await clickAsync(sourceButton('Vimeo'));
		await dispatchAsync(
			urlInput(),
			new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
		);

		expect(resolveRequests()).toEqual([
			{ source: 'video_vimeo', url: VIMEO_SAMPLE },
		]);
		expect(urlInput().value).toBe(VIMEO_SAMPLE);
		handle.unmount();
	});

	it('sends one request when the link field blurs while Enter is loading', async () => {
		let finish;
		global.fetch.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = () =>
						resolve({
							ok: true,
							json: () =>
								Promise.resolve({
									video_id: 'nxehlC9adbg',
									title: 'Sample',
								}),
						});
				})
		);
		const handle = render();

		await dispatchAsync(
			urlInput(),
			new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
		);
		await dispatchAsync(
			urlInput(),
			new window.FocusEvent('focusout', { bubbles: true })
		);
		await act(async () => finish());

		expect(resolveRequests()).toEqual([
			{ source: 'video_youtube', url: YOUTUBE_SAMPLE },
		]);
		handle.unmount();
	});

	it('loads a typed link instead of the sample', async () => {
		const handle = render();
		const typed = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';

		changeValue(urlInput(), typed);
		await clickAsync(loadButton());

		expect(resolveRequests()).toEqual([
			{ source: 'video_youtube', url: typed },
		]);
		handle.unmount();
	});

	it('loads nothing when an empty link field loses focus', async () => {
		const handle = render();

		await dispatchAsync(
			urlInput(),
			new window.FocusEvent('focusout', { bubbles: true })
		);

		expect(resolveRequests()).toEqual([]);
		handle.unmount();
	});

	it('opens an existing embed with its own link in edit mode', () => {
		const handle = render({
			id: 42,
			source: 'vimeo',
			embed: {
				embed_url: 'https://vimeo.com/76979871',
				video_id: '76979871',
				caption: 'A clip',
				settings: {},
			},
		});

		expect(urlInput().value).toBe('https://vimeo.com/76979871');
		handle.unmount();
	});

	it('closes without asking when opened and closed untouched', async () => {
		const onClose = jest.fn();
		const handle = renderElement(
			h(VideoEmbedModal, {
				isOpen: true,
				onClose,
				onAdd: jest.fn(),
				onUpdate: jest.fn(),
				strings: STRINGS,
			})
		);

		await clickAsync(buttonByText('Cancel'));

		expect(document.body.querySelector('.fg-confirm')).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		handle.unmount();
	});
});
