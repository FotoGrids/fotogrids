/**
 * Beaver Builder settings form: gallery and album picker.
 *
 * Runs in the document that renders Beaver Builder's settings forms. Each
 * `fotogrids-collection` field carries a `.fg-pb-bb-picker` placeholder,
 * which this bundle fills with a React card. The chosen ID is written into
 * the field's input followed by a native `change` event, which Beaver
 * Builder's live preview and settings save both read.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { __, _n, sprintf } from '@wordpress/i18n';

import PickerModal from '../../../../core/assets/src/components/PickerModal';
import { Button } from '@/admin/src/components/shared/Button';
import { collectionTitle } from '@/admin/src/utils/collection-title';
import '../../../../core/assets/src/collection.scss';
import './editor.scss';

const config = window.fotogridsPbBeaverBuilder || {};
const PLACEHOLDER_SELECTOR = '.fg-pb-bb-picker[data-fg-picker-kind]';
const FIELD_SELECTOR = '.fg-pb-bb-collection';
const INPUT_SELECTOR = '.fg-pb-bb-collection__input';
const READY_CLASS = 'is-fg-pb-ready';

const roots = new Map();
const cache = { gallery: null, album: null };

const fieldInput = (node) => {
	const field = node.closest(FIELD_SELECTOR);
	return field ? field.querySelector(INPUT_SELECTOR) : null;
};

const readId = (input) => {
	const id = input ? parseInt(input.value, 10) : 0;
	return id > 0 ? id : 0;
};

const writeId = (input, id) => {
	if (!input) {
		return;
	}
	input.value = String(id);
	input.dispatchEvent(new Event('change', { bubbles: true }));
};

async function fetchItems(kind) {
	if (cache[kind]) {
		return cache[kind];
	}
	const url = new URL(`${config.restUrl || ''}picker/items`);
	url.searchParams.set('type', kind);
	url.searchParams.set('per_page', '200');
	url.searchParams.set('orderby', 'modified');

	const response = await fetch(url.toString(), {
		headers: { 'X-WP-Nonce': config.restNonce || '' },
	});
	if (!response.ok) {
		throw new Error('FotoGrids picker REST failed');
	}
	const body = await response.json();
	cache[kind] = body.items || [];
	return cache[kind];
}

/**
 * Keep keystrokes inside the modal away from Beaver Builder's keyboard
 * shortcuts.
 *
 * @param {() => void} onEscape Called when Escape is pressed.
 * @return {() => void} Removes the guard.
 */
const guardKeys = (onEscape) => {
	const handler = (event) => {
		const target = event.target;
		const inModal =
			target === document.body ||
			(target && target.closest && target.closest('.fg-modal'));
		if (!inModal) {
			return;
		}
		event.stopPropagation();
		if (event.type === 'keydown' && event.key === 'Escape') {
			onEscape();
		}
	};
	document.body.addEventListener('keydown', handler);
	document.body.addEventListener('keyup', handler);
	return () => {
		document.body.removeEventListener('keydown', handler);
		document.body.removeEventListener('keyup', handler);
	};
};

/**
 * Open the shared picker modal.
 *
 * @param {string}                  kind      'gallery' or 'album'.
 * @param {number}                  currentId Current selection.
 * @param {(id: number) => void}    onSelect  Called with the chosen ID.
 */
const openPicker = (kind, currentId, onSelect) => {
	const host = document.createElement('div');
	host.className = 'fg-pb-bb-picker__modal-host';
	document.body.appendChild(host);
	const root = createRoot(host);

	let removeGuard = () => {};
	const close = () => {
		removeGuard();
		root.unmount();
		host.remove();
	};
	removeGuard = guardKeys(close);

	root.render(
		<PickerModal
			kind={kind}
			restUrl={config.restUrl}
			restNonce={config.restNonce}
			selectedId={currentId}
			createNewUrl={
				kind === 'album'
					? config.albumCreateUrl
					: config.galleryCreateUrl
			}
			onClose={close}
			onSelect={(item) => {
				close();
				cache[kind] = null;
				onSelect(item.id);
			}}
		/>
	);
};

const openTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

const countLabel = (kind, count) =>
	kind === 'album'
		? sprintf(
				/* translators: %d: number of galleries. */
				_n('%d gallery', '%d galleries', count, 'fotogrids'),
				count
			)
		: sprintf(
				/* translators: %d: number of items. */
				_n('%d item', '%d items', count, 'fotogrids'),
				count
			);

const CreateButton = ({ kind }) => {
	const isAlbum = kind === 'album';
	const url = isAlbum ? config.albumCreateUrl : config.galleryCreateUrl;
	if (!url) {
		return null;
	}
	return (
		<Button
			variant="secondary"
			size="sm"
			icon="plus"
			fullWidth
			onClick={() => openTab(url)}
		>
			{isAlbum
				? __('Create new album', 'fotogrids')
				: __('Create new gallery', 'fotogrids')}
		</Button>
	);
};

const CollectionPicker = ({ kind, input }) => {
	const isAlbum = kind === 'album';
	const [id, setId] = useState(() => readId(input));
	const [item, setItem] = useState(null);

	useEffect(() => {
		const sync = () => setId(readId(input));
		input.addEventListener('change', sync);
		input.addEventListener('input', sync);
		return () => {
			input.removeEventListener('change', sync);
			input.removeEventListener('input', sync);
		};
	}, [input]);

	useEffect(() => {
		if (!id) {
			setItem(null);
			return undefined;
		}
		let cancelled = false;
		const find = (items) => items.find((it) => it.id === id) || null;
		fetchItems(kind)
			.then((items) => {
				if (find(items)) {
					return items;
				}
				cache[kind] = null;
				return fetchItems(kind);
			})
			.then((items) => !cancelled && setItem(find(items)))
			.catch(() => !cancelled && setItem(null));
		return () => {
			cancelled = true;
		};
	}, [id, kind]);

	const choose = useCallback(
		() => openPicker(kind, id, (chosen) => writeId(input, chosen)),
		[kind, id, input]
	);
	const editBase = isAlbum ? config.albumEditBase : config.galleryEditBase;

	return (
		<div className="fg-pb-bb-picker__card">
			{id > 0 ? (
				<div className="fg-pb-inspector-summary">
					{item && item.featured_thumb && (
						<img
							className="fg-pb-inspector-summary__thumb"
							src={item.featured_thumb}
							alt=""
						/>
					)}
					<div className="fg-pb-inspector-summary__text">
						<strong>
							{collectionTitle(item ? item.title : '', kind, id)}
						</strong>
						{item && (
							<div className="fg-pb-inspector-summary__meta">
								<span>{countLabel(kind, item.item_count)}</span>
							</div>
						)}
					</div>
				</div>
			) : (
				<p className="fg-pb-bb-picker__empty">
					{isAlbum
						? __('No album selected yet.', 'fotogrids')
						: __('No gallery selected yet.', 'fotogrids')}
				</p>
			)}
			<div className="fg-pb-bb-picker__actions">
				<Button variant="primary" size="sm" onClick={choose}>
					{id > 0
						? isAlbum
							? __('Change album', 'fotogrids')
							: __('Change gallery', 'fotogrids')
						: isAlbum
							? __('Choose album', 'fotogrids')
							: __('Choose gallery', 'fotogrids')}
				</Button>
				{id > 0 && editBase && (
					<Button
						variant="secondary"
						size="sm"
						onClick={() => openTab(`${editBase}${id}`)}
					>
						{isAlbum
							? __('Edit album', 'fotogrids')
							: __('Edit gallery', 'fotogrids')}
					</Button>
				)}
			</div>
			<CreateButton kind={kind} />
		</div>
	);
};

/**
 * Mount a card into every new placeholder and unmount cards whose
 * placeholder Beaver Builder has removed with its settings form.
 */
const reconcile = () => {
	for (const [node, root] of roots) {
		if (!node.isConnected) {
			root.unmount();
			roots.delete(node);
		}
	}
	document.querySelectorAll(PLACEHOLDER_SELECTOR).forEach((node) => {
		if (roots.has(node)) {
			return;
		}
		const kind = node.dataset.fgPickerKind;
		if (node.dataset.fgPickerMode === 'create') {
			const root = createRoot(node);
			root.render(<CreateButton kind={kind} />);
			roots.set(node, root);
			return;
		}
		const input = fieldInput(node);
		if (!input) {
			return;
		}
		const root = createRoot(node);
		root.render(<CollectionPicker kind={kind} input={input} />);
		roots.set(node, root);
		node.closest(FIELD_SELECTOR).classList.add(READY_CLASS);
	});
};

new MutationObserver(reconcile).observe(document.body, {
	childList: true,
	subtree: true,
});

reconcile();
