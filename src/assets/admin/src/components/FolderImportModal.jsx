/**
 * FolderImportModal
 *
 * Adds images to a gallery from a folder: either one that already sits in the
 * site's uploads directory, or one picked from the visitor's own computer.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen             Modal visibility.
 * @param {Function} props.onClose            Called when the modal should close.
 * @param {Function} props.onAddItems         Called with an array of gallery item objects.
 * @param {Function} props.onUploadComplete   Called with an array of new attachment IDs.
 * @param {Object}   [props.strings]          Localized labels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uploadMedia } from '@wordpress/media-utils';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import Icon from './shared/Icon.jsx';
import Checkbox from './shared/Checkbox';
import UploadArea from './blocks/UploadArea';

const IMPORT_CHUNK = 200;

const TAB_SERVER = 'server';
const TAB_COMPUTER = 'computer';

const EMPTY_LISTING = {
    path: '',
    parent: null,
    breadcrumbs: [],
    folders: [],
    files: [],
    total: 0,
    page: 1,
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|heic|heif|svg|ico)$/i;

const isImageFile = (file) =>
    file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name || '');

const imagesOnly = (fileList) => Array.from(fileList || []).filter(isImageFile);

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

const formatBytes = (bytes) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

const FolderImportModal = ({
    isOpen,
    onClose,
    onAddItems,
    onUploadComplete,
    galleryId,
    strings = {},
}) => {
    const [activeTab, setActiveTab] = useState(TAB_SERVER);
    const [listing, setListing] = useState(EMPTY_LISTING);
    const [path, setPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

    const [localFiles, setLocalFiles] = useState([]);
    const [localFolder, setLocalFolder] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadCounts, setUploadCounts] = useState({ done: 0, total: 0 });
    const [dragging, setDragging] = useState(false);

    const directoryInputRef = useRef(null);

    // `webkitdirectory` is not part of React's known attribute list, so it is
    // set on the DOM node directly.
    useEffect(() => {
        const input = directoryInputRef.current;
        if (!input) return;
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
    }, [activeTab, isOpen]);

    const fetchListing = useCallback(
        async (targetPath, page = 1) => {
            const query = [
                `gallery_id=${encodeURIComponent(galleryId)}`,
                `path=${encodeURIComponent(targetPath)}`,
                `page=${page}`,
            ].join('&');
            return wp.apiFetch({ path: `/fotogrids/v1/media/folders?${query}` });
        },
        [galleryId]
    );

    const loadFolder = useCallback(
        async (targetPath) => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchListing(targetPath, 1);
                setListing(data);
                setPath(data.path);
            } catch (err) {
                setError(err.message || strings.uploadFromFolderLoadFailed);
                setListing(EMPTY_LISTING);
                setPath(targetPath);
            } finally {
                setLoading(false);
            }
        },
        [fetchListing, strings.uploadFromFolderLoadFailed]
    );

    useEffect(() => {
        if (isOpen) {
            loadFolder('');
        } else {
            setSelected([]);
            setLocalFiles([]);
            setLocalFolder('');
            setError(null);
            setActiveTab(TAB_SERVER);
            setListing(EMPTY_LISTING);
            setPath('');
        }
    }, [isOpen, loadFolder]);

    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const data = await fetchListing(path, listing.page + 1);
            setListing((prev) => ({
                ...data,
                files: [...prev.files, ...data.files],
            }));
        } catch (err) {
            setError(err.message || strings.uploadFromFolderLoadFailed);
        } finally {
            setLoadingMore(false);
        }
    }, [fetchListing, path, listing.page, strings.uploadFromFolderLoadFailed]);

    const toggleFile = useCallback((filePath) => {
        setSelected((prev) =>
            prev.includes(filePath)
                ? prev.filter((item) => item !== filePath)
                : [...prev, filePath]
        );
    }, []);

    const visiblePaths = listing.files.map((file) => file.path);
    const allVisibleSelected =
        visiblePaths.length > 0 &&
        visiblePaths.every((filePath) => selected.includes(filePath));

    const toggleAllVisible = useCallback(() => {
        setSelected((prev) => {
            if (allVisibleSelected) {
                return prev.filter((filePath) => !visiblePaths.includes(filePath));
            }
            const next = new Set(prev);
            visiblePaths.forEach((filePath) => next.add(filePath));
            return Array.from(next);
        });
    }, [allVisibleSelected, visiblePaths]);

    const handleImport = useCallback(async () => {
        if (selected.length === 0) return;

        setImporting(true);
        setError(null);
        setImportProgress({ done: 0, total: selected.length });

        const collected = [];
        const skipped = [];

        try {
            for (let index = 0; index < selected.length; index += IMPORT_CHUNK) {
                const chunk = selected.slice(index, index + IMPORT_CHUNK);
                // Chunks are deliberately sequential: each one generates image
                // sizes server-side, and running them in parallel is what
                // pushes shared hosts into a memory limit.
                // eslint-disable-next-line no-await-in-loop
                const response = await wp.apiFetch({
                    path: '/fotogrids/v1/media/import/folder',
                    method: 'POST',
                    data: { gallery_id: galleryId, files: chunk },
                });
                collected.push(...(response.items || []));
                skipped.push(...(response.skipped || []));
                setImportProgress({
                    done: Math.min(index + IMPORT_CHUNK, selected.length),
                    total: selected.length,
                });
            }

            if (collected.length > 0) {
                onAddItems?.(collected);
            }

            if (skipped.length > 0 && window.fotogridsToast) {
                window.fotogridsToast.error(
                    `${skipped.length} ${strings.uploadFromFolderFilesSkipped || 'files were skipped.'}`
                );
            }

            onClose?.();
        } catch (err) {
            setError(err.message || strings.uploadFromFolderImportFailed);
        } finally {
            setImporting(false);
            setImportProgress({ done: 0, total: 0 });
        }
    }, [selected, galleryId, onAddItems, onClose, strings.uploadFromFolderFilesSkipped, strings.uploadFromFolderImportFailed]);

    const handleDirectoryPick = useCallback(
        (fileList) => {
            const picked = Array.from(fileList || []);
            const files = imagesOnly(picked);

            setLocalFolder(pickedFolderName(picked));
            setLocalFiles(files);
            setError(
                picked.length > 0 && files.length === 0
                    ? strings.uploadFromFolderNoImages || 'No images found in that folder.'
                    : null
            );
        },
        [strings.uploadFromFolderNoImages]
    );

    const handleLocalUpload = useCallback(() => {
        if (localFiles.length === 0) return;

        const uploaded = new Set();
        let failed = 0;

        const settle = () => {
            const done = uploaded.size + failed;
            setUploadCounts({ done, total: localFiles.length });

            if (done < localFiles.length) return;

            setUploading(false);
            setUploadCounts({ done: 0, total: 0 });

            if (uploaded.size > 0) {
                onUploadComplete?.(Array.from(uploaded));
            }

            onClose?.();
        };

        setError(null);
        setUploading(true);
        setUploadCounts({ done: 0, total: localFiles.length });

        Promise.resolve(
            uploadMedia({
                filesList: localFiles,
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
            setError(uploadError?.message || strings.uploadFromFolderImportFailed);
            setUploading(false);
            setUploadCounts({ done: 0, total: 0 });
        });
    }, [localFiles, onUploadComplete, onClose, strings.uploadFromFolderImportFailed]);

    const busy = importing || uploading;

    const renderBreadcrumbs = () => (
        <nav className="fg-folder-crumbs" aria-label={strings.uploadFromFolder || 'From Folder'}>
            {listing.breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.path || 'root'}>
                    {index > 0 && <Icon name="chevron_right" className="fg-folder-crumbs__sep" />}
                    <button
                        type="button"
                        className="fg-folder-crumbs__item"
                        disabled={crumb.path === listing.path || busy}
                        onClick={() => loadFolder(crumb.path)}
                    >
                        {crumb.label}
                    </button>
                </React.Fragment>
            ))}
        </nav>
    );

    const renderServerTab = () => (
        <div className="fotogrids-tab-panel fg-is-active fg-folder-browser">
            {error && <div className="fg-folder-browser__error">{error}</div>}

            {loading ? (
                <p className="fg-folder-browser__empty">{strings.loading || 'Loading…'}</p>
            ) : (
                <>
                    {listing.folders.length > 0 && (
                        <ul className="fg-folder-list">
                            {listing.parent !== null && (
                                <li>
                                    <button
                                        type="button"
                                        className="fg-folder-list__item"
                                        onClick={() => loadFolder(listing.parent)}
                                        disabled={busy}
                                    >
                                        <Icon name="folder" />
                                        <span className="fg-folder-list__name">..</span>
                                    </button>
                                </li>
                            )}
                            {listing.folders.map((folder) => (
                                <li key={folder.name}>
                                    <button
                                        type="button"
                                        className="fg-folder-list__item"
                                        onClick={() =>
                                            loadFolder(
                                                listing.path
                                                    ? `${listing.path}/${folder.name}`
                                                    : folder.name
                                            )
                                        }
                                        disabled={busy}
                                    >
                                        <Icon name="folder" />
                                        <span className="fg-folder-list__name">{folder.name}</span>
                                        {folder.count > 0 && (
                                            <span className="fg-folder-list__count">
                                                {folder.count}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {listing.files.length === 0 ? (
                        <p className="fg-folder-browser__empty">
                            {strings.uploadFromFolderEmpty || 'No images in this folder.'}
                        </p>
                    ) : (
                        <>
                            <div className="fg-folder-browser__bar">
                                <Checkbox
                                    id="fg-folder-select-all"
                                    checked={allVisibleSelected}
                                    onChange={toggleAllVisible}
                                    label={strings.uploadFromFolderSelectAll || 'Select all'}
                                    disabled={busy}
                                />
                                <span className="fg-folder-browser__count">
                                    {listing.files.length} / {listing.total}
                                </span>
                            </div>

                            <ul className="fg-folder-grid">
                                {listing.files.map((file) => {
                                    const isSelected = selected.includes(file.path);
                                    return (
                                        <li
                                            key={file.path}
                                            className={`fg-folder-tile${
                                                isSelected ? ' fg-folder-tile--selected' : ''
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="fg-folder-tile__button"
                                                onClick={() => toggleFile(file.path)}
                                                disabled={busy}
                                                aria-pressed={isSelected}
                                            >
                                                <img
                                                    src={file.thumbnail}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="fg-folder-tile__image"
                                                />
                                                {isSelected && (
                                                    <span className="fg-folder-tile__check">
                                                        <Icon name="check" />
                                                    </span>
                                                )}
                                                {!file.attachment_id && (
                                                    <span className="fg-folder-tile__badge">
                                                        {strings.uploadFromFolderNewBadge || 'New'}
                                                    </span>
                                                )}
                                            </button>
                                            <span className="fg-folder-tile__name" title={file.name}>
                                                {file.name}
                                            </span>
                                            <span className="fg-folder-tile__meta">
                                                {formatBytes(file.size)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            {listing.files.length < listing.total && (
                                <div className="fg-folder-browser__more">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={loadMore}
                                        busy={loadingMore}
                                        disabled={busy}
                                    >
                                        {strings.uploadFromFolderLoadMore || 'Load more'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );

    const uploadPercent = uploadCounts.total
        ? Math.round((uploadCounts.done / uploadCounts.total) * 100)
        : 0;

    const renderComputerTab = () => (
        <div className="fotogrids-tab-panel fg-is-active fg-folder-local">
            <UploadArea
                isDragging={dragging}
                isUploading={uploading}
                uploadProgress={uploadPercent}
                error={error}
                title={strings.uploadFromFolderSelectTitle || 'Select a folder to upload'}
                subtitle={strings.uploadFromFolderDragDrop || 'or drag and drop images here'}
                hint={
                    strings.uploadFromFolderHint ||
                    'Every image in the folder and its sub-folders is uploaded to your Media Library.'
                }
                accept="image/*"
                multiple
                onFiles={handleDirectoryPick}
                onDragChange={setDragging}
                inputRef={directoryInputRef}
                inputId="fotogrids-folder-upload-input"
            />

            {localFiles.length > 0 && !uploading && (
                <div className="fg-folder-local__summary">
                    <Icon name="image" />
                    <span>
                        {localFolder ? `${localFolder} — ` : ''}
                        {localFiles.length} {strings.uploadFromFolderImagesReady || 'images ready to upload'}
                    </span>
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: TAB_SERVER, label: strings.uploadFromFolderOnServer || 'On the server' },
        { id: TAB_COMPUTER, label: strings.uploadFromFolderOnComputer || 'From my computer' },
    ];

    const primaryLabel = () => {
        if (activeTab === TAB_COMPUTER) {
            return uploading
                ? `${strings.uploading || 'Uploading…'} ${uploadCounts.done}/${uploadCounts.total}`
                : strings.uploadFromFolderUploadAndAdd || 'Upload & Add';
        }
        if (importing) {
            return `${strings.adding || 'Adding…'} ${importProgress.done}/${importProgress.total}`;
        }
        return selected.length > 0
            ? `${strings.addToGallery || 'Add to Gallery'} (${selected.length})`
            : strings.addToGallery || 'Add to Gallery';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            preventClose={busy}
        >
            <Modal.Header>
                <Modal.HeaderTitle>
                    {strings.uploadFromFolderModalTitle || 'Add images from a folder'}
                </Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} larger />

            {activeTab === TAB_SERVER && (
                <Modal.SubHeader>{renderBreadcrumbs()}</Modal.SubHeader>
            )}

            <Modal.Body>
                <Modal.Main>
                    <Modal.TabsPanel id={TAB_SERVER} activeId={activeTab} padding={false}>
                        {renderServerTab()}
                    </Modal.TabsPanel>
                    <Modal.TabsPanel id={TAB_COMPUTER} activeId={activeTab} padding={false}>
                        {renderComputerTab()}
                    </Modal.TabsPanel>
                </Modal.Main>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    {strings.cancel || 'Cancel'}
                </Button>
                <Button
                    variant="primary"
                    onClick={activeTab === TAB_COMPUTER ? handleLocalUpload : handleImport}
                    busy={busy}
                    disabled={
                        busy ||
                        (activeTab === TAB_COMPUTER
                            ? localFiles.length === 0
                            : selected.length === 0)
                    }
                >
                    {primaryLabel()}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default FolderImportModal;
