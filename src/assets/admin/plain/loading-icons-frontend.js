/**
 * Frontend Loading Icons Helper
 * Optimized to only include the selected icon
 * 
 * This file should be dynamically generated or only include the selected icon
 * For best performance, use Loading_Icon_Library::svg() in PHP
 * to output the icon inline in HTML instead of loading this file.
 */
(function() {
    'use strict';
    
    /**
     * Get loading icon SVG
     * @param {string} iconName - The icon name (e.g., 'spinner', 'dots')
     * @returns {string} SVG markup
     */
    window.fotogridsGetLoadingIcon = function(iconName) {
        if (window.fotogridsLoadingIcon && window.fotogridsLoadingIcon[iconName]) {
            return window.fotogridsLoadingIcon[iconName];
        }
        
        return window.fotogridsLoadingIcon?.spinner || '';
    };
    
    /**
     * Render loading icon element
     * @param {string} iconName - The icon name
     * @param {string} className - Additional CSS classes
     * @returns {HTMLElement} The icon element
     */
    window.fotogridsRenderLoadingIcon = function(iconName, className) {
        const iconSvg = window.fotogridsGetLoadingIcon(iconName || 'spinner');
        if (!iconSvg) {
            return null;
        }
        
        const container = document.createElement('span');
        container.className = 'fotogrids-loading-icon' + (className ? ' ' + className : '');
        container.innerHTML = iconSvg;
        return container;
    };
})();

