/**
 * Tests for the unsaved-changes guard on the Item Edit modal: closing and
 * stepping to another item ask through the FotoGrids confirm dialog, never the
 * browser's native one.
 */
import React from 'react';
import ItemEditModal from '@/admin/src/components/ItemEditModal';
import { renderElement, act, changeValue } from '@tests/helpers/render-component';

const h = React.createElement;

const STRINGS = {
	close: 'Close',
	unsavedChangesConfirm: 'Close without saving?',
	unsavedChangesNavigate: 'Leave this item without saving?',
	unsavedChangesTitle: 'Discard changes?',
	unsavedChangesDiscard: 'Discard changes',
	unsavedChangesKeepEditing: 'Keep editing',
};

const jsonResponse = (body) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const flush = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const buttonByText = (text) =>
	Array.from(document.body.querySelectorAll('button')).find(
		(node) => node.textContent.trim() === text
	);

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

const editTitle = async (value) => {
	const input = document.getElementById('fotogrids-item-title');
	expect(input).toBeTruthy();
	changeValue(input, value);
	await flush();
};

describe('ItemEditModal unsaved guard', () => {
	let confirmSpy;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.wpApiSettings = { root: 'http://example.test/wp-json/', nonce: 'n' };
		global.fetch = jest.fn(() => jsonResponse({ tags: [], people: [], locations: [] }));
		confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
	});

	afterEach(() => {
		confirmSpy.mockRestore();
		delete global.fetch;
	});

	const mount = async ({ onClose = jest.fn(), onNavigate = jest.fn() } = {}) => {
		const view = renderElement(
			h(ItemEditModal, {
				itemId: 42,
				itemData: { id: 42, title: 'Shore' },
				loading: false,
				items: [{ id: 41 }, { id: 42 }, { id: 43 }],
				onClose,
				onNavigate,
				strings: STRINGS,
			})
		);
		await flush();
		return view;
	};

	it('closes without asking when nothing has changed', async () => {
		const onClose = jest.fn();
		const { unmount } = await mount({ onClose });

		await clickAsync(buttonByText('Close'));

		expect(confirmDialog()).toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
		unmount();
	});

	it('asks before closing with unsaved changes and stays open on Keep editing', async () => {
		const onClose = jest.fn();
		const { unmount } = await mount({ onClose });

		await editTitle('Shoreline');
		await clickAsync(buttonByText('Close'));

		expect(confirmDialog()).toBeTruthy();
		expect(confirmDialog().textContent).toContain(STRINGS.unsavedChangesConfirm);
		expect(onClose).not.toHaveBeenCalled();

		await clickAsync(buttonByText('Keep editing'));
		await flush();

		expect(onClose).not.toHaveBeenCalled();
		expect(document.getElementById('fotogrids-item-title').value).toBe('Shoreline');
		expect(confirmSpy).not.toHaveBeenCalled();
		unmount();
	});

	it('closes on Discard changes', async () => {
		const onClose = jest.fn();
		const { unmount } = await mount({ onClose });

		await editTitle('Shoreline');
		await pressEscape();

		expect(confirmDialog()).toBeTruthy();

		await clickAsync(buttonByText('Discard changes'));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(confirmSpy).not.toHaveBeenCalled();
		unmount();
	});

	it('asks with the navigate wording before stepping to another item', async () => {
		const onNavigate = jest.fn();
		const { unmount } = await mount({ onNavigate });

		await editTitle('Shoreline');
		await clickAsync(document.body.querySelector('.fg-modal__nav--next'));

		expect(confirmDialog()).toBeTruthy();
		expect(confirmDialog().textContent).toContain(STRINGS.unsavedChangesNavigate);
		expect(onNavigate).not.toHaveBeenCalled();

		await clickAsync(buttonByText('Discard changes'));

		expect(onNavigate).toHaveBeenCalledWith('next');
		expect(confirmSpy).not.toHaveBeenCalled();
		unmount();
	});

	it('steps to another item without asking when nothing has changed', async () => {
		const onNavigate = jest.fn();
		const { unmount } = await mount({ onNavigate });

		await clickAsync(document.body.querySelector('.fg-modal__nav--prev'));

		expect(confirmDialog()).toBeNull();
		expect(onNavigate).toHaveBeenCalledWith('prev');
		unmount();
	});
});
