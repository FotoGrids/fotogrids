/**
 * Gallery Metabox React App Entry Point
 */


import React from 'react';
import ReactDOM from 'react-dom';
import GalleryMetabox from './components/GalleryMetabox.jsx';

// Initialize icons
function initializeIcons() {
    if (typeof window.FotoGridsIcons === 'undefined') {
        console.warn('FotoGridsIcons not available');
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
            console.warn('Icon not found:', iconName);
            icon.textContent = iconName; // Fallback to text
        }
    });
}

// Initialize the React app when DOM is ready
function initializeGalleryMetabox() {
    try {
        console.log('Initializing Gallery Metabox...');
        
        // Check for React dependencies
        if (typeof React === 'undefined') {
            console.error('React is not available');
            return;
        }
        
        if (typeof ReactDOM === 'undefined') {
            console.error('ReactDOM is not available');
            return;
        }
        
        const container = document.getElementById('fotogrids-gallery-metabox-root');
        
        if (!container) {
            console.error('Gallery metabox container not found');
            return;
        }

        // Get data from PHP
        const metaboxData = window.fotogridsMetaBoxes || {};
        console.log('Metabox data:', metaboxData);
        
        const props = {
            galleryImages: metaboxData.galleryImages || [],
            canEditPosts: metaboxData.canEditPosts || false,
            ajaxUrl: metaboxData.ajaxUrl || '',
            nonce: metaboxData.nonce || '',
            strings: metaboxData.strings || {}
        };

        console.log('Rendering React component with props:', props);

        // Render React component
        ReactDOM.render(React.createElement(GalleryMetabox, props), container);

        // Initialize icons after React has rendered
        setTimeout(() => {
            try {
                initializeIcons();
            } catch (error) {
                console.warn('Failed to initialize icons:', error);
            }
        }, 200);
        
        console.log('Gallery Metabox initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Gallery Metabox:', error);
        
        // Fallback: show basic message
        const container = document.getElementById('fotogrids-gallery-metabox-root');
        if (container) {
            container.innerHTML = '<p>Gallery metabox failed to load. Please refresh the page.</p>';
        }
    }
}

// Initialize when DOM is ready
function safeInitialize() {
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeGalleryMetabox);
        } else {
            // Add a small delay to ensure all scripts are loaded
            setTimeout(initializeGalleryMetabox, 100);
        }
    } catch (error) {
        console.error('Failed to set up Gallery Metabox initialization:', error);
    }
}

// Run safe initialization
safeInitialize();

// Export for potential external use
window.FotoGridsMetabox = {
    init: initializeGalleryMetabox,
    initializeIcons: initializeIcons
};
