/**
 * Justified Layout JavaScript
 * 
 * Handles justified layout functionality for FotoGrids galleries
 */

(function() {
    'use strict';
    
    /**
     * Initialize justified layout
     */
    function initJustifiedLayout() {
        const justifiedGalleries = document.querySelectorAll('.fotogrids-layout-justified');
        
        justifiedGalleries.forEach(gallery => {
            setupJustifiedGallery(gallery);
        });
    }
    
    /**
     * Setup individual justified gallery
     */
    function setupJustifiedGallery(gallery) {
        const galleryId = gallery.getAttribute('data-gallery-id');
        const items = gallery.querySelectorAll('.fotogrids-item');
        
        // Set row height data attribute for CSS
        const rowHeight = getRowHeightFromGallery(gallery);
        if (rowHeight) {
            gallery.setAttribute('data-row-height', rowHeight);
        }
        
        // Setup lazy loading for justified items
        if (gallery.classList.contains('fotogrids-lazy')) {
            setupLazyLoading(items);
        }
        
        // Setup lightbox functionality
        if (gallery.classList.contains('fotogrids-lightbox')) {
            setupLightbox(items, galleryId);
        }
        
        // Calculate and apply justified layout
        calculateJustifiedLayout(gallery);
        
        // Handle responsive adjustments
        handleResponsiveJustified(gallery);
        
        // Track gallery view
        trackGalleryView(galleryId, 'justified');
    }
    
    /**
     * Get row height setting from gallery
     */
    function getRowHeightFromGallery(gallery) {
        let rowHeight = gallery.getAttribute('data-row-height');
        
        if (!rowHeight) {
            // Default based on screen size
            const width = window.innerWidth;
            if (width <= 480) rowHeight = 'small';
            else if (width <= 767) rowHeight = 'small';
            else if (width <= 1023) rowHeight = 'medium';
            else rowHeight = 'medium';
        }
        
        return rowHeight;
    }
    
    /**
     * Calculate justified layout
     */
    function calculateJustifiedLayout(gallery) {
        const items = Array.from(gallery.querySelectorAll('.fotogrids-item'));
        const containerWidth = gallery.offsetWidth;
        const gap = parseInt(window.getComputedStyle(gallery).gap, 10) || 16;
        const targetHeight = getTargetHeight(gallery);
        
        if (containerWidth === 0 || items.length === 0) {
            return;
        }
        
        // Wait for items to load to get aspect ratios
        Promise.all(items.map(item => {
            const img = item.querySelector('img');
            return img ? waitForItemLoad(img) : Promise.resolve();
        })).then(() => {
            justifyRows(gallery, items, containerWidth, gap, targetHeight);
        });
    }
    
    /**
     * Get target height for justified rows
     */
    function getTargetHeight(gallery) {
        const rowHeight = gallery.getAttribute('data-row-height') || 'medium';
        const width = window.innerWidth;
        
        // Base heights
        const heights = {
            small: { mobile: 120, tablet: 150, desktop: 200 },
            medium: { mobile: 150, tablet: 200, desktop: 250 },
            large: { mobile: 180, tablet: 250, desktop: 300 },
            xl: { mobile: 200, tablet: 280, desktop: 350 }
        };
        
        if (width <= 480) return heights[rowHeight].mobile;
        if (width <= 1023) return heights[rowHeight].tablet;
        return heights[rowHeight].desktop;
    }
    
    /**
     * Wait for item to load
     */
    function waitForItemLoad(img) {
        return new Promise(resolve => {
            if (img.complete) {
                resolve();
            } else {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve);
            }
        });
    }
    
    /**
     * Justify rows of items
     */
    function justifyRows(gallery, items, containerWidth, gap, targetHeight) {
        const rows = [];
        let currentRow = [];
        let currentRowWidth = 0;
        
        // Group items into rows
        items.forEach((item, index) => {
            const img = item.querySelector('img');
            const aspectRatio = img ? (img.naturalWidth / img.naturalHeight) || 1.5 : 1.5;
            const itemWidth = targetHeight * aspectRatio;
            
            // Check if adding this item would exceed container width
            const newRowWidth = currentRowWidth + itemWidth + (currentRow.length * gap);
            
            if (newRowWidth > containerWidth && currentRow.length > 0) {
                // Start new row
                rows.push([...currentRow]);
                currentRow = [{ item, aspectRatio, width: itemWidth }];
                currentRowWidth = itemWidth;
            } else {
                // Add to current row
                currentRow.push({ item, aspectRatio, width: itemWidth });
                currentRowWidth += itemWidth;
            }
            
            // If last item, add remaining row
            if (index === items.length - 1 && currentRow.length > 0) {
                rows.push([...currentRow]);
            }
        });
        
        // Apply justified layout to each row
        rows.forEach(row => {
            justifyRow(row, containerWidth, gap, targetHeight);
        });
        
        gallery.classList.add('justified-calculated');
    }
    
    /**
     * Justify a single row of items
     */
    function justifyRow(row, containerWidth, gap, targetHeight) {
        if (row.length === 0) return;
        
        const totalGaps = (row.length - 1) * gap;
        const availableWidth = containerWidth - totalGaps;
        const totalAspectRatio = row.reduce((sum, item) => sum + item.aspectRatio, 0);
        const scaleFactor = availableWidth / (totalAspectRatio * targetHeight);
        
        // Don't scale too much (max 150% of target height)
        const maxScale = 1.5;
        const finalScale = Math.min(scaleFactor, maxScale);
        const finalHeight = targetHeight * finalScale;
        
        // Apply dimensions to items
        row.forEach((rowItem, index) => {
            const { item, aspectRatio } = rowItem;
            const width = finalHeight * aspectRatio;
            
            // Set CSS custom properties for smooth animation
            item.style.width = `${width}px`;
            item.style.height = `${finalHeight}px`;
            item.style.flexGrow = '0';
            item.style.flexShrink = '0';
        });
        
        // If last row is significantly shorter, center it
        if (row.length < 3 && scaleFactor > maxScale) {
            row.forEach(rowItem => {
                rowItem.item.style.marginLeft = 'auto';
                rowItem.item.style.marginRight = 'auto';
            });
        }
    }
    
    /**
     * Handle responsive justified adjustments
     */
    function handleResponsiveJustified(gallery) {
        function adjustJustified() {
            // Recalculate layout on resize
            gallery.classList.remove('justified-calculated');
            requestAnimationFrame(() => {
                calculateJustifiedLayout(gallery);
            });
        }
        
        // Adjust on resize with debouncing
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(adjustJustified, 200);
        });
    }
    
    /**
     * Setup lazy loading for justified items
     */
    function setupLazyLoading(items) {
        if ('IntersectionObserver' in window) {
            const itemObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('img');
                        if (img && img.getAttribute('loading') === 'lazy') {
                            img.addEventListener('load', () => {
                                img.classList.add('loaded');
                                // Recalculate layout after item loads
                                const gallery = entry.target.closest('.fotogrids-layout-justified');
                                if (gallery) {
                                    requestAnimationFrame(() => {
                                        calculateJustifiedLayout(gallery);
                                    });
                                }
                            });
                            
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
                rootMargin: '100px 0px'
            });
            
            items.forEach(item => {
                itemObserver.observe(item);
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
        if (window.FotoGrids && window.FotoGrids.lightbox) {
            window.FotoGrids.lightbox.open(items, startIndex, galleryId);
        } else {
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
                console.debug('FotoGrids: Could not track view', err);
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJustifiedLayout);
    } else {
        initJustifiedLayout();
    }
    
    // Re-initialize on dynamic content changes
    document.addEventListener('fotogrids:refresh', initJustifiedLayout);
    
})();
