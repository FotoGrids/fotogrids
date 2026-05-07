/**
 * Gallery Metabox React App Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import GalleryMetabox from './components/GalleryMetabox.jsx';
import { attachCopyButtons } from './utils/copy-to-clipboard.js';

// Initialize icons
function initializeIcons() {
    if (typeof window.FotoGridsIcons === 'undefined') {
        return;
    }

    // Find all icon placeholders and replace with SVG
    const icons = document.querySelectorAll('.fotogrids-icon[data-icon]');
    icons.forEach(function(icon) {
        const iconName = icon.dataset.icon;
        const iconSvg = window.FotoGridsIcons[iconName];

        if (iconSvg) {
            icon.innerHTML = iconSvg;
        } else {
            console.warn('FotoGrids: Icon not found:', iconName);
            icon.textContent = iconName; // Fallback to text
        }
    });
}

function initializeCopyButtons() {
    attachCopyButtons({
        selector: '.fotogrids-shortcode-copy',
        onSuccess(button) {
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 2000);
        },
        onError(button) {
            button.classList.add('copy-error');
            setTimeout(() => button.classList.remove('copy-error'), 2000);
        },
    });
}

// Initialize the React app when DOM is ready
function initializeGalleryMetabox() {
    try {        
        if (typeof React === 'undefined') {
            return;
        }
        
        if (typeof createRoot === 'undefined') {
            return;
        }
        
        const container = document.getElementById('fotogrids-gallery-metabox-root');
        
        if (!container) {
            return;
        }

        const metaboxData = window.fotogridsMetaBoxes || {};
        
        const props = {
            galleryItems: metaboxData.galleryItems || [],
            canEditPosts: metaboxData.canEditPosts || false,
            ajaxUrl: metaboxData.ajaxUrl || '',
            nonce: metaboxData.nonce || '',
            strings: metaboxData.strings || {}
        };

        // Render React component using createRoot (React 18+ API)
        const root = createRoot(container);
        root.render(React.createElement(GalleryMetabox, props));

    } catch (error) {
        const container = document.getElementById('fotogrids-gallery-metabox-root');
        if (container) {
            container.innerHTML = '<p>Gallery metabox failed to load. Please refresh the page.</p>';
        }
    }
}

function runIconsAndCopyButtons() {
    initializeIcons();
    initializeCopyButtons();
}

function safeInitialize() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGalleryMetabox();
            setTimeout(runIconsAndCopyButtons, 300);
        });
    } else {
        setTimeout(() => {
            initializeGalleryMetabox();
            setTimeout(runIconsAndCopyButtons, 300);
        }, 100);
    }
}

safeInitialize();

window.FotoGridsMetabox = {
    init: initializeGalleryMetabox,
    initializeIcons: initializeIcons,
    initializeCopyButtons: initializeCopyButtons
};
