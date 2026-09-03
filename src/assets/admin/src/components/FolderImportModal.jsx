/**
 * FolderImportModal
 *
 * Adds images to a gallery from a folder: either one that already sits in the
 * site's uploads directory, or one picked from the visitor's own computer.
 *
 * Browsing and local uploading each live in their own hook; this component owns
 * the selection, the import request, and the footer that drives both tabs.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen             Modal visibility.
 * @param {Function} props.onClose            Called when the modal should close.
 * @param {Function} props.onAddItems         Called with an array of gallery item objects.
 * @param {Function} props.onUploadComplete   Called with an array of new attachment IDs.
 * @param {number}   props.galleryId          Gallery the import is for.
 * @param {Object}   [props.strings]          Localized labels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import Icon from './shared/Icon.jsx';
import Checkbox from './shared/Checkbox';
import UploadArea from './blocks/UploadArea';
import FolderBreadcrumbs from './folder-import/FolderBreadcrumbs.jsx';
import FolderList from './folder-import/FolderList.jsx';
import FolderTileGrid from './folder-import/FolderTileGrid.jsx';
import useUploadsFolderBrowser from './folder-import/useUploadsFolderBrowser';
import useLocalFolderUpload from './folder-import/useLocalFolderUpload';

const IMPORT_CHUNK = 200;

const TAB_SERVER = 'server';
const TAB_COMPUTER = 'computer';

const FolderImportModal = ({
    isOpen,
    onClose,
    onAddItems,
    onUploadComplete,
    galleryId,
    strings = {},
}) => {
    const [activeTab, setActiveTab] = useState(TAB_SERVER);
    const [selected, setSelected] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState(null);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
    const [dragging, setDragging] = useState(false);

    const directoryInputRef = useRef(null);

    const browser = useUploadsFolderBrowser({
        galleryId,
        isOpen,
        loadFailedMessage: strings.uploadFromFolderLoadFailed,
    });

    const localUpload = useLocalFolderUpload({
        isOpen,
        onUploadComplete,
        onFinished: onClose,
        noImagesMessage: strings.uploadFromFolderNoImages,
        failedMessage: strings.uploadFromFolderImportFailed,
    });

    const { listing } = browser;

    // `webkitdirectory` is not part of React's known attribute list, so it is
    // set on the DOM node directly.
    useEffect(() => {
        const input = directoryInputRef.current;
        if (!input) return;
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
    }, [activeTab, isOpen]);

    useEffect(() => {
        if (isOpen) return;

        setSelected([]);
        setImportError(null);
        setActiveTab(TAB_SERVER);
    }, [isOpen]);

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
        setImportError(null);
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
                    `${skipped.length} ${strings.uploadFromFolderFilesSkipped}`
                );
            }

            onClose?.();
        } catch (err) {
            setImportError(err.message || strings.uploadFromFolderImportFailed);
        } finally {
            setImporting(false);
            setImportProgress({ done: 0, total: 0 });
        }
    }, [
        selected,
        galleryId,
        onAddItems,
        onClose,
        strings.uploadFromFolderFilesSkipped,
        strings.uploadFromFolderImportFailed,
    ]);

    const busy = importing || localUpload.uploading;
    const serverError = importError || browser.error;

    const renderServerTab = () => (
        <div className="fotogrids-tab-panel fg-is-active fg-upload-folder-browser">
            {serverError && (
                <div className="fg-upload-folder-browser__error">{serverError}</div>
            )}

            {browser.loading ? (
                <p className="fg-upload-folder-browser__empty">{strings.loading}</p>
            ) : (
                <>
                    <FolderList
                        folders={listing.folders}
                        parent={listing.parent}
                        currentPath={listing.path}
                        disabled={busy}
                        onNavigate={browser.loadFolder}
                    />

                    {listing.files.length === 0 ? (
                        <p className="fg-upload-folder-browser__empty">
                            {strings.uploadFromFolderEmpty}
                        </p>
                    ) : (
                        <>
                            <div className="fg-upload-folder-browser__bar">
                                <Checkbox
                                    id="fg-upload-folder-select-all"
                                    checked={allVisibleSelected}
                                    onChange={toggleAllVisible}
                                    label={strings.uploadFromFolderSelectAll}
                                    disabled={busy}
                                />
                                <span className="fg-upload-folder-browser__count">
                                    {listing.files.length} / {listing.total}
                                </span>
                            </div>

                            <FolderTileGrid
                                files={listing.files}
                                selected={selected}
                                disabled={busy}
                                onToggle={toggleFile}
                                newBadgeLabel={strings.uploadFromFolderNewBadge}
                            />

                            {listing.files.length < listing.total && (
                                <div className="fg-upload-folder-browser__more">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={browser.loadMore}
                                        busy={browser.loadingMore}
                                        disabled={busy}
                                    >
                                        {strings.uploadFromFolderLoadMore}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );

    const renderComputerTab = () => (
        <div className="fotogrids-tab-panel fg-is-active fg-upload-folder-local">
            <UploadArea
                isDragging={dragging}
                isUploading={localUpload.uploading}
                uploadProgress={localUpload.percent}
                error={localUpload.error}
                title={strings.uploadFromFolderSelectTitle}
                subtitle={strings.uploadFromFolderDragDrop}
                hint={strings.uploadFromFolderHint}
                accept="image/*"
                multiple
                onFiles={localUpload.pickFiles}
                onDragChange={setDragging}
                inputRef={directoryInputRef}
                inputId="fotogrids-folder-upload-input"
            />

            {localUpload.files.length > 0 && !localUpload.uploading && (
                <div className="fg-upload-folder-local__summary">
                    <Icon name="image" />
                    <span>
                        {localUpload.folderName ? `${localUpload.folderName} — ` : ''}
                        {localUpload.files.length} {strings.uploadFromFolderImagesReady}
                    </span>
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: TAB_SERVER, label: strings.uploadFromFolderOnServer },
        { id: TAB_COMPUTER, label: strings.uploadFromFolderOnComputer },
    ];

    const primaryLabel = () => {
        if (activeTab === TAB_COMPUTER) {
            return localUpload.uploading
                ? `${strings.uploading} ${localUpload.counts.done}/${localUpload.counts.total}`
                : strings.uploadFromFolderUploadAndAdd;
        }
        if (importing) {
            return `${strings.adding} ${importProgress.done}/${importProgress.total}`;
        }
        return selected.length > 0
            ? `${strings.addToGallery} (${selected.length})`
            : strings.addToGallery;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" preventClose={busy}>
            <Modal.Header>
                <Modal.HeaderTitle>{strings.uploadFromFolderModalTitle}</Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} larger />

            {activeTab === TAB_SERVER && (
                <Modal.SubHeader>
                    <FolderBreadcrumbs
                        crumbs={listing.breadcrumbs}
                        currentPath={listing.path}
                        disabled={busy}
                        onNavigate={browser.loadFolder}
                        label={strings.uploadFromFolder}
                    />
                </Modal.SubHeader>
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
                    {strings.cancel}
                </Button>
                <Button
                    variant="primary"
                    onClick={activeTab === TAB_COMPUTER ? localUpload.startUpload : handleImport}
                    busy={busy}
                    disabled={
                        busy ||
                        (activeTab === TAB_COMPUTER
                            ? localUpload.files.length === 0
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
