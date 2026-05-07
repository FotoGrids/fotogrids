/**
 * FotoGrids Global Modal Initialization - Simple Version
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import UpgradeModal from './components/upgrade-to-pro/UpgradeModal.jsx';

function initializeUpgradeModal() {
    if (window.fotogridsIsPro === true) {
        return;
    }

    if (!window.fotogridsAdmin || !window.fotogridsAdmin.isFotoGridsPage) {
        return;
    }

    const container = document.getElementById('fotogrids-upgrade-modal');

    if (!container) {
        return;
    }

    if (container._reactRootContainer) {
        container._reactRootContainer.render(React.createElement(UpgradeModal));
        return;
    }

    try {
        const root = createRoot(container);
        container._reactRootContainer = root;
        root.render(React.createElement(UpgradeModal));
    } catch (error) {
        console.error(`FotoGrids: Error rendering UpgradeModal`, error);
    }
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeUpgradeModal();
    });
} else {
    initializeUpgradeModal();
}
