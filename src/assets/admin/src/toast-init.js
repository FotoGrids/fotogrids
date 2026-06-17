/**
 * Global Toast Notification System Initialization
 *
 * Initializes the toast notification system on FotoGrids admin pages.
 * This creates a React component that renders toasts and connects it to the global toast manager.
 */
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ToastContainer from './components/toast/ToastContainer';
import toastManager from './toast-manager';

function initializeToasts() {
	if (!window.fotogridsAdmin || !window.fotogridsAdmin.isFotoGridsPage) {
		return;
	}

	let container = document.getElementById('fotogrids-toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'fotogrids-toast-container';
		document.body.appendChild(container);
	}

	if (container._reactRootContainer) {
		return;
	}

	function ToastApp() {
		const [toasts, setToasts] = useState([]);

		useEffect(() => {
			const unsubscribe = toastManager.subscribe((newToasts) => {
				setToasts(newToasts);
			});

			toastManager.notify();

			return unsubscribe;
		}, []);

		const handleDismiss = React.useCallback((id) => {
			toastManager.remove(id);
		}, []);

		return <ToastContainer toasts={toasts} onDismiss={handleDismiss} />;
	}

	try {
		const root = createRoot(container);
		container._reactRootContainer = root;
		root.render(React.createElement(ToastApp));
	} catch (error) {
		console.error('FotoGrids: Error initializing toast system:', error);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeToasts);
} else {
	setTimeout(initializeToasts, 0);
}
