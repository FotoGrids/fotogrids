import React, { useEffect, useMemo, useState } from 'react';
import { Spinner, Notice } from '@wordpress/components';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField } from '../shared/FormField';

const { __, sprintf, _n } = wp.i18n;
const apiFetch = wp.apiFetch;

/**
 * Merge dialog: choose a target entry from this entity type and merge the
 * currently-selected sources into it.
 *
 * Target selection is autocomplete-style - the user types and we hit the
 * library list endpoint (which already supports search), excluding sources.
 */
const MergeDialog = ({ entityType, selectedIds, items, onCancel, onMerge, restBase }) => {
    const sources = useMemo(
        () => items.filter((i) => selectedIds.includes(i.id)),
        [items, selectedIds]
    );

    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [targetId, setTargetId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setLoading(true);
            const params = new URLSearchParams({
                search,
                per_page: '20',
                page: '1',
            });
            apiFetch({ path: `/${restBase}/${entityType.slug}?${params.toString()}` })
                .then((res) => {
                    const filtered = (res.items || []).filter((it) => !selectedIds.includes(it.id));
                    setResults(filtered);
                })
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 250);
        return () => clearTimeout(t);
    }, [search, restBase, entityType.slug, selectedIds]);

    const target = results.find((r) => r.id === targetId)
        || items.find((i) => i.id === targetId)
        || null;

    const totalLinkedItems = sources.reduce((sum, s) => sum + (s.usage_count || 0), 0);

    const handleConfirm = () => {
        if (!target) return;
        setBusy(true);
        setError(null);
        onMerge({ targetId: target.id, sourceIds: selectedIds })
            .catch((err) => {
                setError(err?.message || __('Merge failed.', 'fotogrids'));
                setBusy(false);
            });
    };

    return (
        <Modal
            isOpen
            onClose={onCancel}
            size="md"
            preventClose={busy}
        >
            <Modal.Header>
                <Modal.HeaderTitle>
                    {sprintf(__('Merge %s', 'fotogrids'), (entityType.label_plural || '').toLowerCase())}
                </Modal.HeaderTitle>
            </Modal.Header>

            <Modal.Body>
                <p>
                    {sprintf(
                        _n(
                            'You selected %d source entry. Choose the entry to merge it into.',
                            'You selected %d source entries. Choose the entry to merge them into.',
                            sources.length,
                            'fotogrids'
                        ),
                        sources.length
                    )}
                </p>

                <ul className="fotogrids-library-merge-sources">
                    {sources.map((s) => (
                        <li key={s.id}>
                            <strong>{s.name}</strong>
                            <span className="fotogrids-library-muted">
                                {' '}
                                ({sprintf(_n('%d item', '%d items', s.usage_count || 0, 'fotogrids'), s.usage_count || 0)})
                            </span>
                        </li>
                    ))}
                </ul>

                <FormField label={__('Search for target entry', 'fotogrids')} htmlFor="fg-merge-search" layout="column">
                    <input
                        id="fg-merge-search"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={__('Type to search…', 'fotogrids')}
                    />
                </FormField>

                {loading ? (
                    <Spinner />
                ) : (
                    <ul className="fotogrids-library-merge-targets">
                        {results.length === 0 && (
                            <li className="fotogrids-library-muted">
                                {__('No matching entries.', 'fotogrids')}
                            </li>
                        )}
                        {results.map((r) => (
                            <li key={r.id}>
                                <label>
                                    <input
                                        type="radio"
                                        name="fotogrids-merge-target"
                                        value={r.id}
                                        checked={targetId === r.id}
                                        onChange={() => setTargetId(r.id)}
                                    />
                                    <span>{r.name}</span>
                                    <span className="fotogrids-library-muted">
                                        {' '}({sprintf(_n('%d item', '%d items', r.usage_count || 0, 'fotogrids'), r.usage_count || 0)})
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                {target && (
                    <Notice status="info" isDismissible={false}>
                        {sprintf(
                            __('All %1$d linked items will be re-pointed to "%2$s", and the source entries will be deleted.', 'fotogrids'),
                            totalLinkedItems,
                            target.name
                        )}
                    </Notice>
                )}

                {error && <Notice status="error" isDismissible={false}>{error}</Notice>}
            </Modal.Body>

            <Modal.Footer>
                <Button variant="secondary" onClick={onCancel} disabled={busy}>
                    {__('Cancel', 'fotogrids')}
                </Button>
                <Button variant="primary" onClick={handleConfirm} disabled={!target || busy} busy={busy}>
                    {__('Merge', 'fotogrids')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default MergeDialog;
