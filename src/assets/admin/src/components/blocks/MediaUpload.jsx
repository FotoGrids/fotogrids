/**
 * MediaUpload - uploads image files to the WordPress Media Library.
 *
 * Drop-in replacement for the original UploadArea component: same external
 * props, same behaviour. Renders via the UploadArea visual template; owns all
 * WP media upload logic internally.
 *
 * Accepts multiple image files, uploads them sequentially to /wp/v2/media
 * (with admin-ajax.php fallback), tracks per-file progress, and calls
 * onUploadComplete(attachmentIds[]) when all uploads are done.
 *
 * @param {Function} props.onUploadComplete  Called with array of WP attachment IDs.
 * @param {string}   [props.inputId]         HTML id for the hidden file input.
 */
import React, { useState, useRef } from 'react';
import UploadArea from './UploadArea';

const { __ } = wp.i18n;

const MediaUpload = ({
    onUploadComplete,
    inputId = 'fotogrids-upload-input',
}) => {
    const [isDragging, setIsDragging]         = useState(false);
    const [isUploading, setIsUploading]       = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError]                   = useState(null);
    const inputRef = useRef(null);

    const handleFiles = async (fileList) => {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        try {
            if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
                throw new Error(__('WordPress media library is not available. Please refresh the page.', 'fotogrids'));
            }

            const uploadedIds = [];
            const total = files.length;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const res = await wp.apiFetch({
                        path: '/wp/v2/media',
                        method: 'POST',
                        body: formData,
                        headers: {
                            'Content-Disposition': `attachment; filename="${file.name}"`,
                        },
                    });
                    if (res?.id) uploadedIds.push(res.id);
                } catch (uploadErr) {
                    console.error('REST upload failed for:', file.name, uploadErr);
                    // Fallback: admin-ajax.php
                    const ajaxData = new FormData();
                    ajaxData.append('file', file);
                    ajaxData.append('action', 'upload-attachment');
                    ajaxData.append('_wpnonce', wp.media?.view?.settings?.nonce || window.fotogridsAdmin?.restNonce || '');

                    const fallback = await fetch(window.ajaxurl || '/wp-admin/admin-ajax.php', {
                        method: 'POST',
                        body: ajaxData,
                    });
                    if (fallback.ok) {
                        const data = await fallback.json();
                        if (data.success && data.data?.id) uploadedIds.push(data.data.id);
                    } else {
                        console.warn(__('Failed to upload file: ', 'fotogrids') + file.name);
                    }
                }

                setUploadProgress(Math.round(((i + 1) / total) * 100));
            }

            if (uploadedIds.length > 0 && onUploadComplete) {
                await onUploadComplete(uploadedIds);
            }

            setUploadProgress(100);
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 500);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || __('An error occurred during upload.', 'fotogrids'));
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <UploadArea
            isDragging={isDragging}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            error={error}
            title={__('Select files to upload', 'fotogrids')}
            subtitle={__('or drag and drop files here', 'fotogrids')}
            accept="image/*"
            multiple={true}
            onFiles={handleFiles}
            onDragChange={setIsDragging}
            inputRef={inputRef}
            inputId={inputId}
        />
    );
};

export default MediaUpload;
