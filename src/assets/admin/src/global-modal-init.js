/**
 * FotoGrids Global Modal Initialization.
 *
 * Always-on admin entry that:
 *   1. Mounts a single body-level <ModalRoot /> for imperative modals.
 *   2. Exposes the public modal API at window.FotoGridsAdmin.modal.
 *   3. Conditionally mounts the Pro upgrade modal for non-Pro users.
 *   4. Opens the What's New panel from the admin header link.
 *
 * Enqueued from PHP on every admin page that loads FotoGrids assets - see
 * includes/admin/class-upgrade-modal-integration.php.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModalRoot, installPublicApi } from './components/shared/Modal';
import { installPermissionsApi } from './components/shared/installPermissionsApi';
import UpgradeModal from './components/upgrade-to-pro/UpgradeModal.jsx';
import WhatsNewPanel from './components/whats-new/WhatsNewPanel.jsx';

const MODAL_ROOT_ID = 'fotogrids-modal-root';
const UPGRADE_MODAL_ID = 'fotogrids-upgrade-modal';
const WHATS_NEW_ROOT_ID = 'fotogrids-whats-new-root';
const WHATS_NEW_TRIGGER = '.fotogrids-splash-modal-open';

function ensureContainer(id) {
	let container = document.getElementById(id);
	if (!container) {
		container = document.createElement('div');
		container.id = id;
		document.body.appendChild(container);
	}
	return container;
}

function mountReactRoot(container, element) {
	if (container._reactRootContainer) {
		container._reactRootContainer.render(element);
		return;
	}
	const root = createRoot(container);
	container._reactRootContainer = root;
	root.render(element);
}

function initializeModalRoot() {
	const container = ensureContainer(MODAL_ROOT_ID);
	mountReactRoot(container, React.createElement(ModalRoot));
}

function initializeUpgradeModal() {
	if (window.fotogridsIsPro === true) return;
	if (!window.fotogridsAdmin || !window.fotogridsAdmin.isFotoGridsPage)
		return;

	const container = document.getElementById(UPGRADE_MODAL_ID);
	if (!container) return;

	mountReactRoot(container, React.createElement(UpgradeModal));
}

function renderWhatsNew(isOpen) {
	const container = ensureContainer(WHATS_NEW_ROOT_ID);
	mountReactRoot(
		container,
		React.createElement(WhatsNewPanel, {
			isOpen,
			onClose: () => renderWhatsNew(false),
		})
	);
}

function initializeWhatsNew() {
	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!target || typeof target.closest !== 'function') return;
		if (!target.closest(WHATS_NEW_TRIGGER)) return;

		event.preventDefault();
		renderWhatsNew(true);
	});
}

function bootstrap() {
	installPublicApi();
	installPermissionsApi();
	try {
		initializeModalRoot();
	} catch (error) {
		console.error('FotoGrids: failed to mount ModalRoot', error);
	}
	try {
		initializeUpgradeModal();
	} catch (error) {
		console.error('FotoGrids: failed to mount UpgradeModal', error);
	}
	try {
		initializeWhatsNew();
	} catch (error) {
		console.error("FotoGrids: failed to wire the What's New panel", error);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', bootstrap);
} else {
	bootstrap();
}
