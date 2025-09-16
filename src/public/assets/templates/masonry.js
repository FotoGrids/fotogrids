/**
 * Masonry Layout JavaScript
 * 
 * Handles masonry layout functionality for FotoGrids galleries
 */

(function() {
    'use strict';
    
    /**
     * Initialize masonry layout
     */
    function initMasonryLayout() {
        const masonryGalleries = document.querySelectorAll('.fotogrids-layout-masonry');
        
        masonryGalleries.forEach(gallery => {
            setupMasonryGallery(gallery);
        });
    }
    
    /**
     * Setup individual masonry gallery
     */
    function setupMasonryGallery(gallery) {
        const galleryId = gallery.getAttribute('data-gallery-id');
        const items = gallery.querySelectorAll('.fotogrids-item');
        
        // Set columns data attribute for CSS
        const columns = getColumnsFromGallery(gallery);
        if (columns) {
            gallery.setAttribute('data-columns', columns);
        }
        
        // Setup lazy loading for masonry images
        if (gallery.classList.contains('fotogrids-lazy')) {
            setupLazyLoading(items, gallery);
        }
        
        // Setup lightbox functionality
        if (gallery.classList.contains('fotogrids-lightbox')) {
            setupLightbox(items, galleryId);
        }
        
        // Handle responsive adjustments
        handleResponsiveMasonry(gallery);
        
        // Optimize masonry layout after images load
        optimizeMasonryLayout(gallery);
        
        // Track gallery view
        trackGalleryView(galleryId, 'masonry');
    }
    
    /**
     * Get columns setting from gallery
     */
    function getColumnsFromGallery(gallery) {
        let columns = gallery.getAttribute('data-columns');
        
        if (!columns) {
            // Intelligent default based on screen size
            const width = window.innerWidth;
            if (width <= 480) columns = 1;
            else if (width <= 767) columns = 2;
            else if (width <= 1023) columns = 3;
            else columns = 4;
        }
        
        return parseInt(columns, 10);
    }
    
    /**
     * Handle responsive masonry adjustments
     */
    function handleResponsiveMasonry(gallery) {
        function adjustMasonry() {
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
            
            // Update CSS column-count
            gallery.style.columnCount = responsiveColumns;
        }
        
        // Initial adjustment
        adjustMasonry();
        
        // Adjust on resize with debouncing
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                adjustMasonry();
                optimizeMasonryLayout(gallery);
            }, 150);
        });
    }
    
    /**
     * Optimize masonry layout after images load
     */
    function optimizeMasonryLayout(gallery) {
        const items = gallery.querySelectorAll('.fotogrids-item');
        let loadedImages = 0;
        const totalImages = items.length;
        
        if (totalImages === 0) return;
        
        items.forEach(item => {
            const img = item.querySelector('img');
            if (!img) {
                loadedImages++;
                checkLayoutComplete();
                return;
            }
            
            if (img.complete) {
                loadedImages++;
                checkLayoutComplete();
            } else {
                img.addEventListener('load', () => {
                    loadedImages++;
                    checkLayoutComplete();
                });
                
                img.addEventListener('error', () => {
                    loadedImages++;
                    checkLayoutComplete();
                });
            }
        });
        
        function checkLayoutComplete() {
            if (loadedImages === totalImages) {
                // All images loaded, optimize layout
                requestAnimationFrame(() => {
                    rebalanceColumns(gallery);
                    gallery.classList.add('masonry-loaded');
                });
            }
        }
    }
    
    /**
     * Rebalance masonry columns for better distribution
     */
    function rebalanceColumns(gallery) {
        const items = Array.from(gallery.querySelectorAll('.fotogrids-item'));
        const columnCount = parseInt(window.getComputedStyle(gallery).columnCount, 10) || 3;
        
        if (columnCount === 1 || items.length <= columnCount) {
            return; // No need to rebalance
        }
        
        // Calculate column heights
        const columns = Array(columnCount).fill(0);
        
        items.forEach((item, index) => {
            const columnIndex = index % columnCount;
            const itemHeight = item.offsetHeight;
            columns[columnIndex] += itemHeight;
        });
        
        // Find if columns are significantly unbalanced
        const maxHeight = Math.max(...columns);
        const minHeight = Math.min(...columns);
        const imbalance = (maxHeight - minHeight) / maxHeight;
        
        // If more than 20% imbalanced, try to reorder items
        if (imbalance > 0.2) {
            reorderMasonryItems(gallery, items, columnCount);
        }
    }
    
    /**
     * Reorder masonry items for better balance
     */
    function reorderMasonryItems(gallery, items, columnCount) {
        // Simple reordering: sort by height and distribute
        const itemsWithHeight = items.map(item => ({
            element: item,
            height: item.offsetHeight
        }));
        
        // Sort by height (tallest first)
        itemsWithHeight.sort((a, b) => b.height - a.height);
        
        // Distribute to columns with least height
        const columns = Array(columnCount).fill().map(() => ({
            height: 0,
            items: []
        }));
        
        itemsWithHeight.forEach(item => {
            // Find column with least height
            const shortestColumn = columns.reduce((prev, current) => 
                prev.height < current.height ? prev : current
            );
            
            shortestColumn.items.push(item.element);
            shortestColumn.height += item.height;
        });
        
        // Reorder DOM elements
        const fragment = document.createDocumentFragment();
        columns.forEach(column => {
            column.items.forEach(item => {
                fragment.appendChild(item);
            });
        });
        
        gallery.appendChild(fragment);
    }
    
    /**
     * Setup lazy loading for masonry images
     */
    function setupLazyLoading(items, gallery) {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('img');
                        if (img && img.getAttribute('loading') === 'lazy') {
                            img.addEventListener('load', () => {
                                img.classList.add('loaded');
                                // Rebalance layout after image loads
                                requestAnimationFrame(() => {
                                    rebalanceColumns(gallery);
                                });
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
        document.addEventListener('DOMContentLoaded', initMasonryLayout);
    } else {
        initMasonryLayout();
    }
    
    // Re-initialize on dynamic content changes
    document.addEventListener('fotogrids:refresh', initMasonryLayout);
    
})();
