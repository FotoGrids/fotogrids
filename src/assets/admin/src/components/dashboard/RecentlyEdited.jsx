/**
 * Recently Edited Component - Dashboard
 */
import React, { useState, useEffect } from 'react';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';
import LoadingIcon from '../shared/LoadingIcon';
import { fetchRecentlyEdited } from '../../utils/api';

const { __ } = wp.i18n;

const ROW_LIMIT = 5;

const STATUS_LABELS = {
    draft: __('Draft', 'fotogrids'),
    private: __('Private', 'fotogrids')
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const adminLocale = () => document.documentElement.lang || undefined;

/**
 * Short, localised label for when a row was last edited.
 *
 * Edits within the last 24 hours read as relative time ("5 minutes ago",
 * "3 hours ago"); older ones as day and month, with the year only when it
 * differs from the current one.
 *
 * @param {string} gmt Datetime in `YYYY-MM-DD HH:MM:SS` form, GMT.
 * @param {Date}   now Reference time. Defaults to the current time.
 * @return {string} The label, or an empty string when the value is unparsable.
 */
export const formatEditedDate = (gmt, now = new Date()) => {
    const date = new Date(`${String(gmt).replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const elapsed = now.getTime() - date.getTime();
    if (elapsed < DAY_MS) {
        const relative = new Intl.RelativeTimeFormat(adminLocale(), { numeric: 'always' });
        if (elapsed < HOUR_MS) {
            return relative.format(-Math.max(1, Math.floor(elapsed / MINUTE_MS)), 'minute');
        }
        return relative.format(-Math.floor(elapsed / HOUR_MS), 'hour');
    }

    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) {
        options.year = 'numeric';
    }

    return date.toLocaleDateString(adminLocale(), options);
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
            {formatEditedDate(item.modified_gmt)}
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
                <Button
                    href="edit.php?post_type=fotogrids_gallery"
                    variant="primary"
                    style="outline"
                    size="sm"
                    className="fg-button--invert"
                >
                    {__('View all galleries', 'fotogrids')}
                </Button>
                {hasAlbums && (
                    <Button
                        href="edit.php?post_type=fotogrids_album"
                        variant="primary"
                        style="outline"
                        size="sm"
                        className="fg-button--invert"
                    >
                        {__('View all albums', 'fotogrids')}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default RecentlyEdited;
