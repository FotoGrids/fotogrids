/**
 * ZipImportModal
 *
 * Uploads a ZIP archive, extracts the images inside it into the Media Library,
 * and adds them to the gallery.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen       Modal visibility.
 * @param {Function} props.onClose      Called when the modal should close.
 * @param {Function} props.onAddItems   Called with an array of gallery item objects.
 * @param {Object}   [props.strings]    Localized labels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import Icon from './shared/Icon.jsx';
import UploadArea from './blocks/UploadArea';
import { formatFileSize } from '../utils/format-file-size';

const isZip = (file) =>
    Boolean(file) && /\.zip$/i.test(file.name || '');

/**
 * POST the archive with XMLHttpRequest so the upload can report progress.
 * apiFetch has no progress channel, and archives are large enough that a
 * static spinner reads as a hang.
 *
 * @param {File}     file
 * @param {number}   galleryId  The gallery the import belongs to.
 * @param {Function} onProgress Called with a 0-100 percentage.
 * @return {Promise<Object>}
 */
const uploadArchive = (file, galleryId, onProgress) =>
    new Promise((resolve, reject) => {
        const root = window.wpApiSettings?.root || '/wp-json/';
        const nonce = window.wpApiSettings?.nonce || '';
        const body = new FormData();
        body.append('file', file, file.name);
        body.append('gallery_id', galleryId);

        const request = new XMLHttpRequest();
        request.open('POST', `${root}fotogrids/v1/media/import/zip`);
        request.setRequestHeader('X-WP-Nonce', nonce);

        request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        });

        request.addEventListener('load', () => {
            let payload = {};
            try {
                payload = JSON.parse(request.responseText);
            } catch (err) {
                reject(new Error(request.statusText));
                return;
            }

            if (request.status >= 200 && request.status < 300) {
                resolve(payload);
            } else {
                reject(new Error(payload.message || request.statusText));
            }
        });

        request.addEventListener('error', () => reject(new Error(request.statusText)));

        request.send(body);
    });

const ZipImportModal = ({ isOpen, onClose, onAddItems, galleryId, strings = {} }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setError(null);
            setResult(null);
            setProgress(0);
            setBusy(false);
            setExtracting(false);
        }
    }, [isOpen]);

    const acceptFile = useCallback(
        (candidate) => {
            if (!isZip(candidate)) {
                setError(strings.uploadFromZipInvalid);
                return;
            }
            setError(null);
            setResult(null);
            setFile(candidate);
        },
        [strings.uploadFromZipInvalid]
    );

    const handleUpload = useCallback(async () => {
        if (!file) return;

        setBusy(true);
        setError(null);
        setProgress(0);

        try {
            const response = await uploadArchive(file, galleryId, (percent) => {
                setProgress(percent);
                if (percent >= 100) {
                    setExtracting(true);
                }
            });

            const items = response.items || [];
            const skipped = response.skipped || [];

            if (items.length > 0) {
                onAddItems?.(items);
            }

            if (skipped.length === 0) {
                onClose?.();
                return;
            }

            setResult({ added: items.length, skipped });
        } catch (err) {
            setError(err.message || strings.uploadFromZipFailed);
        } finally {
            setBusy(false);
            setExtracting(false);
        }
    }, [file, galleryId, onAddItems, onClose, strings.uploadFromZipFailed]);

    const handleFiles = useCallback(
        (fileList) => {
            acceptFile(Array.from(fileList || [])[0]);
        },
        [acceptFile]
    );

    const renderDropZone = () => (
        <UploadArea
            isDragging={dragging}
            isUploading={busy}
            uploadProgress={progress}
            error={error}
            title={strings.uploadFromZipChoose}
            subtitle={strings.uploadFromZipDragDrop}
            hint={strings.uploadFromZipMaxSize}
            accept=".zip,application/zip"
            multiple={false}
            onFiles={handleFiles}
            onDragChange={setDragging}
            inputRef={inputRef}
            inputId="fotogrids-zip-upload-input"
        />
    );

    const renderResult = () => (
        <div className="fg-upload-zip-result">
            <p className="fg-upload-zip-result__headline">
                <Icon name="check_circle" />
                {result.added} {strings.uploadFromZipImagesAdded}
            </p>
            <p className="fg-upload-zip-result__subhead">
                {result.skipped.length} {strings.uploadFromZipEntriesSkipped}
            </p>
            <ul className="fg-upload-zip-result__list">
                {result.skipped.slice(0, 50).map((entry, index) => (
                    <li key={`${entry.path}-${index}`}>
                        <span className="fg-upload-zip-result__name">{entry.path}</span>
                        <span className="fg-upload-zip-result__reason">{entry.reason}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            preventClose={busy}
        >
            <Modal.Header>
                <Modal.HeaderTitle>
                    {strings.uploadFromZipModalTitle}
                </Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Body>
                {result ? (
                    renderResult()
                ) : (
                    <>
                        {renderDropZone()}

                        {file && !busy && (
                            <div className="fg-upload-zip-file">
                                <Icon name="file_attachment" />
                                <span className="fg-upload-zip-file__name">{file.name}</span>
                                <span className="fg-upload-zip-file__size">{formatFileSize(file.size)}</span>
                            </div>
                        )}

                        {extracting && (
                            <p className="fg-upload-zip-status">
                                {strings.uploadFromZipExtracting}
                            </p>
                        )}
                    </>
                )}
            </Modal.Body>

            <Modal.Footer>
                {result ? (
                    <Button variant="primary" onClick={onClose}>
                        {strings.done}
                    </Button>
                ) : (
                    <>
                        <Button variant="secondary" onClick={onClose} disabled={busy}>
                            {strings.cancel}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleUpload}
                            busy={busy}
                            disabled={!file || busy}
                        >
                            {strings.uploadFromZipUploadAndAdd}
                        </Button>
                    </>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default ZipImportModal;
