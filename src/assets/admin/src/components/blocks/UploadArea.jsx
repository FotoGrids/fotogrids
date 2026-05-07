/**
 * Upload Area Component
 * Drag-and-drop zone and file input for image uploads.
 * Handles upload to WordPress media library and calls onUploadComplete with attachment IDs.
 */
import React, { useState, useRef } from 'react';

const { __ } = wp.i18n;

const UploadArea = ({ onUploadComplete, inputId = 'fotogrids-upload-input' }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const inputRef = useRef(null);

    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadError(null);
        setUploadProgress(0);

        try {
            if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
                throw new Error(__('WordPress media library is not available. Please refresh the page.', 'fotogrids'));
            }

            const uploadedIds = [];
            const totalFiles = files.length;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                const formData = new FormData();
                formData.append('file', file);

                try {
                    const uploadResponse = await wp.apiFetch({
                        path: '/wp/v2/media',
                        method: 'POST',
                        body: formData,
                        headers: {
                            'Content-Disposition': `attachment; filename="${file.name}"`
                        }
                    });

                    if (uploadResponse && uploadResponse.id) {
                        uploadedIds.push(uploadResponse.id);
                    }
                } catch (uploadErr) {
                    console.error('Upload error for file:', file.name, uploadErr);
                    const ajaxFormData = new FormData();
                    ajaxFormData.append('file', file);
                    ajaxFormData.append('action', 'upload-attachment');
                    ajaxFormData.append('_wpnonce', wp.media?.view?.settings?.nonce || window.fotogridsAdmin?.restNonce || '');

                    const response = await fetch(window.ajaxurl || '/wp-admin/admin-ajax.php', {
                        method: 'POST',
                        body: ajaxFormData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data && data.data.id) {
                            uploadedIds.push(data.data.id);
                        }
                    } else {
                        console.warn(__('Failed to upload file: ', 'fotogrids') + file.name);
                    }
                }

                setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
            }

            if (uploadedIds.length > 0 && onUploadComplete) {
                await onUploadComplete(uploadedIds);
            }

            setUploadProgress(100);
            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadError(error.message || __('An error occurred during upload.', 'fotogrids'));
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleClick = () => {
        if (inputRef.current && !uploading) {
            inputRef.current.click();
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
            handleFileUpload(files);
        }
    };

    return (
        <div className="fotogrids-upload-area-wrapper">
            <div
                className={`fotogrids-upload-area ${isDragging ? 'fotogrids-upload-area--dragging' : ''} ${uploading ? 'fotogrids-upload-area--uploading' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                }}
                onDrop={handleDrop}
                onClick={handleClick}
                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
            >
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                            handleFileUpload(files);
                        }
                        e.target.value = '';
                    }}
                />
                {uploading ? (
                    <div className="fotogrids-upload-area__progress">
                        <div className="fotogrids-upload-area__progress-bar">
                            <div
                                className="fotogrids-upload-area__progress-fill"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p>{__('Uploading...', 'fotogrids')} {uploadProgress}%</p>
                    </div>
                ) : (
                    <>
                        <div className="fotogrids-upload-area__icon">
                            <div
                                className="fotogrids-upload-area__icon-folder"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.folder }}
                            />
                            <div
                                className="fotogrids-upload-area__icon-plus"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.plus }}
                            />
                        </div>
                        <h4>{__('Select files to upload', 'fotogrids')}</h4>
                        <p>{__('or drag and drop files here', 'fotogrids')}</p>
                    </>
                )}
            </div>
            {uploadError && (
                <div className="fotogrids-upload-area__error notice notice-error">
                    <p>{uploadError}</p>
                </div>
            )}
        </div>
    );
};

export default UploadArea;
