/**
 * useUploadsFolderBrowser
 *
 * Reads the uploads directory over the REST browser, one folder at a time.
 * Owns the listing, the path it belongs to, and the paging that appends to it.
 *
 * @param {Object}   options
 * @param {number}   options.galleryId          Gallery the import is for.
 * @param {boolean}  options.isOpen             Loads the root when this turns true.
 * @param {string}   [options.loadFailedMessage] Fallback when the request carries none.
 * @return {Object} listing, path, loading, loadingMore, error, loadFolder, loadMore, clearError.
 */

import { useCallback, useEffect, useState } from 'react';

export const EMPTY_LISTING = {
    path: '',
    parent: null,
    breadcrumbs: [],
    folders: [],
    files: [],
    total: 0,
    page: 1,
};

const useUploadsFolderBrowser = ({ galleryId, isOpen, loadFailedMessage }) => {
    const [listing, setListing] = useState(EMPTY_LISTING);
    const [path, setPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

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
                setError(err.message || loadFailedMessage);
                setListing(EMPTY_LISTING);
                // The path moves with the listing, so a failed load cannot leave
                // loadMore paging through the folder that was on screen before.
                setPath(targetPath);
            } finally {
                setLoading(false);
            }
        },
        [fetchListing, loadFailedMessage]
    );

    const loadMore = useCallback(async () => {
        setLoadingMore(true);

        try {
            const data = await fetchListing(path, listing.page + 1);
            setListing((prev) => ({
                ...data,
                files: [...prev.files, ...data.files],
            }));
        } catch (err) {
            setError(err.message || loadFailedMessage);
        } finally {
            setLoadingMore(false);
        }
    }, [fetchListing, path, listing.page, loadFailedMessage]);

    const clearError = useCallback(() => setError(null), []);

    useEffect(() => {
        if (isOpen) {
            loadFolder('');
        } else {
            setListing(EMPTY_LISTING);
            setPath('');
            setError(null);
        }
    }, [isOpen, loadFolder]);

    return {
        listing,
        path,
        loading,
        loadingMore,
        error,
        loadFolder,
        loadMore,
        clearError,
    };
};

export default useUploadsFolderBrowser;
