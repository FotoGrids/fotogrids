import React, { useState, useEffect, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import InfoBlock from '../../shared/InfoBlock';
import { Button } from '../../shared/Button';

const { __, sprintf, _n } = wp.i18n;

const STATUS_PATH = '/fotogrids/v1/admin/watermark/status';
const REGEN_PATH = '/fotogrids/v1/admin/watermark/regenerate';

const EMPTY = { enabled: false, pending: 0, pending_ids: [], counts: { missing: 0, stale: 0 } };

/**
 * Watermark regenerate banner + progress.
 *
 * Reads /admin/watermark/status (site-wide, or scoped to a gallery when
 * galleryId is given) and, when images still need watermarking, shows a notice
 * with a button that regenerates them one at a time with a progress count.
 *
 * Reusable across the Plugin Settings → Watermark tab (no galleryId) and the
 * per-gallery surface (galleryId set).
 *
 * @param {Object}   props
 * @param {number}   [props.galleryId]   Scope to one gallery when set.
 * @param {Function} [props.onChange]    Called with the latest status after any refresh.
 * @param {*}        [props.refreshKey]  Change this to force a status re-fetch (e.g. after a save).
 */
const WatermarkRegenerate = ({ galleryId = 0, onChange, refreshKey }) => {
    const [status, setStatus] = useState(EMPTY);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(0);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState(false);

    const statusPath = galleryId > 0 ? `${STATUS_PATH}?gallery_id=${galleryId}` : STATUS_PATH;

    const fetchStatus = useCallback(async () => {
        try {
            const data = await apiFetch({ path: statusPath });
            const next = { ...EMPTY, ...data, counts: { ...EMPTY.counts, ...(data?.counts || {}) } };
            setStatus(next);
            if (onChange) onChange(next);
            return next;
        } catch (e) {
            setError(true);
            return EMPTY;
        }
    }, [statusPath, onChange]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetchStatus().finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [fetchStatus, refreshKey]);

    const regenerate = async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return;

        setRunning(true);
        setError(false);
        setDone(0);
        setTotal(ids.length);

        for (let i = 0; i < ids.length; i++) {
            try {
                await apiFetch({
                    path: REGEN_PATH,
                    method: 'POST',
                    data: { attachment_id: ids[i] },
                });
            } catch (e) {
                setError(true);
            }
            setDone(i + 1);
        }

        await fetchStatus();
        setRunning(false);
    };

    const handleRegenerate = () => regenerate(status.pending_ids);

    if (loading || !status.enabled || status.pending === 0) {
        return null;
    }

    const { missing = 0, stale = 0 } = status.counts;
    const pending = status.pending;

    const title = sprintf(
        /* translators: %d: number of images. */
        _n( '%d image needs watermarking', '%d images need watermarking', pending, 'fotogrids' ),
        pending
    );

    const reasonParts = [];
    if (missing > 0) {
        reasonParts.push(
            sprintf(
                /* translators: %d: number of images. */
                _n( '%d was uploaded before watermarking was on', '%d were uploaded before watermarking was on', missing, 'fotogrids' ),
                missing
            )
        );
    }
    if (stale > 0) {
        reasonParts.push(
            sprintf(
                /* translators: %d: number of images. */
                _n( '%d is out of date after a settings change', '%d are out of date after a settings change', stale, 'fotogrids' ),
                stale
            )
        );
    }
    const description = running
        ? sprintf(
            /* translators: 1: done count, 2: total count. */
            __( 'Regenerating… %1$d of %2$d', 'fotogrids' ),
            done,
            total
        )
        : reasonParts.join( __( ' · ', 'fotogrids' ) );

    return (
        <InfoBlock icon="security" title={title} description={description}>
            <Button
                variant="primary"
                size="sm"
                icon="refresh_cv"
                busy={running}
                disabled={running}
                onClick={handleRegenerate}
            >
                {running ? __( 'Regenerating…', 'fotogrids' ) : __( 'Regenerate now', 'fotogrids' )}
            </Button>
        </InfoBlock>
    );
};

export default WatermarkRegenerate;
