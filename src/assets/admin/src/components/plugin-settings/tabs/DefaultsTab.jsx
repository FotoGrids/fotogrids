import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import apiFetch from '@wordpress/api-fetch';
import { SaveBar } from '../../shared/settings';

const { __ } = wp.i18n;

/**
 * Unified component for rendering Gallery or Album defaults
 *
 * @param {Object} props
 * @param {string} props.type - 'gallery' or 'album'
 */
const DefaultsTab = ({ type = 'gallery' }) => {
    const containerRef = useRef(null);
    const rootRef = useRef(null);

    // The settings panel is a separate React tree rendered by the plain
    // collection-settings script, so it reports changes by event rather than by
    // prop. Collect them here and let the save bar own the write; the endpoint
    // merges, so sending only what changed is enough.
    const [pending, setPending] = useState({});
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const handleSettingChanged = (e) => {
            if ('defaults' !== e.detail?.scope || !e.detail?.key) {
                return;
            }
            setStatus(null);
            setPending((prev) => ({ ...prev, [e.detail.key]: e.detail.value }));
        };

        document.addEventListener(
            'fotogrids:setting_changed',
            handleSettingChanged
        );
        return () =>
            document.removeEventListener(
                'fotogrids:setting_changed',
                handleSettingChanged
            );
    }, []);

    const handleSave = async () => {
        const payload = pending;
        if (0 === Object.keys(payload).length) {
            return;
        }

        setSaving(true);
        setStatus(null);
        try {
            await apiFetch({
                path: '/fotogrids/v1/admin/gallery-defaults',
                method: 'POST',
                data: { defaults: payload },
            });
            // Drop only what was sent - the user may have edited on since.
            setPending((prev) => {
                const next = { ...prev };
                Object.keys(payload).forEach((key) => {
                    if (next[key] === payload[key]) {
                        delete next[key];
                    }
                });
                return next;
            });
            setStatus('saved');
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const typeLabel = type === 'gallery' ? 'gallery' : 'album';
        const postType = type === 'gallery' ? 'fotogrids_gallery' : 'fotogrids_album';

        if (window.fotogridsSettings) {
            window.fotogridsSettings.postType = postType;
        }

        const initializeApp = () => {
            if (!window.FotoGridsCollectionSettings || !window.FotoGridsCollectionSettings.CollectionSettings) {
                return false;
            }

            if (rootRef.current) {
                return true;
            }

            try {
                const root = createRoot(container);
                rootRef.current = root;
                const CollectionSettings = window.FotoGridsCollectionSettings.CollectionSettings;
                root.render(React.createElement(CollectionSettings));
                return true;
            } catch (error) {
                console.error(`FotoGrids: Error initializing ${typeLabel} defaults:`, error);
                return false;
            }
        };

        if (initializeApp()) {
            return;
        }

        const checkInterval = setInterval(() => {
            if (initializeApp()) {
                clearInterval(checkInterval);
            }
        }, 100);

        return () => {
            clearInterval(checkInterval);
            if (rootRef.current) {
                try {
                    rootRef.current.unmount();
                    rootRef.current = null;
                } catch (error) {
                    // Ignore unmount errors
                }
            }
        };
    }, [type]);

    const containerId = `fotogrids-${type}-defaults-root`;
    const keyValue = `${type}-defaults-content`;

    return (
        <div key={keyValue}>
            <div id={containerId} ref={containerRef}></div>
            <SaveBar
                dirty={Object.keys(pending).length > 0}
                saving={saving}
                status={status}
                onSave={handleSave}
                saveLabel={__('Save defaults', 'fotogrids')}
                watch={pending}
            />
        </div>
    );
};

export default DefaultsTab;
