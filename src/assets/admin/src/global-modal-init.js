/**
 * FotoGrids Global Modal Initialization - Simple Version
 */

import React from 'react';
import { createRoot } from '@wordpress/element';
import UpgradeModal from './components/upgrade-to-pro/UpgradeModal.jsx';

function initializeUpgradeModal() {
    console.log('FotoGrids: initializeUpgradeModal called');
    console.log('FotoGrids: window.fotogridsIsPro =', window.fotogridsIsPro);
    console.log('FotoGrids: body classes =', document.body.className);
    console.log('FotoGrids: current URL =', window.location.href);
    
    // Don't initialize for Pro users or non-admin pages
    if (window.fotogridsIsPro === true || !document.body.classList.contains('wp-admin')) {
        console.log('FotoGrids: Skipping modal init - Pro user or not admin');
        return;
    }

    // Check if this is a FotoGrids page
    const isFotoGridsPage = 
        document.body.classList.contains('post-type-fotogrids_gallery') ||
        document.body.classList.contains('post-type-fotogrids_album') ||
        window.location.href.includes('fotogrids') ||
        document.querySelector('[class*="fotogrids"]');
    
    console.log('FotoGrids: isFotoGridsPage =', isFotoGridsPage);
    console.log('FotoGrids: Found fotogrids elements =', document.querySelectorAll('[class*="fotogrids"]').length);
    
    if (!isFotoGridsPage) {
        console.log('FotoGrids: Not a FotoGrids page, skipping modal init');
        return;
    }

    console.log('FotoGrids: Initializing upgrade modal...');
    console.log('FotoGrids: Modal data available =', !!window.fotogridsUpgradeModal);
    console.log('FotoGrids: Modal benefits =', window.fotogridsUpgradeModal?.benefits?.length || 0);

    // Create and render modal
    const container = document.createElement('div');
    container.id = 'fotogrids-upgrade-modal';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '999999';
    
    document.body.appendChild(container);
    console.log('FotoGrids: Modal container added to DOM');
    
    const root = createRoot(container);
    root.render(React.createElement(UpgradeModal));
    console.log('FotoGrids: Modal React component rendered');
    
}

// Initialize when ready
console.log('FotoGrids: global-modal-init.js loaded, document.readyState =', document.readyState);

if (document.readyState === 'loading') {
    console.log('FotoGrids: Adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('FotoGrids: DOMContentLoaded fired');
        initializeUpgradeModal();
    });
} else {
    console.log('FotoGrids: DOM already ready, initializing immediately');
    initializeUpgradeModal();
}
