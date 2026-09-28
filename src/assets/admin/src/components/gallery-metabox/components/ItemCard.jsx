/**
 * A single tile in the gallery items grid.
 */

import React from 'react';
import Icon from '../../shared/Icon.jsx';
import Tooltip from '../../Tooltip.jsx';
import { isEmbedItem } from '../api/embed-api';

/**
 * Renders one item tile with its featured toggle, edit and remove controls,
 * and the hidden input that carries the item id into the gallery save.
 *
 * @param {Object}   props
 * @param {Object}   props.item              The item to render.
 * @param {Object}   props.strings           Localised strings.
 * @param {(id: number) => void} props.onOpen            Opens the item editor.
 * @param {(id: number) => void} props.onToggleFeatured  Sets or clears the featured item.
 * @param {(id: number) => void} props.onRemove          Removes the item from the gallery.
 * @return {JSX.Element}
 */
const ItemCard = ({ item, strings, onOpen, onToggleFeatured, onRemove }) => {
	const itemType =
		typeof item.item_type === 'string' ? item.item_type : 'image';
	const isVideo = itemType.indexOf('video') === 0;

	return (
		<div
			className={`fotogrids-item-item${isVideo ? ' fotogrids-item-item--video' : ''}`}
			data-id={item.id}
			data-item-type={item.item_type || 'image'}
			draggable="true"
		>
			{item.thumbnail ? (
				// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- mouse shortcut; the Edit button in the tile's controls is the keyboard path.
				<img
					src={item.thumbnail}
					alt={item.alt}
					onClick={() => onOpen(item.id)}
					style={{ cursor: 'pointer' }}
				/>
			) : (
				// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mouse shortcut; the Edit button in the tile's controls is the keyboard path.
				<div
					className="fotogrids-item-thumb-placeholder"
					onClick={() => onOpen(item.id)}
					style={{ cursor: 'pointer' }}
					aria-label={item.alt || item.title}
				/>
			)}
			{isVideo && (
				<span className="fotogrids-item-video-badge" aria-hidden="true">
					<Icon name="play" />
				</span>
			)}
			{!isEmbedItem(item) && (
				<div
					className={`fotogrids-item-featured ${item.featured ? 'is-featured' : ''}`}
				>
					<Tooltip
						content={
							item.featured
								? strings.clearFeatured
								: strings.setAsFeatured
						}
						position="top"
					>
						<button
							type="button"
							className="fotogrids-item-featured-button"
							onClick={() => onToggleFeatured(item.id)}
							aria-pressed={!!item.featured}
							aria-label={
								item.featured
									? strings.clearFeatured
									: strings.setAsFeatured
							}
						>
							<Icon name="star" />
						</button>
					</Tooltip>
				</div>
			)}
			<div className="fotogrids-item-controls">
				<Tooltip content={strings.editItem} position="top">
					<button
						type="button"
						className="fotogrids-edit-item"
						onClick={() => onOpen(item.id)}
						aria-label={strings.editItem}
					>
						<Icon name="edit" />
					</button>
				</Tooltip>
				<Tooltip content={strings.removeItem} position="top">
					<button
						type="button"
						className="fotogrids-remove-item"
						onClick={() => onRemove(item.id)}
						aria-label={strings.removeItem}
					>
						<Icon name="x" />
					</button>
				</Tooltip>
			</div>
			<div className="fotogrids-item-title">
				{item.title.length > 20
					? item.title.substring(0, 20) + '...'
					: item.title}
			</div>
			<input
				type="hidden"
				name="fotogrids_gallery_items[]"
				value={item.id}
			/>
		</div>
	);
};

export default ItemCard;
