/**
 * Tests for adding tags, people and locations in the Item Edit modal.
 */
import React from 'react';
import ItemEditModal from '@/admin/src/components/ItemEditModal';
import { renderElement, act, click } from '@tests/helpers/render-component';

const h = React.createElement;

const BEACH = { id: 7, name: 'Beach' };

const STRINGS = {
	tags: 'Tags',
	add: 'Add',
};

const jsonResponse = (body) =>
	Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const flush = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const typeInto = (input, value) => {
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		'value'
	).set;
	act(() => {
		setter.call(input, value);
		input.dispatchEvent(new window.Event('input', { bubbles: true }));
	});
};

const pressEnter = (input) => {
	act(() => {
		input.dispatchEvent(
			new window.KeyboardEvent('keydown', {
				key: 'Enter',
				bubbles: true,
				cancelable: true,
			})
		);
	});
};

const openTagsTab = () => {
	const tab = Array.from(document.body.querySelectorAll('button, [role="tab"]')).find(
		(node) => node.textContent.trim() === 'Tags'
	);
	click(tab);
};

const tagChips = () =>
	Array.from(document.body.querySelectorAll('.fotogrids-tag')).map((node) =>
		node.textContent.trim()
	);

describe('ItemEditModal metadata', () => {
	let postedTag;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.wpApiSettings = { root: 'http://example.test/wp-json/', nonce: 'n' };
		postedTag = BEACH;

		global.fetch = jest.fn((url, options = {}) => {
			if (options.method === 'POST') {
				return jsonResponse(postedTag);
			}
			if (String(url).includes('metadata/item/')) {
				return jsonResponse({ tags: [BEACH], people: [], locations: [] });
			}
			if (String(url).includes('metadata/tags')) {
				return jsonResponse([BEACH]);
			}
			return jsonResponse([]);
		});
	});

	afterEach(() => {
		delete global.fetch;
	});

	const mount = async () => {
		const view = renderElement(
			h(ItemEditModal, {
				itemId: 42,
				itemData: { id: 42, title: 'Shore' },
				loading: false,
				items: [{ id: 42 }],
				onClose: () => {},
				onNavigate: () => {},
				strings: STRINGS,
			})
		);
		await flush();
		openTagsTab();
		return view;
	};

	it('keeps one chip when an attached tag is typed in a different case', async () => {
		const { unmount } = await mount();
		expect(tagChips()).toHaveLength(1);

		const input = document.body.querySelector('.fotogrids-item-edit-metadata-input input');
		typeInto(input, 'beach');
		pressEnter(input);
		await flush();

		expect(tagChips()).toHaveLength(1);
		expect(input.value).toBe('');
		unmount();
	});

	it('adds a chip for a tag the item does not have yet', async () => {
		const { unmount } = await mount();
		postedTag = { id: 8, name: 'Sunset' };

		const input = document.body.querySelector('.fotogrids-item-edit-metadata-input input');
		typeInto(input, 'Sunset');
		pressEnter(input);
		await flush();

		expect(tagChips()).toHaveLength(2);
		unmount();
	});
});
