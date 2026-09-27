/**
 * The sortable grid of gallery items.
 */

import React from 'react';
import ItemCard from './ItemCard.jsx';

/**
 * Renders the items grid. The element id is what useItemDragSort binds to.
 *
 * @param {Object}   props
 * @param {Array}    props.items             Items in grid order.
 * @param {Object}   props.strings           Localised strings.
 * @param {Function} props.onOpenItem        Opens the item editor.
 * @param {Function} props.onToggleFeatured  Sets or clears the featured item.
 * @param {Function} props.onRemoveItem      Removes an item from the gallery.
 * @return {JSX.Element}
 */
const ItemsGrid = ({ items, strings, onOpenItem, onToggleFeatured, onRemoveItem }) => (
    <div id="fotogrids-items-grid" className="fotogrids-sortable">
        {items.map((item) => (
            <ItemCard
                key={item.id}
                item={item}
                strings={strings}
                onOpen={onOpenItem}
                onToggleFeatured={onToggleFeatured}
                onRemove={onRemoveItem}
            />
        ))}
    </div>
);

export default ItemsGrid;
