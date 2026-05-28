import React, { useCallback, useEffect, memo, useRef, useState } from 'react';
import {
    Button,
    Notice,
    Spinner,
    CheckboxControl,
    TextControl,
    Popover,
    Modal,
} from '@wordpress/components';
import MergeDialog from './MergeDialog';
import Panel from '../shared/SidebarTabs/elements/Panel';
import Toggle from '../shared/Toggle';
import Icon from '../shared/Icon';

const { __, sprintf, _n } = wp.i18n;
const apiFetch = wp.apiFetch;

const DEFAULT_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

// ─── Row component ────────────────────────────────────────────────────────────
// Memoised so that only the row(s) whose props actually changed re-render when
// the parent updates (e.g. a different row enters edit mode, selectedIds changes
// for one item, or a new page of data arrives).
const LibraryTableRow = memo(({
    item,
    isEditing,
    isSelected,
    editingDraft,
    canManage,
    entityType,
    deleteTarget,
    onToggleSelected,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onEditingDraftChange,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
}) => {
    const { __, sprintf, _n } = wp.i18n;

    return (
        <React.Fragment key={item.id}>
            <tr className={isSelected ? 'fotogrids-library-row-selected' : ''}>
                <td scope="row" className="check-column">
                    <CheckboxControl
                        label={''}
                        checked={isSelected}
                        onChange={() => onToggleSelected(item.id)}
                        aria-label={sprintf(__('Select %s', 'fotogrids'), item.name)}
                        __nextHasNoMarginBottom
                    />
                </td>
                <td className="fotogrids-library-table__column-name">
                    {isEditing ? (
                        <TextControl
                            value={editingDraft.name || ''}
                            onChange={(v) => onEditingDraftChange({ ...editingDraft, name: v })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSaveEdit();
                                if (e.key === 'Escape') onCancelEdit();
                            }}
                            autoFocus
                            __nextHasNoMarginBottom
                        />
                    ) : (
                        <button
                            type="button"
                            className="fotogrids-library-name-button"
                            onClick={() => canManage && onStartEdit(item)}
                            disabled={!canManage}
                            title={canManage ? __('Click to rename', 'fotogrids') : ''}
                        >
                            {item.name}
                        </button>
                    )}
                </td>
                <td className="fotogrids-library-table__column-slug"><code className="fotogrids-library-slug">{item.slug}</code></td>
                <td className="fotogrids-library-table__column--small fotogrids-library-table__column-usage">{item.usage_count}</td>
                {entityType.supports_extra_fields && (
                    <td className="fotogrids-library-table__column--small fotogrids-library-table__column-extra">
                        {isEditing ? (
                            <div className="fotogrids-library-latlng-edit">
                                <TextControl
                                    label={__('Lat', 'fotogrids')}
                                    value={editingDraft.latitude ?? ''}
                                    onChange={(v) => onEditingDraftChange({ ...editingDraft, latitude: v })}
                                    type="number"
                                    __nextHasNoMarginBottom
                                />
                                <TextControl
                                    label={__('Lng', 'fotogrids')}
                                    value={editingDraft.longitude ?? ''}
                                    onChange={(v) => onEditingDraftChange({ ...editingDraft, longitude: v })}
                                    type="number"
                                    __nextHasNoMarginBottom
                                />
                            </div>
                        ) : item.latitude !== null && item.longitude !== null ? (
                            <span className="fotogrids-library-latlng">
                                {item.latitude}, {item.longitude}
                            </span>
                        ) : (
                            <span className="fotogrids-library-muted">-</span>
                        )}
                    </td>
                )}
                <td className="fotogrids-library-table__column--small fotogrids-library-table__column-actions">
                    {isEditing ? (
                        <div className="fotogrids-library-actions">
                            <button className="fotogrids-button fotogrids-button--primary fotogrids-button--small" onClick={onSaveEdit}>{__('Save', 'fotogrids')}</button>
                            <button className="fotogrids-button fotogrids-button--secondary fotogrids-button--small" onClick={onCancelEdit}>{__('Cancel', 'fotogrids')}</button>
                        </div>
                    ) : (
                        <Button
                            size="small"
                            variant="tertiary"
                            isDestructive
                            disabled={!canManage}
                            onClick={() => onRequestDelete(item)}
                            aria-label={sprintf(__('Delete %s', 'fotogrids'), item.name)}
                        >
                            {__('Delete', 'fotogrids')}
                        </Button>
                    )}

                    {deleteTarget && deleteTarget.id === item.id && (
                        <Popover
                            onClose={onCancelDelete}
                            placement="bottom-end"
                        >
                            <div className="fotogrids-library-delete-popover">
                                <p>
                                    {item.usage_count > 0
                                        ? sprintf(
                                            _n(
                                                'Delete "%1$s"? This will remove it from %2$d item.',
                                                'Delete "%1$s"? This will remove it from %2$d items.',
                                                item.usage_count,
                                                'fotogrids'
                                            ),
                                            item.name,
                                            item.usage_count
                                        )
                                        : sprintf(__('Delete "%s"? It is not used by any items.', 'fotogrids'), item.name)
                                    }
                                </p>
                                <div className="fotogrids-library-delete-popover-actions">
                                    <Button size="small" variant="primary" isDestructive onClick={onConfirmDelete}>
                                        {__('Delete', 'fotogrids')}
                                    </Button>
                                    <Button size="small" variant="tertiary" onClick={onCancelDelete}>
                                        {__('Cancel', 'fotogrids')}
                                    </Button>
                                </div>
                            </div>
                        </Popover>
                    )}
                </td>
            </tr>
        </React.Fragment>
    );
});

LibraryTableRow.displayName = 'LibraryTableRow';

// ─── Toolbar component ────────────────────────────────────────────────────────
// Owns the search input and unused-only toggle. Debounces internally so
// LibraryTabBase never re-renders on a raw keystroke - it only hears the
// stabilised value via onSearchChange.
const LibraryTableToolbar = memo(({
    entityType,
    canManage,
    recalcing,
    onSearchChange,
    onUnusedOnlyChange,
    onOpenCreate,
    onRecalc,
}) => {
    const { __, sprintf } = wp.i18n;
    const [search, setSearch] = useState('');
    const [unusedOnly, setUnusedOnly] = useState(false);

    // Debounce: notify parent only after the user stops typing.
    useEffect(() => {
        const t = setTimeout(() => onSearchChange(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [search, onSearchChange]);

    const handleUnusedOnly = useCallback((value) => {
        setUnusedOnly(value);
        onUnusedOnlyChange(value);
    }, [onUnusedOnlyChange]);

    return (
        <div className="fotogrids-library-toolbar">
            <div className="fotogrids-library-toolbar-search">
                <TextControl
                    value={search}
                    onChange={setSearch}
                    placeholder={
                        entityType.label_plural
                            ? sprintf(__('Search %s…', 'fotogrids'), entityType.label_plural.toLowerCase())
                            : __('Search…', 'fotogrids')
                    }
                    __nextHasNoMarginBottom
                />
            </div>

            <div className="fotogrids-library-toolbar-filter">
                <Toggle
                    checked={unusedOnly}
                    onChange={handleUnusedOnly}
                    label={__('Unused only', 'fotogrids')}
                    labelLight
                    size="small"
                    id={`fg-lib-unused-only-${entityType.slug}`}
                />
            </div>

            <div className="fotogrids-library-toolbar-actions">
                {canManage && entityType.supports_create && (
                    <button className="fotogrids-button fotogrids-button--primary fotogrids-button--small" onClick={onOpenCreate}>
                        {sprintf(__('Add %s', 'fotogrids'), entityType.label_singular || __('entry', 'fotogrids'))}
                    </button>
                )}
                {canManage && (
                    <button className="fotogrids-button fotogrids-button--secondary fotogrids-button--small" onClick={onRecalc} disabled={recalcing}>
                        {__('Recalculate counts', 'fotogrids')}
                    </button>
                )}
            </div>
        </div>
    );
});

LibraryTableToolbar.displayName = 'LibraryTableToolbar';

const LibraryTableBulkBar = memo(({ selectedCount, canManage, onDeleteSelected, onMerge }) => {
    const { __, sprintf, _n } = wp.i18n;
    return (
        <div className="fotogrids-library-bulkbar">
            <span>{sprintf(_n('%d selected', '%d selected', selectedCount, 'fotogrids'), selectedCount)}</span>
            <Button variant="secondary" isDestructive onClick={onDeleteSelected} disabled={!canManage}>
                {__('Delete selected', 'fotogrids')}
            </Button>
            {selectedCount >= 2 && (
                <Button variant="secondary" onClick={onMerge} disabled={!canManage}>
                    {__('Merge…', 'fotogrids')}
                </Button>
            )}
        </div>
    );
});

LibraryTableBulkBar.displayName = 'LibraryTableBulkBar';

const LibraryTableHead = memo(({ entityType, orderby, order, allSelectedOnPage, onSort, onToggleSelectAll }) => {
    const { __ } = wp.i18n;

    const sortIndicator = (column) => {
        if (orderby !== column) return null;
        return (
            <span
                className="fotogrids-library-sort__indicator"
                data-fg-order={order === 'asc' ? 'asc' : 'desc'}
                aria-hidden="true"
            >
                <Icon name="arrow_down" />
            </span>
        );
    };

    return (
        <thead>
            <tr>
                <th scope="col" className="check-column">
                    <CheckboxControl
                        label={''}
                        checked={allSelectedOnPage}
                        onChange={onToggleSelectAll}
                        aria-label={__('Select all on this page', 'fotogrids')}
                        __nextHasNoMarginBottom
                    />
                </th>
                <th className="fotogrids-library-table__column-name" scope="col">
                    <button type="button" className="fotogrids-library-sort" onClick={() => onSort('name')}>
                        {__('Name', 'fotogrids')}{sortIndicator('name')}
                    </button>
                </th>
                <th className="fotogrids-library-table__column-slug" scope="col">
                    <button type="button" className="fotogrids-library-sort" onClick={() => onSort('slug')}>
                        {__('Slug', 'fotogrids')}{sortIndicator('slug')}
                    </button>
                </th>
                <th className="fotogrids-library-table__column--small fotogrids-library-table__column-usage" scope="col">
                    <button type="button" className="fotogrids-library-sort" onClick={() => onSort('usage_count')}>
                        {__('Items', 'fotogrids')}{sortIndicator('usage_count')}
                    </button>
                </th>
                {entityType.supports_extra_fields && (
                    <th className="fotogrids-library-table__column--small fotogrids-library-table__column-extra" scope="col">{__('Latitude / Longitude', 'fotogrids')}</th>
                )}
                <th className="fotogrids-library-table__column--small fotogrids-library-table__column-actions" scope="col">{__('Actions', 'fotogrids')}</th>
            </tr>
        </thead>
    );
});

LibraryTableHead.displayName = 'LibraryTableHead';

/**
 * Shared table + actions for every library entity type.
 *
 * Behaviour is identical across Tags / People / Locations; entity-specific
 * differences (extra columns, create-form fields, inline-edit fields) come in
 * via the `config` prop. Keeping it shared means a bug-fix in one place
 * applies to every tab.
 */
const LibraryTabBase = ({ entityType, config }) => {
    const library = window.fotogridsLibrary || {};
    const restBase = library.restBase || 'fotogrids/v1/library';
    const canManage = Boolean(library.canManage);

    // ─── List state ──────────────────────────────────────────────────────────
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage] = useState(library.perPage || DEFAULT_PER_PAGE);
    const [orderby, setOrderby] = useState('name');
    const [order, setOrder] = useState('asc');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [unusedOnly, setUnusedOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ─── Selection / inline state ────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [editingId, setEditingId] = useState(null);
    const [editingDraft, setEditingDraft] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createDraft, setCreateDraft] = useState({});
    const [mergeOpen, setMergeOpen] = useState(false);
    const [recalcing, setRecalcing] = useState(false);

    // ─── Data load ───────────────────────────────────────────────────────────
    const reqIdRef = useRef(0);
    const loadList = useCallback(() => {
        const reqId = ++reqIdRef.current;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
            search: debouncedSearch,
            page: String(page),
            per_page: String(perPage),
            orderby,
            order,
            unused_only: unusedOnly ? '1' : '0',
        });

        apiFetch({ path: `/${restBase}/${entityType.slug}?${params.toString()}` })
            .then((response) => {
                if (reqId !== reqIdRef.current) return; // stale
                setItems(Array.isArray(response.items) ? response.items : []);
                setTotal(Number(response.total) || 0);
                setLoading(false);
                setSelectedIds(new Set());
            })
            .catch((err) => {
                if (reqId !== reqIdRef.current) return;
                setError(err?.message || __('Failed to load entries.', 'fotogrids'));
                setLoading(false);
            });
    }, [restBase, entityType.slug, debouncedSearch, page, perPage, orderby, order, unusedOnly]);

    useEffect(() => { loadList(); }, [loadList]);

    // Reset to page 1 when the filter/search/sort changes.
    useEffect(() => { setPage(1); }, [debouncedSearch, orderby, order, unusedOnly]);

    // ─── Toolbar / filter callbacks ───────────────────────────────────────────
    const handleSearchChange = useCallback((value) => {
        setDebouncedSearch(value);
    }, []);

    const handleUnusedOnlyChange = useCallback((value) => {
        setUnusedOnly(value);
    }, []);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const toggleSelected = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (prev.size === items.length) return new Set();
            return new Set(items.map((i) => i.id));
        });
    }, [items]);

    const toggleSort = useCallback((column) => {
        if (orderby === column) {
            setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        } else {
            setOrderby(column);
            setOrder('asc');
        }
    }, [orderby]);

    const flashNotice = useCallback((status, message) => {
        if (!window.fotogridsToast) return;
        if (status === 'success') {
            window.fotogridsToast.success(message);
        } else if (status === 'error') {
            window.fotogridsToast.error(message);
        } else if (status === 'warning') {
            window.fotogridsToast.warning(message);
        } else {
            window.fotogridsToast.info(message);
        }
    }, []);

    // ─── Inline rename ───────────────────────────────────────────────────────
    const startEdit = useCallback((item) => {
        setEditingId(item.id);
        const draft = { name: item.name };
        if (entityType.type === 'location') {
            draft.latitude = item.latitude ?? '';
            draft.longitude = item.longitude ?? '';
        }
        if (entityType.type === 'person') {
            draft.details = item.meta?.details || '';
        }
        setEditingDraft(draft);
    }, [entityType.type]);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditingDraft({});
    }, []);

    const saveEdit = useCallback(() => {
        if (!editingId) return;

        const body = { name: editingDraft.name };
        if (entityType.type === 'location') {
            body.latitude = editingDraft.latitude === '' ? null : Number(editingDraft.latitude);
            body.longitude = editingDraft.longitude === '' ? null : Number(editingDraft.longitude);
        }
        if (entityType.type === 'person') {
            body.details = editingDraft.details || '';
        }

        apiFetch({
            path: `/${restBase}/${entityType.slug}/${editingId}`,
            method: 'PATCH',
            data: body,
        })
            .then((updated) => {
                setItems((prev) => prev.map((it) => (it.id === editingId ? updated : it)));
                cancelEdit();
                flashNotice(
                    'success',
                    sprintf(
                        /* translators: 1: entity type singular (e.g. "tag"), 2: entry name */
                        __('Saved the %1$s "%2$s".', 'fotogrids'),
                        (entityType.label_singular || __('entry', 'fotogrids')).toLowerCase(),
                        updated.name
                    )
                );
            })
            .catch((err) => {
                flashNotice(
                    'error',
                    err?.message || sprintf(
                        /* translators: %s: entity type singular (e.g. "tag") */
                        __('Could not save %s.', 'fotogrids'),
                        (entityType.label_singular || __('entry', 'fotogrids')).toLowerCase()
                    )
                );
            });
    }, [editingId, editingDraft, entityType.type, entityType.slug, restBase, cancelEdit, flashNotice]);

    // ─── Delete ──────────────────────────────────────────────────────────────
    const requestDelete = useCallback((item) => {
        setDeleteTarget(item);
    }, []);

    const cancelDelete = useCallback(() => {
        setDeleteTarget(null);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;
        const name = deleteTarget.name;
        const typeLabel = (entityType.label_singular || __('entry', 'fotogrids')).toLowerCase();
        apiFetch({
            path: `/${restBase}/${entityType.slug}/${id}`,
            method: 'DELETE',
        })
            .then(() => {
                setItems((prev) => prev.filter((it) => it.id !== id));
                setTotal((t) => Math.max(0, t - 1));
                cancelDelete();
                flashNotice(
                    'success',
                    sprintf(
                        /* translators: 1: entity type singular (e.g. "tag"), 2: entry name */
                        __('Deleted the %1$s "%2$s".', 'fotogrids'),
                        typeLabel,
                        name
                    )
                );
            })
            .catch((err) => {
                flashNotice(
                    'error',
                    err?.message || sprintf(
                        /* translators: 1: entity type singular (e.g. "tag"), 2: entry name */
                        __('Could not delete the %1$s "%2$s".', 'fotogrids'),
                        typeLabel,
                        name
                    )
                );
                cancelDelete();
            });
    }, [deleteTarget, entityType.slug, entityType.label_singular, restBase, cancelDelete, flashNotice]);

    // ─── Bulk delete ─────────────────────────────────────────────────────────
    const confirmBulkDelete = () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        apiFetch({
            path: `/${restBase}/${entityType.slug}`,
            method: 'DELETE',
            data: { ids },
        })
            .then((response) => {
                loadList();
                setBulkConfirmOpen(false);
                const deleted = response.deleted || 0;
                flashNotice(
                    'success',
                    sprintf(
                        /* translators: 1: number of entries, 2: entity type (singular or plural, e.g. "tag" / "tags") */
                        _n('Deleted %1$d %2$s.', 'Deleted %1$d %2$s.', deleted, 'fotogrids'),
                        deleted,
                        (deleted === 1
                            ? (entityType.label_singular || __('entry', 'fotogrids'))
                            : (entityType.label_plural || __('entries', 'fotogrids'))
                        ).toLowerCase()
                    )
                );
            })
            .catch((err) => {
                flashNotice(
                    'error',
                    err?.message || sprintf(
                        /* translators: %s: entity type plural (e.g. "tags") */
                        __('Could not delete the selected %s.', 'fotogrids'),
                        (entityType.label_plural || __('entries', 'fotogrids')).toLowerCase()
                    )
                );
                setBulkConfirmOpen(false);
            });
    };

    // ─── Create ──────────────────────────────────────────────────────────────
    const openCreate = () => {
        const draft = { name: '' };
        if (entityType.type === 'location') { draft.latitude = ''; draft.longitude = ''; }
        if (entityType.type === 'person')   { draft.details = ''; }
        setCreateDraft(draft);
        setCreateOpen(true);
    };

    const submitCreate = () => {
        const body = { name: createDraft.name };
        if (entityType.type === 'location') {
            if (createDraft.latitude !== '')  body.latitude  = Number(createDraft.latitude);
            if (createDraft.longitude !== '') body.longitude = Number(createDraft.longitude);
        }
        if (entityType.type === 'person' && createDraft.details) {
            body.details = createDraft.details;
        }

        const createdName = body.name;
        const typeLabel = (entityType.label_singular || __('entry', 'fotogrids')).toLowerCase();
        apiFetch({
            path: `/${restBase}/${entityType.slug}`,
            method: 'POST',
            data: body,
        })
            .then((created) => {
                setCreateOpen(false);
                loadList();
                flashNotice(
                    'success',
                    sprintf(
                        /* translators: 1: entity type singular (e.g. "tag"), 2: entry name */
                        __('Created the %1$s "%2$s".', 'fotogrids'),
                        typeLabel,
                        (created && created.name) || createdName
                    )
                );
            })
            .catch((err) => {
                flashNotice(
                    'error',
                    err?.message || sprintf(
                        /* translators: %s: entity type singular (e.g. "tag") */
                        __('Could not create %s.', 'fotogrids'),
                        typeLabel
                    )
                );
            });
    };

    // ─── Merge ───────────────────────────────────────────────────────────────
    const openMerge = () => setMergeOpen(true);
    const closeMerge = () => setMergeOpen(false);

    const handleMerge = ({ targetId, sourceIds }) => {
        const target = items.find((it) => it.id === targetId);
        return apiFetch({
            path: `/${restBase}/${entityType.slug}/merge`,
            method: 'POST',
            data: { target_id: targetId, source_ids: sourceIds },
        }).then((response) => {
            loadList();
            setMergeOpen(false);
            const merged = response.merged || 0;
            const typeLabel = (merged === 1
                ? (entityType.label_singular || __('entry', 'fotogrids'))
                : (entityType.label_plural || __('entries', 'fotogrids'))
            ).toLowerCase();
            flashNotice(
                'success',
                target && target.name
                    ? sprintf(
                        /* translators: 1: number of merged entries, 2: entity type (singular or plural), 3: target entry name */
                        _n('Merged %1$d %2$s into "%3$s".', 'Merged %1$d %2$s into "%3$s".', merged, 'fotogrids'),
                        merged,
                        typeLabel,
                        target.name
                    )
                    : sprintf(
                        /* translators: 1: number of merged entries, 2: entity type (singular or plural) */
                        _n('Merged %1$d %2$s.', 'Merged %1$d %2$s.', merged, 'fotogrids'),
                        merged,
                        typeLabel
                    )
            );
            return response;
        });
    };

    // ─── Recalculate ─────────────────────────────────────────────────────────
    const handleRecalc = () => {
        setRecalcing(true);
        apiFetch({
            path: `/${restBase}/${entityType.slug}/recalculate`,
            method: 'POST',
            data: {},
        })
            .then((response) => {
                loadList();
                const touched = response.touched || 0;
                flashNotice(
                    'success',
                    sprintf(
                        /* translators: 1: number of entries, 2: entity type (singular or plural, e.g. "tag" / "tags") */
                        _n('Recalculated counts for %1$d %2$s.', 'Recalculated counts for %1$d %2$s.', touched, 'fotogrids'),
                        touched,
                        (touched === 1
                            ? (entityType.label_singular || __('entry', 'fotogrids'))
                            : (entityType.label_plural || __('entries', 'fotogrids'))
                        ).toLowerCase()
                    )
                );
            })
            .catch((err) => {
                flashNotice(
                    'error',
                    err?.message || sprintf(
                        /* translators: %s: entity type plural (e.g. "tags") */
                        __('Could not recalculate counts for %s.', 'fotogrids'),
                        (entityType.label_plural || __('entries', 'fotogrids')).toLowerCase()
                    )
                );
            })
            .finally(() => setRecalcing(false));
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    const allSelectedOnPage = items.length > 0 && selectedIds.size === items.length;

    return (
        <Panel
            // className={`fotogrids-library-tab fotogrids-library-tab-${entityType.slug}`}
            equalBodyPadding
        >
            <LibraryTableToolbar
                entityType={entityType}
                canManage={canManage}
                recalcing={recalcing}
                onSearchChange={handleSearchChange}
                onUnusedOnlyChange={handleUnusedOnlyChange}
                onOpenCreate={openCreate}
                onRecalc={handleRecalc}
            />

            {error && (
                <Notice status="error" isDismissible={false}>{error}</Notice>
            )}

            {selectedIds.size > 0 && (
                <LibraryTableBulkBar
                    selectedCount={selectedIds.size}
                    canManage={canManage}
                    onDeleteSelected={() => setBulkConfirmOpen(true)}
                    onMerge={openMerge}
                />
            )}

            <table className="wp-list-table widefat striped fotogrids-library-table">
                <LibraryTableHead
                    entityType={entityType}
                    orderby={orderby}
                    order={order}
                    allSelectedOnPage={allSelectedOnPage}
                    onSort={toggleSort}
                    onToggleSelectAll={toggleSelectAll}
                />
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={entityType.supports_extra_fields ? 6 : 5} className="fotogrids-library-loading">
                                <Spinner />
                            </td>
                        </tr>
                    ) : items.length === 0 ? (
                        <tr>
                            <td colSpan={entityType.supports_extra_fields ? 6 : 5} className="fotogrids-library-empty">
                                <p>
                                    {unusedOnly
                                        ? __('No unused entries.', 'fotogrids')
                                        : debouncedSearch
                                            ? __('No entries match your search.', 'fotogrids')
                                            : __('No entries yet.', 'fotogrids')}
                                </p>
                                {!debouncedSearch && !unusedOnly && (
                                    <p className="fotogrids-library-empty-help">
                                        {__('Entries are usually created from the Item Edit modal inside a gallery. You can also add one directly using the button above.', 'fotogrids')}
                                    </p>
                                )}
                            </td>
                        </tr>
                    ) : items.map((item) => (
                        <LibraryTableRow
                            key={item.id}
                            item={item}
                            isEditing={editingId === item.id}
                            isSelected={selectedIds.has(item.id)}
                            editingDraft={editingDraft}
                            canManage={canManage}
                            entityType={entityType}
                            deleteTarget={deleteTarget}
                            onToggleSelected={toggleSelected}
                            onStartEdit={startEdit}
                            onCancelEdit={cancelEdit}
                            onSaveEdit={saveEdit}
                            onEditingDraftChange={setEditingDraft}
                            onRequestDelete={requestDelete}
                            onCancelDelete={cancelDelete}
                            onConfirmDelete={confirmDelete}
                        />
                    ))}
                </tbody>
            </table>

            {!loading && totalPages > 1 && (
                <div className="fotogrids-library-pagination tablenav-pages">
                    <span className="displaying-num">
                        {sprintf(_n('%d entry', '%d entries', total, 'fotogrids'), total)}
                    </span>
                    <span className="pagination-links">
                        <Button
                            variant="secondary"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {'‹'}
                        </Button>
                        <span className="paging-input">
                            {sprintf(__('%1$d of %2$d', 'fotogrids'), page, totalPages)}
                        </span>
                        <Button
                            variant="secondary"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {'›'}
                        </Button>
                    </span>
                </div>
            )}

            {bulkConfirmOpen && (
                <Modal
                    title={__('Delete selected entries?', 'fotogrids')}
                    onRequestClose={() => setBulkConfirmOpen(false)}
                >
                    <p>
                        {sprintf(
                            _n(
                                'You are about to delete %d entry. Linked items will lose this %s.',
                                'You are about to delete %d entries. Linked items will lose these %s.',
                                selectedIds.size,
                                'fotogrids'
                            ),
                            selectedIds.size,
                            (entityType.label_plural || '').toLowerCase()
                        )}
                    </p>
                    <div className="fotogrids-library-modal-actions">
                        <Button variant="primary" isDestructive onClick={confirmBulkDelete}>
                            {__('Delete', 'fotogrids')}
                        </Button>
                        <Button variant="tertiary" onClick={() => setBulkConfirmOpen(false)}>
                            {__('Cancel', 'fotogrids')}
                        </Button>
                    </div>
                </Modal>
            )}

            {createOpen && (
                <Modal
                    title={sprintf(__('Add %s', 'fotogrids'), entityType.label_singular || __('entry', 'fotogrids'))}
                    onRequestClose={() => setCreateOpen(false)}
                >
                    <TextControl
                        label={__('Name', 'fotogrids')}
                        value={createDraft.name || ''}
                        onChange={(v) => setCreateDraft({ ...createDraft, name: v })}
                        __nextHasNoMarginBottom
                    />
                    {entityType.type === 'location' && (
                        <>
                            <TextControl
                                label={__('Latitude', 'fotogrids')}
                                value={createDraft.latitude ?? ''}
                                onChange={(v) => setCreateDraft({ ...createDraft, latitude: v })}
                                type="number"
                                __nextHasNoMarginBottom
                            />
                            <TextControl
                                label={__('Longitude', 'fotogrids')}
                                value={createDraft.longitude ?? ''}
                                onChange={(v) => setCreateDraft({ ...createDraft, longitude: v })}
                                type="number"
                                __nextHasNoMarginBottom
                            />
                        </>
                    )}
                    {entityType.type === 'person' && (
                        <TextControl
                            label={__('Details (optional)', 'fotogrids')}
                            value={createDraft.details ?? ''}
                            onChange={(v) => setCreateDraft({ ...createDraft, details: v })}
                            __nextHasNoMarginBottom
                        />
                    )}
                    <div className="fotogrids-library-modal-actions">
                        <Button variant="primary" onClick={submitCreate} disabled={!createDraft.name?.trim()}>
                            {__('Create', 'fotogrids')}
                        </Button>
                        <Button variant="tertiary" onClick={() => setCreateOpen(false)}>
                            {__('Cancel', 'fotogrids')}
                        </Button>
                    </div>
                </Modal>
            )}

            {mergeOpen && (
                <MergeDialog
                    entityType={entityType}
                    selectedIds={Array.from(selectedIds)}
                    items={items}
                    onCancel={closeMerge}
                    onMerge={handleMerge}
                    restBase={restBase}
                />
            )}
        </Panel>
    );
};

export default LibraryTabBase;
