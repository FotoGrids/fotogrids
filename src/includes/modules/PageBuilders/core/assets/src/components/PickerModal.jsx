/**
 * PickerModal - gallery / album picker for every page-builder host.
 *
 * Modeled after FooGallery's picker: card grid, search, sort, infinite
 * scroll, keyboard nav.
 *
 * Props:
 *   - kind:        'gallery' | 'album'
 *   - restUrl:     string  base rest URL ending in `fotogrids/v1/`
 *   - restNonce:   string
 *   - onSelect:    (item) => void  fired when the user picks a card
 *   - onClose:     () => void
 *   - selectedId:  number  current selection, if any
 *   - title:       string  modal title (host-supplied, defaults to "Select Gallery"/"Select Album")
 *   - createNewUrl: string  URL the "Create new" button opens in a new tab
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

// Modal + Button are shared from the admin component library. Reaching
// across /src/includes/modules/.../core/assets/src/components/ to
// /src/assets/admin/src/components/shared/* is a real distance in the
// source tree, so we use the webpack `@` alias (= src/assets) to keep
// the imports legible. See webpack.config.js > resolve.alias.
import { Modal } from '@/admin/src/components/shared/Modal';
import { Button } from '@/admin/src/components/shared/Button';
import Select from '@/admin/src/components/shared/Select';
import SearchBar from '@/admin/src/components/shared/SearchBar';

import PickerCard from './PickerCard';

const PER_PAGE = 24;

const PickerModal = ({
    kind,
    restUrl,
    restNonce,
    onSelect,
    onClose,
    selectedId = 0,
    title,
    createNewUrl,
}) => {
    const isAlbum = kind === 'album';
    const defaultTitle = isAlbum
        ? __('Select an album', 'fotogrids')
        : __('Select a gallery', 'fotogrids');
    const heading = title || defaultTitle;

    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [orderby, setOrderby] = useState('newest');
    const [error, setError] = useState(null);
    const [highlightId, setHighlightId] = useState(selectedId || 0);

    const requestSeqRef = useRef(0);
    const listRef = useRef(null);

    /** Reset and fetch from page 1 whenever search or orderby change. */
    useEffect(() => {
        setItems([]);
        setPage(1);
        setHasMore(false);
        setError(null);
    }, [search, orderby, kind]);

    const fetchPage = useCallback(async (pageNum, replace) => {
        const seq = ++requestSeqRef.current;
        setLoading(true);
        setError(null);

        // Build via URL + searchParams so params are appended with the
        // correct separator whether restUrl is pretty (…/wp-json/…/) or
        // plain (…/?rest_route=/…/). A manual `?` concat produces a
        // second `?` on plain permalinks and yields rest_no_route.
        const url = new URL(`${restUrl}picker/items`);
        url.searchParams.set('type', kind);
        url.searchParams.set('page', String(pageNum));
        url.searchParams.set('per_page', String(PER_PAGE));
        url.searchParams.set('orderby', orderby);
        if (search) {
            url.searchParams.set('search', search);
        }

        try {
            const response = await fetch(
                url.toString(),
                {
                    headers: {
                        'X-WP-Nonce': restNonce,
                    },
                }
            );
            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(
                    errBody.message || __('Failed to load items.', 'fotogrids')
                );
            }
            const data = await response.json();
            if (seq !== requestSeqRef.current) {
                return;
            }
            setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
            setHasMore(Boolean(data.has_more));
        } catch (err) {
            if (seq !== requestSeqRef.current) {
                return;
            }
            setError(err.message || __('Failed to load items.', 'fotogrids'));
        } finally {
            if (seq === requestSeqRef.current) {
                setLoading(false);
            }
        }
    }, [kind, restUrl, restNonce, orderby, search]);

    useEffect(() => {
        fetchPage(1, true);
    }, [fetchPage]);

    /** Infinite-scroll sentinel. */
    useEffect(() => {
        const node = listRef.current;
        if (!node || !hasMore || loading) {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setPage((p) => p + 1);
                }
            });
        }, { root: node, rootMargin: '200px' });

        const sentinel = node.querySelector('.fg-pb-picker__sentinel');
        if (sentinel) {
            observer.observe(sentinel);
        }
        return () => observer.disconnect();
    }, [hasMore, loading, items.length]);

    useEffect(() => {
        if (page > 1) {
            fetchPage(page, false);
        }
    }, [page]);

    const handleRefresh = useCallback(() => {
        setPage(1);
        fetchPage(1, true);
    }, [fetchPage]);

    /** Keyboard nav across cards. */
    const onKeyDown = useCallback((event) => {
        if (!items.length) {
            return;
        }
        const idx = items.findIndex((it) => it.id === highlightId);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = items[Math.min(items.length - 1, idx + 1)];
            if (next) setHighlightId(next.id);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            const prev = items[Math.max(0, idx - 1)];
            if (prev) setHighlightId(prev.id);
        } else if (event.key === 'Enter') {
            const highlighted = items.find((it) => it.id === highlightId);
            if (highlighted) {
                onSelect(highlighted);
            }
        }
    }, [items, highlightId, onSelect]);

    const sortOptions = useMemo(() => [
        { label: __('Newest first', 'fotogrids'), value: 'newest' },
        { label: __('Oldest first', 'fotogrids'), value: 'oldest' },
        { label: __('Title A–Z', 'fotogrids'), value: 'title' },
        { label: __('Recently updated', 'fotogrids'), value: 'modified' },
    ], []);

    // Modal is controlled by an `isOpen` prop and unmounts itself when
    // `isOpen` is false. Hosts conditionally mount PickerModal today
    // (Gutenberg gates on `pickerOpen`, Elementor mounts the React root
    // only on browse-click) and tear it down via `onClose`, so
    // isOpen={true} here matches existing semantics - when the host
    // wants the modal gone, it stops rendering us.
    //
    // The Header auto-renders its own close button (Modal.Header
    // `closeButton` defaults to true), so we don't pass <Modal.HeaderClose />
    // explicitly. The Footer + Cancel/Create-new buttons use Button
    // for visual parity with the rest of the FotoGrids admin.
    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            closeOnOverlay={true}
            closeOnEsc={true}
            className="fg-pb-picker-modal"
            compact
        >
            <Modal.Header>
                <Modal.HeaderLogo />
                <Modal.HeaderTitle>{heading}</Modal.HeaderTitle>
            </Modal.Header>

            <Modal.SubHeader>
                <div className="fg-pb-picker__toolbar">
                    <SearchBar
                        label={__('Search', 'fotogrids')}
                        value={search}
                        onChange={setSearch}
                        placeholder={isAlbum
                            ? __('Search albums…', 'fotogrids')
                            : __('Search galleries…', 'fotogrids')
                        }
                    />
                    <Select
                        width={180}
                        value={orderby}
                        options={sortOptions}
                        onChange={setOrderby}
                    />
                    <Button
                        className="fg-pb-picker__refresh"
                        variant="secondary"
                        icon="refresh_cv"
                        size="lg"
                        iconOnly
                        busy={loading}
                        onClick={handleRefresh}
                        ariaLabel={__('Refresh', 'fotogrids')}
                    />
                </div>
            </Modal.SubHeader>

            <Modal.Body>
                {/*
                  * Body hosts only the scrolling list. Keyboard
                  * navigation attaches at this level so arrow keys work
                  * whether the user is focused inside the list or on a
                  * card. Toolbar (search + sort) lives in Modal.SubHeader
                  * above and stays pinned while the body scrolls.
                  */}
                <div
                    className="fg-pb-picker__list"
                    ref={listRef}
                    onKeyDown={onKeyDown}
                    role="region"
                    aria-label={heading}
                >
                    {error && (
                        <div className="fg-pb-picker__error">
                            {error}
                            <Button variant="secondary" onClick={() => fetchPage(1, true)}>
                                {__('Retry', 'fotogrids')}
                            </Button>
                        </div>
                    )}

                    {items.length === 0 && !loading && !error && (
                        <div className="fg-pb-picker__empty">
                            {search ? (
                                sprintf(
                                    /* translators: %s: search term */
                                    __('No items match “%s”.', 'fotogrids'),
                                    search
                                )
                            ) : (
                                isAlbum
                                    ? __('You haven’t created any albums yet.', 'fotogrids')
                                    : __('You haven’t created any galleries yet.', 'fotogrids')
                            )}
                            {createNewUrl && (
                                <Button
                                    variant="primary"
                                    href={createNewUrl}
                                    target="_blank"
                                >
                                    {isAlbum
                                        ? __('Create a new album', 'fotogrids')
                                        : __('Create a new gallery', 'fotogrids')
                                    }
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="fg-pb-picker__grid">
                        {items.map((item) => (
                            <PickerCard
                                key={item.id}
                                item={item}
                                kind={kind}
                                highlighted={item.id === highlightId}
                                selected={item.id === selectedId}
                                onFocus={() => setHighlightId(item.id)}
                                onSelect={() => onSelect(item)}
                            />
                        ))}
                    </div>

                    {hasMore && <div className="fg-pb-picker__sentinel" aria-hidden="true" />}

                    {loading && (
                        <div className="fg-pb-picker__loading">
                            <Spinner />
                        </div>
                    )}
                </div>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="tertiary" onClick={onClose}>
                    {__('Cancel', 'fotogrids')}
                </Button>
                {createNewUrl && items.length > 0 && (
                    <Button
                        variant="tertiary"
                        href={createNewUrl}
                        target="_blank"
                    >
                        {isAlbum
                            ? __('Create new album', 'fotogrids')
                            : __('Create new gallery', 'fotogrids')
                        }
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default PickerModal;
