import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

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
        </div>
    );
};

export default DefaultsTab;
