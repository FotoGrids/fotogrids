/**
 * PickerCard - single card inside the picker modal.
 *
 * Renders thumbnail, title, item count, last-modified date, and (for Pro
 * items) a "Pro" badge with a tooltip explaining whether the current user
 * can select it.
 */

import React from 'react';
import { Tooltip } from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';

import { Button } from '@/admin/src/components/shared/Button';
import Icon from '@/admin/src/components/shared/Icon';
import { isItemSelectable, shouldShowProBadge, shouldShowProLock } from '../lib/pro-guard';

const formatRelative = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const formatter = new Intl.DateTimeFormat(
        document.documentElement.lang || undefined,
        { year: 'numeric', month: 'short', day: 'numeric' }
    );
    return formatter.format(date);
};

const PickerCard = ({
    item,
    kind,
    licenseState,
    highlighted,
    selected,
    onFocus,
    onSelect,
}) => {
    const selectable = isItemSelectable(item, licenseState);
    const showBadge = shouldShowProBadge(item);
    const showLock = shouldShowProLock(item, licenseState);
    const isEmpty = !item.item_count;

    const className = [
        'fg-pb-picker-card',
        highlighted && 'is-highlighted',
        selected && 'is-selected',
        !selectable && 'is-disabled',
        showBadge && 'has-pro-badge',
        isEmpty && 'is-empty',
    ].filter(Boolean).join(' ');

    const titleId = `fg-pb-pc-title-${item.id}`;

    // Already-selected cards must not re-trigger selection — clicking the
    // overlay is a no-op once `selected` is true.
    const onClick = () => {
        if (!selectable || selected) {
            return;
        }
        onSelect();
    };

    // Modified date appears when present; if `created_at` matches it (within
    // a few seconds — the post is fresh and was never re-saved) we show
    // "Created at:" instead.
    const dateLabel = (() => {
        if (!item.updated_at) return null;
        if (item.created_at) {
            const created = new Date(item.created_at).getTime();
            const updated = new Date(item.updated_at).getTime();
            if (!Number.isNaN(created) && !Number.isNaN(updated)
                && Math.abs(updated - created) < 5000) {
                return __('Created at:', 'fotogrids');
            }
        }
        return __('Last modified:', 'fotogrids');
    })();

    const cardInner = (
        <article
            className={className}
            role="button"
            tabIndex={selectable ? 0 : -1}
            aria-disabled={!selectable}
            aria-labelledby={titleId}
            onClick={onClick}
            onFocus={onFocus}
            onMouseEnter={onFocus}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="fg-pb-picker-card__thumb">
                {item.featured_thumb ? (
                    <img
                        src={item.featured_thumb}
                        alt=""
                        loading="lazy"
                    />
                ) : (
                    <div className="fg-pb-picker-card__thumb-placeholder" aria-hidden="true">
                        {isEmpty ? (
                            <Icon name="image_x" />
                        ) : (
                            <span>FG</span>
                        )}
                    </div>
                )}
                {showBadge && (
                    <span className="fg-pb-picker-card__badge" aria-label={__('Requires FotoGrids Pro', 'fotogrids')}>
                        {__('Pro', 'fotogrids')}
                    </span>
                )}
                {item.status && item.status !== 'publish' && (
                    <div className="fg-pb-picker-card__status">
                        {item.status === 'draft'
                            ? __('Draft', 'fotogrids')
                            : item.status === 'private'
                                ? __('Private', 'fotogrids')
                                : item.status
                        }
                    </div>
                )}
            </div>
            <div className="fg-pb-picker-card__body">
                <h3 id={titleId} className="fg-pb-picker-card__title">
                    {item.title || __('(no title)', 'fotogrids')}
                </h3>
                <div className="fg-pb-picker-card__meta">
                    <span className="fg-pb-picker-card__count">
                        {kind === 'album'
                            ? sprintf(
                                /* translators: %d: gallery count */
                                _n('%d gallery', '%d galleries', item.item_count, 'fotogrids'),
                                item.item_count
                            )
                            : sprintf(
                                /* translators: %d: item count */
                                _n('%d item', '%d items', item.item_count, 'fotogrids'),
                                item.item_count
                            )
                        }
                    </span>
                    {item.updated_at && (
                        <span className="fg-pb-picker-card__date">
                            <span className="fg-pb-picker-card__date-label">
                                {dateLabel}
                            </span>
                            {' '}
                            {formatRelative(item.updated_at)}
                        </span>
                    )}
                </div>
            </div>
            {selectable && (
                <div className="fg-pb-picker-card__action">
                    <Button
                        variant={selected ? 'success' : 'primary'}
                        icon={selected ? 'check' : undefined}
                        disabled={selected}
                        tabIndex={-1}
                    >
                        {selected
                            ? __('Selected', 'fotogrids')
                            : __('Select', 'fotogrids')
                        }
                    </Button>
                </div>
            )}
        </article>
    );

    if (showLock) {
        return (
            <Tooltip text={__('This gallery uses features that require FotoGrids Pro.', 'fotogrids')}>
                {cardInner}
            </Tooltip>
        );
    }

    return cardInner;
};

export default PickerCard;
