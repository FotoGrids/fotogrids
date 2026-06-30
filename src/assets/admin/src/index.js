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
import ToolsPage from './components/pages/ToolsPage';
import LibraryPage from './components/pages/LibraryPage';
import SetupWizardPage from './components/pages/SetupWizardPage';

const SETUP_QUERY_PARAM = 'fotogrids_setup_step';

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
		return;
	}

	if (!createRoot) {
		return;
	}

	if (container._reactRootContainer) {
		container._reactRootContainer.render(React.createElement(Component));
		return;
	}

	try {
		const root = createRoot(container);
		container._reactRootContainer = root;
		root.render(React.createElement(Component));
	} catch (error) {
		console.error(`FotoGrids: Error rendering ${containerId}:`, error);
	}
}

/**
 * The Setup Wizard is page-less - it opens as a full-screen modal over
 * whichever admin page the user is currently on, gated on a URL query
 * param (?fotogrids_setup_step=N). This ensures a body-portal mount
 * point exists for the React tree to render into, then renders the
 * wizard if (and only if) the query param is present.
 *
 * The wizard component reads / writes the query param itself for step
 * persistence and close handling.
 */
function ensureSetupRootAndMount() {
	let host = document.getElementById('fotogrids-setup-root');
	if (!host) {
		host = document.createElement('div');
		host.id = 'fotogrids-setup-root';
		document.body.appendChild(host);
	}

	renderComponent('fotogrids-setup-root', SetupWizardPage);
}

function initializeAdminPages() {
	renderComponent('fotogrids-main-page', Dashboard);
	// Templates page is mounted by the Templates module's own bundle
	// (includes/modules/Templates/assets/templates-page.js).
	renderComponent('fotogrids-stats-page', StatsPage);
	renderComponent('fotogrids-settings-page', PluginSettingsPage);
	renderComponent('fotogrids-tools-page', ToolsPage);
	renderComponent('fotogrids-library-page', LibraryPage);

	// Always mount the wizard - it self-gates on the query param so it
	// renders an empty tree when not active. Mounting unconditionally
	// means opening / closing the wizard is just a URL update, never a
	// full React remount.
	ensureSetupRootAndMount();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeAdminPages);
} else {
	setTimeout(initializeAdminPages, 0);
}

// Expose the param name so other admin surfaces (Settings tab, dashboard
// CTAs, post-activation redirect) can build trigger URLs without
// hard-coding the literal.
window.FotoGridsSetupQueryParam = SETUP_QUERY_PARAM;
