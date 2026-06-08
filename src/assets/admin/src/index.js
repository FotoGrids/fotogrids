/**
 * FotoGrids admin entry point. Mounts the React component for whichever
 * admin page is currently being rendered.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles/admin.scss';

import Dashboard from './components/pages/Dashboard';
import StatsPage from './components/pages/StatsPage';
import PluginSettingsPage from './components/pages/PluginSettingsPage';
import LicensePage from './components/pages/LicensePage';
import ToolsPage from './components/pages/ToolsPage';
import LibraryPage from './components/pages/LibraryPage';
import SetupWizardPage from './components/pages/SetupWizardPage';

/**
 * Mount a React component into a DOM container by ID, idempotently. No-ops
 * when the container is not on the current page.
 *
 * @param {string} containerId
 * @param {React.ComponentType} Component
 */
function renderComponent(containerId, Component) {
    const container = document.getElementById(containerId);
    if (!container) {
        return; // Container doesn't exist on this page
    }

    if (!createRoot) {
            return;
        }

    // Check if container already has a React root (don't create multiple roots)
    if (container._reactRootContainer) {
        container._reactRootContainer.render(React.createElement(Component));
            return;
        }

    try {
        const root = createRoot(container);
        // Store reference for potential reuse
        container._reactRootContainer = root;
        root.render(React.createElement(Component));
    } catch (error) {
        console.error(`FotoGrids: Error rendering ${containerId}:`, error);
    }
}

function initializeAdminPages() {
    renderComponent('fotogrids-main-page', Dashboard);
    // Templates page is mounted by the Templates module's own bundle
    // (includes/modules/Templates/assets/templates-page.js).
    renderComponent('fotogrids-stats-page', StatsPage);
    renderComponent('fotogrids-settings-page', PluginSettingsPage);
    renderComponent('fotogrids-license-page', LicensePage);
    renderComponent('fotogrids-tools-page', ToolsPage);
    renderComponent('fotogrids-library-page', LibraryPage);
    renderComponent('fotogrids-setup-page', SetupWizardPage);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPages);
} else {
    setTimeout(initializeAdminPages, 0);
}
