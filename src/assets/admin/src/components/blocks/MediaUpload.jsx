/**
 * MediaUpload - uploads image files to the WordPress Media Library.
 *
 * Renders through the UploadArea visual template and owns the upload logic.
 * Files go to the REST endpoint through `uploadMedia()`, which validates mime
 * type and file size against the site's limits, translates its own errors, and
 * uploads the batch concurrently.
 *
 * onUploadComplete() is called once with every attachment ID that landed, after
 * the batch settles - including when part of it failed.
 *
 * @param {Function} props.onUploadComplete  Called with array of WP attachment IDs.
 * @param {string}   [props.inputId]         HTML id for the hidden file input.
 */
import React, { useCallback, useRef, useState } from 'react';
import { uploadMedia } from '@wordpress/media-utils';
import UploadArea from './UploadArea';

const { __ } = wp.i18n;

const ALLOWED_TYPES = ['image'];

const imagesOnly = (fileList) =>
    Array.from(fileList).filter((file) => file.type.startsWith('image/'));

const collectIds = (attachments) =>
    (attachments || []).map((attachment) => attachment?.id).filter(Boolean);

const MediaUpload = ({
    onUploadComplete,
    inputId = 'fotogrids-upload-input',
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [counts, setCounts] = useState({ done: 0, total: 0 });

    const inputRef = useRef(null);

    const handleFiles = useCallback(
        (fileList) => {
            const files = imagesOnly(fileList);
            if (files.length === 0) {
                return;
            }

            // uploadMedia() reports successes and failures separately and never
            // signals completion, so both are counted until every file settles.
            const uploaded = new Set();
            let failed = 0;

            const settle = () => {
                const done = uploaded.size + failed;
                setCounts({ done, total: files.length });

                if (done < files.length) {
                    return;
                }

                setIsUploading(false);
                setCounts({ done: 0, total: 0 });

                if (uploaded.size > 0) {
                    onUploadComplete?.(Array.from(uploaded));
                }
            };

            setError(null);
            setIsUploading(true);
            setCounts({ done: 0, total: files.length });

            uploadMedia({
                filesList: files,
                allowedTypes: ALLOWED_TYPES,
                onFileChange: (attachments) => {
                    collectIds(attachments).forEach((id) => uploaded.add(id));
                    settle();
                },
                onError: (uploadError) => {
                    setError(uploadError.message);
                    failed += 1;
                    settle();
                },
            });
        },
        [onUploadComplete]
    );

    return (
        <UploadArea
            isDragging={isDragging}
            isUploading={isUploading}
            uploadProgress={
                counts.total
                    ? Math.round((counts.done / counts.total) * 100)
                    : 0
            }
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
