/**
 * Create Options Component
 */
import React from 'react';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

const CreateOptions = () => {
    return (
        <div className="fotogrids-admin-block-card fg-abc-create-options">
            <div className="fotogrids-admin-block-card-header">
                <Icon name="plus_square" className="fotogrids-admin-block-card-header-icon" />
                <h3>{__('Create', 'fotogrids')}</h3>
                <p>{__('Create a new gallery, browse pre-defined templates and adjust settings to your own likes and needs.', 'fotogrids')}</p>
            </div>
            <div className="create-grid">
                <a href="post-new.php?post_type=fotogrids_gallery" className="create-option">
                    <Icon name="layout_3x3" className="fotogrids-admin-block-card-icon" />
                    <span>{__('New Gallery', 'fotogrids')}</span>
                </a>
                <a href="post-new.php?post_type=fotogrids_album" className="create-option">
                    <Icon name="layout_2x2" className="fotogrids-admin-block-card-icon" />
                    <span>{__('New Album', 'fotogrids')}</span>
                </a>
                <a href="admin.php?page=fotogrids-templates" className="create-option">
                    <Icon name="templates" className="fotogrids-admin-block-card-icon" />
                    <span>{__('Browse Templates', 'fotogrids')}</span>
                </a>
                <a href="admin.php?page=fotogrids-settings" className="create-option">
                    <Icon name="settings" className="fotogrids-admin-block-card-icon" />
                    <span>{__('Finetune Settings', 'fotogrids')}</span>
                </a>
            </div>
        </div>
    );
};

export default CreateOptions;

