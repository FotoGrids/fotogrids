/**
 * Recently Edited Component - Dashboard
 */
import React, { useState, useEffect } from 'react';
import Icon from '../shared/Icon';
import LoadingIcon from '../shared/LoadingIcon';
import { fetchRecentlyEdited } from '../../utils/api';

const { __ } = wp.i18n;

const ROW_LIMIT = 5;

const STATUS_LABELS = {
    draft: __('Draft', 'fotogrids'),
    private: __('Private', 'fotogrids')
};

/**
 * Short, localised day-and-month label for a GMT MySQL datetime.
 *
 * The year is added only when it differs from the current one.
 *
 * @param {string} gmt Datetime in `YYYY-MM-DD HH:MM:SS` form, GMT.
 * @return {string} Label such as "Sep 24", or an empty string when unparsable.
 */
export const formatShortDate = (gmt) => {
    const date = new Date(`${String(gmt).replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== new Date().getFullYear()) {
        options.year = 'numeric';
    }

    return date.toLocaleDateString(document.documentElement.lang || undefined, options);
};

const RecentlyEditedRow = ({ item }) => (
    <li className="fg-abc-recently-edited-row">
        <span className="fg-abc-recently-edited-type">{item.type_label}</span>
        <a className="fg-abc-recently-edited-link" href={item.edit_url}>
            <span className="fg-abc-recently-edited-title">
                {item.title || `${item.untitled_label} #${item.id}`}
            </span>
            {STATUS_LABELS[item.status] && (
                <span className="fg-abc-recently-edited-status">
                    {STATUS_LABELS[item.status]}
                </span>
            )}
        </a>
        <span className="fg-abc-recently-edited-date" title={item.modified_formatted}>
            {formatShortDate(item.modified_gmt)}
        </span>
    </li>
);

const RecentlyEdited = ({ hasAlbums = false }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetchRecentlyEdited(ROW_LIMIT).then((rows) => {
            if (active) {
                setItems(rows);
                setLoading(false);
            }
        });

        return () => {
            active = false;
        };
    }, []);

    let body;
    if (loading) {
        body = (
            <div className="fg-abc-recently-edited-loading">
                <LoadingIcon label={__('Loading recently edited galleries and albums', 'fotogrids')} />
            </div>
        );
    } else if (items.length === 0) {
        body = (
            <p className="fg-abc-recently-edited-empty">
                {__('No recently edited galleries or albums.', 'fotogrids')}
            </p>
        );
    } else {
        body = (
            <ul className="fg-abc-recently-edited-items">
                {items.map((item) => (
                    <RecentlyEditedRow key={item.id} item={item} />
                ))}
            </ul>
        );
    }

    return (
        <div className="fotogrids-admin-block-card fg-abc-recently-edited">
            <div className="fotogrids-admin-block-card-header">
                <Icon name="edit" className="fotogrids-admin-block-card-header-icon fg-header-icon-light" />
                <h3>{__('Recently Edited', 'fotogrids')}</h3>
            </div>
            {body}
            <div className="fg-abc-recently-edited-actions">
                <a className="fg-abc-recently-edited-button" href="edit.php?post_type=fotogrids_gallery">
                    {__('View all galleries', 'fotogrids')}
                </a>
                {hasAlbums && (
                    <a className="fg-abc-recently-edited-button" href="edit.php?post_type=fotogrids_album">
                        {__('View all albums', 'fotogrids')}
                    </a>
                )}
            </div>
        </div>
    );
};

export default RecentlyEdited;
