/**
 * Bricks builder panel: gallery and album picker.
 *
 * Bricks has no custom-control API. Each element carries an `info` control
 * holding a `.fg-pb-bricks-picker` placeholder, which this bundle fills with
 * a React card. The chosen ID is written into the element's text control
 * followed by a native `input` event, so Bricks saves, re-renders and
 * records undo history as if it had been typed.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { __, _n, sprintf } from '@wordpress/i18n';

import PickerModal from '../../../../core/assets/src/components/PickerModal';
import { Button } from '@/admin/src/components/shared/Button';
import { collectionTitle } from '@/admin/src/utils/collection-title';
import '../../../../core/assets/src/collection.scss';
import './editor.scss';

const config = window.fotogridsPbBricks || {};
const PLACEHOLDER_SELECTOR = '.fg-pb-bricks-picker[data-fg-picker-kind]';
const READY_CLASS = 'fg-pb-bricks-picker-ready';

const roots = new Map();
const listeners = new Set();
const cache = { gallery: null, album: null };

const settingInput = () =>
	document.querySelector(
		`[data-controlkey="${config.settingKey || 'fgCollectionId'}"] input`
	);

const readId = () => {
	const input = settingInput();
	const id = input ? parseInt(input.value, 10) : 0;
	return id > 0 ? id : 0;
};

const writeId = (id) => {
	const input = settingInput();
	if (!input) {
		return;
	}
	input.value = String(id);
	input.dispatchEvent(new Event('input', { bubbles: true }));
	notify();
};

const notify = () => listeners.forEach((listener) => listener());

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
 * Keep keystrokes inside the modal away from Bricks' document shortcuts,
 * which deselect the element on Escape and undo on Cmd+Z.
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
 * @param {string} kind      'gallery' or 'album'.
 * @param {number} currentId Current selection.
 */
const openPicker = (kind, currentId) => {
	const host = document.createElement('div');
	host.className = 'fg-pb-bricks-picker__modal-host';
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
				writeId(item.id);
			}}
		/>
	);
};

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

const BricksPicker = ({ kind }) => {
	const isAlbum = kind === 'album';
	const [id, setId] = useState(readId);
	const [item, setItem] = useState(null);

	useEffect(() => {
		const sync = () => setId(readId());
		listeners.add(sync);
		return () => listeners.delete(sync);
	}, []);

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

	const choose = useCallback(() => openPicker(kind, id), [kind, id]);
	const createUrl = isAlbum ? config.albumCreateUrl : config.galleryCreateUrl;
	const editBase = isAlbum ? config.albumEditBase : config.galleryEditBase;

	return (
		<div className="fg-pb-bricks-picker__card">
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
				<p className="fg-pb-bricks-picker__empty">
					{isAlbum
						? __('No album selected yet.', 'fotogrids')
						: __('No gallery selected yet.', 'fotogrids')}
				</p>
			)}
			<div className="fg-pb-bricks-picker__actions">
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
						href={`${editBase}${id}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{isAlbum
							? __('Edit album', 'fotogrids')
							: __('Edit gallery', 'fotogrids')}
					</Button>
				)}
			</div>
			{createUrl && (
				<Button
					variant="secondary"
					size="sm"
					icon="plus"
					fullWidth
					href={createUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					{isAlbum
						? __('Create new album', 'fotogrids')
						: __('Create new gallery', 'fotogrids')}
				</Button>
			)}
		</div>
	);
};

/**
 * Mount a card into every new placeholder and unmount cards whose
 * placeholder Bricks has removed. The panel re-renders on element switch.
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
		const root = createRoot(node);
		root.render(<BricksPicker kind={node.dataset.fgPickerKind} />);
		roots.set(node, root);
		document.body.classList.add(READY_CLASS);
	});
	notify();
};

new MutationObserver(reconcile).observe(document.body, {
	childList: true,
	subtree: true,
});

document.addEventListener(
	'input',
	(event) => {
		if (event.target === settingInput()) {
			notify();
		}
	},
	true
);

reconcile();
