/**
 * Drag-and-drop reordering for the gallery items grid.
 */

import { useEffect, useRef } from 'react';

/**
 * Binds native HTML5 drag-and-drop handlers to the items grid and reports the
 * resulting order.
 *
 * Listeners are re-bound whenever `items` changes, because React replaces the
 * item nodes on re-render.
 *
 * @param {Object}   options
 * @param {Array}    options.items     Current items in grid order.
 * @param {Object}   options.strings   Localised strings; supplies the placeholder drop text.
 * @param {Function} options.onReorder Called with the new array of item ids after a drop.
 * @return {void}
 */
const useItemDragSort = ({ items, strings, onReorder }) => {
	const onReorderRef = useRef(onReorder);

	useEffect(() => {
		onReorderRef.current = onReorder;
	}, [onReorder]);

	useEffect(() => {
		const gridElement = document.getElementById('fotogrids-items-grid');

		if (!gridElement || items.length === 0) {
			return;
		}

		let draggedElement = null;
		let placeholder = null;
		let draggedIndex = -1;

		// Drag visuals are CSS-only (items.scss). An inline style set here
		// outlives the drag: React reuses these nodes by key and never clears
		// style properties it did not set.
		const createPlaceholder = () => {
			const placeholderEl = document.createElement('div');
			placeholderEl.className = 'fotogrids-item-placeholder';
			placeholderEl.setAttribute('data-drop-text', strings.dropHere);
			return placeholderEl;
		};

		const getItemIndex = (element) => {
			const itemNodes = Array.from(
				gridElement.querySelectorAll('.fotogrids-item-item')
			);
			return itemNodes.indexOf(element);
		};

		// Defensive cleanup: removes the dragging class from every item.
		// Called from handleDragEnd AND directly after a drop, because some
		// browsers don't fire dragend when the source node is reparented
		// mid-drag (which our drop handler does).
		const clearDraggingState = () => {
			gridElement
				.querySelectorAll('.fotogrids-item-item.fotogrids-dragging')
				.forEach((el) => el.classList.remove('fotogrids-dragging'));
			gridElement.classList.remove('fotogrids-sortable--dragging');
		};

		const handleDragStart = (e) => {
			draggedElement = e.currentTarget;
			draggedIndex = getItemIndex(draggedElement);
			draggedElement.classList.add('fotogrids-dragging');
			gridElement.classList.add('fotogrids-sortable--dragging');

			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData(
				'text/plain',
				draggedElement.getAttribute('data-id')
			);

			placeholder = createPlaceholder();
			draggedElement.parentNode.insertBefore(
				placeholder,
				draggedElement.nextSibling
			);
		};

		const handleDragEnd = () => {
			clearDraggingState();

			if (placeholder && placeholder.parentNode) {
				placeholder.parentNode.removeChild(placeholder);
			}

			draggedElement = null;
			placeholder = null;
			draggedIndex = -1;
		};

		const handleDragOver = (e) => {
			e.preventDefault();
			e.stopPropagation();

			e.dataTransfer.dropEffect = 'move';

			if (!draggedElement || draggedElement === e.currentTarget) {
				return;
			}

			const targetItem = e.currentTarget;
			const targetIndex = getItemIndex(targetItem);

			if (targetIndex === -1) {
				return;
			}

			if (placeholder && placeholder.parentNode) {
				placeholder.parentNode.removeChild(placeholder);
			}

			if (draggedIndex < targetIndex) {
				gridElement.insertBefore(placeholder, targetItem.nextSibling);
			} else {
				gridElement.insertBefore(placeholder, targetItem);
			}
		};

		const handleDrop = (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!draggedElement) {
				return false;
			}

			// Move the dragged element to wherever the placeholder currently
			// sits. The placeholder is kept in sync with the cursor by
			// handleDragOver, so this is the authoritative drop position -
			// we deliberately do NOT recompute from draggedIndex / targetIndex
			// because those snapshots get out of sync as the DOM mutates.
			if (placeholder && placeholder.parentNode === gridElement) {
				gridElement.insertBefore(draggedElement, placeholder);
				placeholder.parentNode.removeChild(placeholder);
			} else {
				// Fallback: no placeholder present (shouldn't normally happen).
				// Drop next to the hovered target based on the captured index.
				if (draggedElement === e.currentTarget) {
					return false;
				}
				const targetItem = e.currentTarget;
				const targetIndex = getItemIndex(targetItem);
				if (targetIndex === -1 || draggedIndex === -1) {
					return false;
				}
				if (draggedIndex < targetIndex) {
					gridElement.insertBefore(
						draggedElement,
						targetItem.nextSibling
					);
				} else {
					gridElement.insertBefore(draggedElement, targetItem);
				}
			}

			const itemElementsAfterDrop = Array.from(
				gridElement.querySelectorAll('.fotogrids-item-item')
			);
			const newOrder = itemElementsAfterDrop.map((item) =>
				item.getAttribute('data-id')
			);

			// Belt-and-braces: clear dragging classes here too. dragend
			// normally handles it, but reparenting the source node during
			// drop can suppress dragend on some browsers.
			clearDraggingState();

			if (onReorderRef.current && newOrder.length > 0) {
				onReorderRef.current(newOrder);
			}

			return false;
		};

		const itemElements = gridElement.querySelectorAll(
			'.fotogrids-item-item'
		);
		itemElements.forEach((item) => {
			item.addEventListener('dragstart', handleDragStart);
			item.addEventListener('dragend', handleDragEnd);
			item.addEventListener('dragover', handleDragOver);
			item.addEventListener('drop', handleDrop);
		});

		const handleContainerDragOver = (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = 'move';
		};

		const handleContainerDrop = (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!draggedElement) {
				return;
			}

			// If the placeholder is in the DOM, drop the dragged element where
			// the placeholder is. This is the path that fires when the user
			// releases the mouse with the cursor over the placeholder itself
			// (rather than over another .fotogrids-item-item) - without this,
			// the item-level `drop` handler never runs and the reorder is lost.
			if (placeholder && placeholder.parentNode === gridElement) {
				gridElement.insertBefore(draggedElement, placeholder);
				placeholder.parentNode.removeChild(placeholder);

				const itemElementsAfter = Array.from(
					gridElement.querySelectorAll('.fotogrids-item-item')
				);
				const newOrder = itemElementsAfter.map((item) =>
					item.getAttribute('data-id')
				);

				clearDraggingState();

				if (onReorderRef.current && newOrder.length > 0) {
					onReorderRef.current(newOrder);
				}
			}
		};

		gridElement.addEventListener('dragover', handleContainerDragOver);
		gridElement.addEventListener('drop', handleContainerDrop);

		return () => {
			itemElements.forEach((item) => {
				item.removeEventListener('dragstart', handleDragStart);
				item.removeEventListener('dragend', handleDragEnd);
				item.removeEventListener('dragover', handleDragOver);
				item.removeEventListener('drop', handleDrop);
			});
			gridElement.removeEventListener(
				'dragover',
				handleContainerDragOver
			);
			gridElement.removeEventListener('drop', handleContainerDrop);
		};
	}, [items, strings]);
};

export default useItemDragSort;
