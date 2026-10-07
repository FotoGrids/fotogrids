/**
 * Tests that a successful Item Edit save reports the new title and alt text
 * back to the gallery grid.
 */
import React from 'react';
import ItemEditModal from '@/admin/src/components/ItemEditModal';
import { renderElement, act, changeValue } from '@tests/helpers/render-component';

const h = React.createElement;

const jsonResponse = (body, ok = true) =>
	Promise.resolve({ ok, json: () => Promise.resolve(body) });

const flush = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const clickSave = async () => {
	const button = Array.from(document.body.querySelectorAll('button')).find(
		(node) => node.textContent.trim() === 'Save Changes'
	);
	expect(button).toBeTruthy();
	await act(async () => {
		button.dispatchEvent(
			new window.MouseEvent('click', { bubbles: true, cancelable: true })
		);
	});
	await flush();
};

describe('ItemEditModal onSaved', () => {
	let saveOk;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.wpApiSettings = { root: 'http://example.test/wp-json/', nonce: 'n' };
		window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
		saveOk = true;
		global.fetch = jest.fn((url) => {
			if (String(url).endsWith('/save')) {
				return saveOk
					? jsonResponse({ success: true })
					: jsonResponse({ success: false, message: 'Nope' }, false);
			}
			return jsonResponse({ tags: [], people: [], locations: [] });
		});
	});

	afterEach(() => {
		delete global.fetch;
		delete window.fotogridsToast;
	});

	const mount = async (onSaved) => {
		const view = renderElement(
			h(ItemEditModal, {
				itemId: 42,
				itemData: { id: 42, title: 'Shore', alt: 'Waves' },
				loading: false,
				items: [{ id: 42 }],
				onClose: () => {},
				onNavigate: () => {},
				onSaved,
				strings: {},
			})
		);
		await flush();
		return view;
	};

	it('passes the saved title and alt text to onSaved', async () => {
		const onSaved = jest.fn();
		const { unmount } = await mount(onSaved);

		changeValue(document.getElementById('fotogrids-item-title'), 'Harbour');
		await flush();
		await clickSave();

		expect(onSaved).toHaveBeenCalledTimes(1);
		expect(onSaved).toHaveBeenCalledWith(42, { title: 'Harbour', alt: 'Waves' });
		unmount();
	});

	it('does not call onSaved when the save is refused', async () => {
		const onSaved = jest.fn();
		saveOk = false;
		const { unmount } = await mount(onSaved);

		changeValue(document.getElementById('fotogrids-item-title'), 'Harbour');
		await flush();
		await clickSave();

		expect(onSaved).not.toHaveBeenCalled();
		unmount();
	});
});
