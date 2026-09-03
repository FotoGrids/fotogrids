/**
 * useLocalFolderUpload
 *
 * Takes the images out of a folder picked on the visitor's own computer and
 * uploads them to the Media Library.
 *
 * @param {Object}   options
 * @param {boolean}  options.isOpen              Clears the picked folder when this turns false.
 * @param {Function} options.onUploadComplete    Called with the new attachment IDs.
 * @param {Function} options.onFinished          Called once the batch settles.
 * @param {string}   [options.noImagesMessage]   Shown when the folder held no images.
 * @param {string}   [options.failedMessage]     Fallback when the upload carries none.
 * @return {Object} files, folderName, uploading, counts, percent, error, pickFiles, startUpload.
 */

import { useCallback, useEffect, useState } from 'react';
import { uploadMedia } from '@wordpress/media-utils';

// Browsers report an empty type for formats they have no MIME mapping for
// (HEIC and friends), so the extension is the fallback.
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|heic|heif|svg|ico)$/i;

const isImageFile = (file) =>
    file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name || '');

/**
 * Name of the folder the visitor picked, taken from the first file's path.
 *
 * @param {File[]} files
 * @return {string}
 */
const pickedFolderName = (files) => {
    const relative = files[0]?.webkitRelativePath || '';
    return relative.split('/')[0] || '';
};

const useLocalFolderUpload = ({
    isOpen,
    onUploadComplete,
    onFinished,
    noImagesMessage,
    failedMessage,
}) => {
    const [files, setFiles] = useState([]);
    const [folderName, setFolderName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [counts, setCounts] = useState({ done: 0, total: 0 });
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) return;

        setFiles([]);
        setFolderName('');
        setError(null);
        setCounts({ done: 0, total: 0 });
    }, [isOpen]);

    const pickFiles = useCallback(
        (fileList) => {
            const picked = Array.from(fileList || []);
            const images = picked.filter(isImageFile);

            setFolderName(pickedFolderName(picked));
            setFiles(images);
            // An empty pick is otherwise indistinguishable from the picker
            // never having opened.
            setError(picked.length > 0 && images.length === 0 ? noImagesMessage : null);
        },
        [noImagesMessage]
    );

    const startUpload = useCallback(() => {
        if (files.length === 0) return;

        const uploaded = new Set();
        let failed = 0;

        const settle = () => {
            const done = uploaded.size + failed;
            setCounts({ done, total: files.length });

            if (done < files.length) return;

            setUploading(false);
            setCounts({ done: 0, total: 0 });

            if (uploaded.size > 0) {
                onUploadComplete?.(Array.from(uploaded));
            }

            onFinished?.();
        };

        setError(null);
        setUploading(true);
        setCounts({ done: 0, total: files.length });

        // uploadMedia() validates before either callback can fire, so a
        // rejection there would otherwise leave the caller busy forever.
        Promise.resolve(
            uploadMedia({
                filesList: files,
                allowedTypes: ['image'],
                onFileChange: (attachments) => {
                    (attachments || []).forEach((attachment) => {
                        if (attachment?.id) uploaded.add(attachment.id);
                    });
                    settle();
                },
                onError: (uploadError) => {
                    setError(uploadError.message);
                    failed += 1;
                    settle();
                },
            })
        ).catch((uploadError) => {
            setError(uploadError?.message || failedMessage);
            setUploading(false);
            setCounts({ done: 0, total: 0 });
        });
    }, [files, onUploadComplete, onFinished, failedMessage]);

    const percent = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

    return {
        files,
        folderName,
        uploading,
        counts,
        percent,
        error,
        pickFiles,
        startUpload,
    };
};

export default useLocalFolderUpload;
