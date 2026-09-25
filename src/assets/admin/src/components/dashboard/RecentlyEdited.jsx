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

const RecentlyEditedRow = ({ item }) => (
    <li className="fg-abc-recently-edited-row">
        <a className="fg-abc-recently-edited-link" href={item.edit_url}>
            <span className="fg-abc-recently-edited-type">{item.type_label}</span>
            <span className="fg-abc-recently-edited-title">
                {item.title || `${item.untitled_label} #${item.id}`}
            </span>
            {STATUS_LABELS[item.status] && (
                <span className="fg-abc-recently-edited-status">
                    {STATUS_LABELS[item.status]}
                </span>
            )}
        </a>
        <span className="fg-abc-recently-edited-date">{item.modified_formatted}</span>
    </li>
);

const RecentlyEdited = () => {
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
            <a className="fg-abc-recently-edited-all" href="edit.php?post_type=fotogrids_gallery">
                {__('View all galleries', 'fotogrids')}
            </a>
        </div>
    );
};

export default RecentlyEdited;
