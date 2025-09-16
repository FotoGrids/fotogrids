/**
 * Grid Layout JavaScript
 * 
 * Handles grid layout functionality for FotoGrids galleries
 */

(function() {
    'use strict';
    
    /**
     * Initialize grid layout
     */
    function initGridLayout() {
        const gridGalleries = document.querySelectorAll('.fotogrids-layout-grid');
        
        gridGalleries.forEach(gallery => {
            setupGridGallery(gallery);
        });
    }
    
    /**
     * Setup individual grid gallery
     */
    function setupGridGallery(gallery) {
        const galleryId = gallery.getAttribute('data-gallery-id');
        const items = gallery.querySelectorAll('.fotogrids-item');
        
        // Set columns data attribute for CSS
        const columns = getColumnsFromGallery(gallery);
        if (columns) {
            gallery.setAttribute('data-columns', columns);
        }
        
        // Setup lazy loading for grid images
        if (gallery.classList.contains('fotogrids-lazy')) {
            setupLazyLoading(items);
        }
        
        // Setup lightbox functionality
        if (gallery.classList.contains('fotogrids-lightbox')) {
            setupLightbox(items, galleryId);
        }
        
        // Handle responsive adjustments
        handleResponsiveGrid(gallery);
        
        // Track gallery view
        trackGalleryView(galleryId, 'grid');
    }
    
    /**
     * Get columns setting from gallery
     */
    function getColumnsFromGallery(gallery) {
        // Try to get from data attribute first
        let columns = gallery.getAttribute('data-columns');
        
        if (!columns) {
            // Count items and make intelligent guess
            const itemCount = gallery.querySelectorAll('.fotogrids-item').length;
            if (itemCount <= 2) columns = itemCount;
            else if (itemCount <= 6) columns = 3;
            else if (itemCount <= 12) columns = 4;
            else columns = 4; // Default for large galleries
        }
        
        return parseInt(columns, 10);
    }
    
    /**
     * Handle responsive grid adjustments
     */
    function handleResponsiveGrid(gallery) {
        function adjustGrid() {
            const width = window.innerWidth;
            const originalColumns = parseInt(gallery.getAttribute('data-columns'), 10) || 3;
            let responsiveColumns = originalColumns;
            
            // Adjust columns based on screen size
            if (width <= 480) {
                responsiveColumns = 1;
            } else if (width <= 767) {
                responsiveColumns = Math.min(2, originalColumns);
            } else if (width <= 1023) {
                responsiveColumns = Math.min(3, originalColumns);
            }
            
            gallery.style.setProperty('--responsive-columns', responsiveColumns);
        }
        
        // Initial adjustment
        adjustGrid();
        
        // Adjust on resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(adjustGrid, 150);
        });
    }
    
    /**
     * Setup lazy loading for images
     */
    function setupLazyLoading(items) {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('img');
                        if (img && img.getAttribute('loading') === 'lazy') {
                            img.addEventListener('load', () => {
                                img.classList.add('loaded');
                            });
                            
                            // Trigger load if not already loaded
                            if (!img.complete) {
                                img.src = img.src;
                            } else {
                                img.classList.add('loaded');
                            }
                        }
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px'
            });
            
            items.forEach(item => {
                imageObserver.observe(item);
            });
        } else {
            // Fallback for browsers without IntersectionObserver
            items.forEach(item => {
                const img = item.querySelector('img');
                if (img) {
                    img.classList.add('loaded');
                }
            });
        }
    }
    
    /**
     * Setup lightbox functionality
     */
    function setupLightbox(items, galleryId) {
        items.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                openLightbox(items, index, galleryId);
            });
            
            // Add keyboard support
            item.setAttribute('tabindex', '0');
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(items, index, galleryId);
                }
            });
        });
    }
    
    /**
     * Open lightbox (placeholder - will be implemented in main frontend.js)
     */
    function openLightbox(items, startIndex, galleryId) {
        // This will be handled by the main FotoGrids lightbox
        if (window.FotoGrids && window.FotoGrids.lightbox) {
            window.FotoGrids.lightbox.open(items, startIndex, galleryId);
        } else {
            // Fallback - open image in new tab
            const img = items[startIndex].querySelector('img');
            const fullUrl = img.getAttribute('data-full') || img.src;
            window.open(fullUrl, '_blank');
        }
    }
    
    /**
     * Track gallery view for statistics
     */
    function trackGalleryView(galleryId, layout) {
        if (window.fotogrids && window.fotogrids.restUrl) {
            fetch(window.fotogrids.restUrl + 'stats/view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': window.fotogrids.nonce
                },
                body: JSON.stringify({
                    gallery_id: galleryId,
                    event_type: 'gallery_view',
                    event_data: { layout: layout }
                })
            }).catch(err => {
                // Silently fail - don't break the gallery
                console.debug('FotoGrids: Could not track view', err);
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGridLayout);
    } else {
        initGridLayout();
    }
    
    // Re-initialize on dynamic content changes
    document.addEventListener('fotogrids:refresh', initGridLayout);
    
})();
