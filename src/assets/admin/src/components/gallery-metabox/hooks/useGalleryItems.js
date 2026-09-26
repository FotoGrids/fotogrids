/**
 * Items state for the gallery metabox.
 */

import { useCallback, useEffect, useState } from 'react';
import { deleteEmbed } from '../api/embed-api';

/**
 * The shared collection-state manager, published by the admin bootstrap before
 * this tree mounts.
 *
 * @return {Object|undefined} The manager, when present.
 */
const collectionState = () => window.FotoGridsCollectionState;

/**
 * Tells ajax-save.js a setting changed, which raises the unsaved-changes badge
 * and starts the autosave debounce.
 *
 * @param {string} source Change source label.
 * @return {void}
 */
const notifyChange = (source) => {
	document.dispatchEvent(
		new CustomEvent('fotogrids:setting_changed', {
			detail: { source },
		})
	);
};

/**
 * Owns the gallery's item list and every operation that mutates it, keeping
 * the shared collection-state manager and the save pipeline in step.
 *
 * @param {Object} options
 * @param {Array}  options.galleryItems Bootstrap payload for the gallery.
 * @param {Object} options.strings      Localised strings.
 * @return {Object} Items and the operations that change them.
 */
const useGalleryItems = ({ galleryItems, strings }) => {
	const [items, setItems] = useState(
		Array.isArray(galleryItems) ? galleryItems : []
	);

	useEffect(() => {
		if (Array.isArray(galleryItems)) {
			// Ensure `featured` property exists for all items. The bootstrap
			// payload carries `featured: bool` reflecting the gallery's
			// native `_thumbnail_id`; default to false for any item missing
			// the field.
			const itemsWithFeatured = galleryItems.map((item) => ({
				...item,
				featured: item.featured || false,
			}));

			setItems(itemsWithFeatured);

			const State = collectionState();
			if (State) {
				const itemIds = itemsWithFeatured
					.map((item) => String(item.id))
					.filter(Boolean);
				State.items.initItems(itemIds);
			}
		}
	}, [galleryItems]);

	// Save the gallery's featured item via REST. Pass null to clear.
	const saveFeaturedItem = useCallback(
		async (itemId) => {
			const galleryId = window.fotogridsMetaBoxes?.postId;
			if (!galleryId) {
				return;
			}
			try {
				await window.wp.apiFetch({
					path: `/fotogrids/v1/gallery/${galleryId}/featured-item`,
					method: 'POST',
					data: { item_id: itemId == null ? null : itemId },
				});
				if (window.fotogridsToast) {
					window.fotogridsToast.success(
						itemId
							? strings.featuredItemSet
							: strings.featuredItemCleared
					);
				}
			} catch (error) {
				if (window.fotogridsToast) {
					window.fotogridsToast.error(
						error?.message || strings.errorSavingFeatured
					);
				}
				console.error('Error saving featured item:', error);
			}
		},
		[strings]
	);

	/**
	 * Insert items into the grid, ignoring any whose attachment is already
	 * present, and mark the gallery dirty.
	 */
	const appendItems = useCallback((newItems) => {
		if (!Array.isArray(newItems) || newItems.length === 0) {
			return;
		}

		setItems((prevItems) => {
			const existingIds = new Set(prevItems.map((img) => img.id));
			const uniqueNewItems = newItems.filter(
				(img) => !existingIds.has(img.id)
			);
			const updatedItems = [...prevItems, ...uniqueNewItems];

			const State = collectionState();
			if (State) {
				const itemIds = updatedItems
					.map((item) => String(item.id))
					.filter(Boolean);
				State.items.setItems(itemIds);
			}

			return updatedItems;
		});

		notifyChange('items-add');
	}, []);

	const handleUploadComplete = useCallback(
		async (uploadedIds) => {
			if (!uploadedIds || uploadedIds.length === 0) {
				return;
			}

			const newItems = [];
			for (const id of uploadedIds) {
				try {
					const media = await wp.apiFetch({
						path: `/wp/v2/media/${id}`,
					});
					newItems.push({
						id: media.id,
						title:
							media.title?.rendered || media.slug || 'Untitled',
						url: media.source_url,
						thumbnail:
							media.media_details?.sizes?.thumbnail?.source_url ||
							media.source_url,
						alt: media.alt_text || '',
						featured: false,
					});
				} catch (err) {
					console.warn('Failed to fetch media', id, err);
				}
			}

			appendItems(newItems);
		},
		[appendItems]
	);

	const setFeatured = useCallback(
		async (itemId) => {
			let nextItemId = null;
			setItems((prevItems) => {
				const clickedItem = prevItems.find(
					(item) => item.id === itemId
				);
				const wasFeatured = !!clickedItem?.featured;
				nextItemId = wasFeatured ? null : itemId;

				return prevItems.map((item) => ({
					...item,
					featured: nextItemId !== null && item.id === nextItemId,
				}));
			});
			await saveFeaturedItem(nextItemId);
		},
		[saveFeaturedItem]
	);

	const deleteEmbedItem = useCallback(
		(embedId) => deleteEmbed({ embedId, strings }),
		[strings]
	);

	const removeItem = useCallback(
		(itemId) => {
			const itemToRemove = items.find((item) => item.id === itemId);
			const itemType = itemToRemove?.item_type || 'image';
			const isEmbed =
				itemType === 'video_youtube' || itemType === 'video_vimeo';

			setItems((prevItems) =>
				prevItems.filter((item) => item.id !== itemId)
			);

			// Embeds persist as item_meta rows independent of gallery save, so
			// removing one from the grid must delete its row via REST. They are
			// not in the State manager's attachment list.
			if (isEmbed) {
				deleteEmbedItem(itemId);
			} else {
				const State = collectionState();
				if (State) {
					State.items.removeItem(String(itemId));
				}
			}
			if (itemToRemove?.featured) {
				saveFeaturedItem(null);
			}

			notifyChange('items-remove');
		},
		[items, saveFeaturedItem, deleteEmbedItem]
	);

	const clearAllItems = useCallback(() => {
		setItems([]);
		saveFeaturedItem(null);
		const State = collectionState();
		if (State) {
			State.items.setItems([]);
		}
		notifyChange('items-remove-all');
	}, [saveFeaturedItem]);

	// Order has no endpoint of its own: it rides the gallery save through the
	// hidden `fotogrids_gallery_items[]` inputs each tile renders.
	const reorderItems = useCallback((newOrder) => {
		setItems((prevItems) => {
			const reorderedItems = newOrder
				.map((id) =>
					prevItems.find(
						(item) => item.id.toString() === id.toString()
					)
				)
				.filter(Boolean);

			const State = collectionState();
			if (State) {
				const itemIds = reorderedItems
					.map((item) => String(item.id))
					.filter(Boolean);
				State.items.reorderItems(itemIds);
			}

			return reorderedItems;
		});

		notifyChange('items-reorder');
	}, []);

	return {
		items,
		setItems,
		appendItems,
		handleUploadComplete,
		setFeatured,
		removeItem,
		clearAllItems,
		reorderItems,
	};
};

export default useGalleryItems;
