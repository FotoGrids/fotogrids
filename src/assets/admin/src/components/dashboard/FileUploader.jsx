/**
 * File Uploader Component
 * Handles file uploads, drag and drop, and media library selection
 */
import React from 'react';
import UploadArea from '../blocks/UploadArea';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

const FileUploader = ({ onUploadComplete }) => {
    const openMediaLibrary = () => {
        if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
            alert(__('WordPress media library is not available. Please refresh the page.', 'fotogrids'));
            return;
        }

        const mediaUploader = wp.media({
            title: __('Select Images for Gallery', 'fotogrids'),
            button: {
                text: __('Create Gallery', 'fotogrids')
            },
            multiple: true,
            library: {
                type: 'image'
            }
        });

        mediaUploader.on('select', () => {
            const attachments = mediaUploader.state().get('selection').toJSON();
            const attachmentIds = attachments.map(att => att.id);

            if (attachmentIds.length > 0 && onUploadComplete) {
                onUploadComplete(attachmentIds).catch(error => {
                    console.error('Error creating gallery from library:', error);
                    alert(error.message || __('Failed to create gallery.', 'fotogrids'));
                });
            }
        });

        mediaUploader.open();
    };

    return (
        <div className="fotogrids-admin-block-card fg-abc-uploader">
            <div className="fotogrids-admin-block-card-header">
                <Icon name="upload" className="fotogrids-admin-block-card-header-icon" />
                <h3>{__('Quick Upload', 'fotogrids')}</h3>
                <p>{__('Click or drag files here to create a gallery automatically.', 'fotogrids')}</p>
            </div>
            <div className="fotogrids-admin-block-card-content">
                <UploadArea
                    onUploadComplete={onUploadComplete}
                    inputId="fotogrids-dashboard-upload-input"
                    title={__('Select files to upload', 'fotogrids')}
                    subtitle={__('or drag and drop files here', 'fotogrids')}        
                />
                <p className="fotogrids-upload-or">
                    {__('or ', 'fotogrids')}
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            openMediaLibrary();
                        }}
                        className="fotogrids-upload-or__link"
                    >
                        {__('choose existing files', 'fotogrids')}
                    </a>
                    {__(' from media library', 'fotogrids')}
                </p>
            </div>
        </div>
    );
};

export default FileUploader;
