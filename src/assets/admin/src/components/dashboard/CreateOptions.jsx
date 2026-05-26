/**
 * Create Options Component
 */
import React from 'react';

const { __ } = wp.i18n;

const CreateOptions = () => {
    return (
        <div className="fotogrids-admin-block-card fg-abc-create-options">
            <div className="fotogrids-admin-block-card-header">
                <div
                    className="fotogrids-admin-block-card-header-icon"
                    dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.plus_square }}
                />
                <h3>{__('Create', 'fotogrids')}</h3>
                <p>{__('Create a new gallery, browse pre-defined templates and adjust settings to your own likes and needs.', 'fotogrids')}</p>
            </div>
            <div className="create-grid">
                <a href="post-new.php?post_type=fotogrids_gallery" className="create-option">
                    <div
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.layout_3x3 }}
                    />
                    <span>{__('New Gallery', 'fotogrids')}</span>
                </a>
                <a href="post-new.php?post_type=fotogrids_album" className="create-option">
                    <div
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.layout_2x2 }}
                    />
                    <span>{__('New Album', 'fotogrids')}</span>
                </a>
                <a href="admin.php?page=fotogrids-templates" className="create-option">
                    <div
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.templates }}
                    />
                    <span>{__('Browse Templates', 'fotogrids')}</span>
                </a>
                <a href="admin.php?page=fotogrids-settings" className="create-option">
                    <div
                        className="fotogrids-admin-block-card-icon"
                        dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.settings }}
                    />
                    <span>{__('Finetune Settings', 'fotogrids')}</span>
                </a>
            </div>
        </div>
    );
};

export default CreateOptions;

