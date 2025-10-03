class FotoGrids {
    constructor() {
        this.galleries = [];
        this.lightbox = null;
        this.settings = window.fotogrids || {};
        
        this.init();
    }
    
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeGalleries());
        } else {
            this.initializeGalleries();
        }
    }
    
    initializeGalleries() {
        const galleryElements = document.querySelectorAll('.fotogrids-gallery');
        
        galleryElements.forEach(element => {
            const gallery = new FotoGridsGallery(element, this.settings);
            this.galleries.push(gallery);
        });
        
        if (this.settings.lightbox) {
            this.initializeLightbox();
        }
        
        if (this.settings.lazy_load) {
            this.initializeLazyLoading();
        } else {
            const lazyContainers = document.querySelectorAll('.fotogrids-lazy');
            if (lazyContainers.length > 0) {
                this.initializeLazyLoading();
            }
        }
    }
    
    initializeLightbox() {
        // Lightbox functionality is now handled by a separate lightbox.js file
        // This method is kept for backward compatibility but does nothing
        // The lightbox.js file will auto-initialize when loaded
    }
    
    initializeLazyLoading() {
        const lazyImages = document.querySelectorAll('.fotogrids-lazy img[loading="lazy"]');
        
        if ('IntersectionObserver' in window) {
            const itemObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        img.addEventListener('load', () => {
                            img.classList.add('fotogrids-lazy-loaded');
                        });
                        
                        if (img.complete) {
                            img.classList.add('fotogrids-lazy-loaded');
                        }
                        
                        observer.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => itemObserver.observe(img));
        } else {
            lazyImages.forEach(img => {
                img.classList.add('fotogrids-lazy-loaded');
            });
        }
        
        const dataSrcImages = document.querySelectorAll('.fotogrids-lazy img[data-src]');
        if (dataSrcImages.length > 0) {
            const dataSrcObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        img.classList.add('fotogrids-lazy-loaded');
                        observer.unobserve(img);
                    }
                });
            });
            
            dataSrcImages.forEach(img => dataSrcObserver.observe(img));
        }
    }
}

class FotoGridsGallery {
    constructor(element, settings) {
        this.element = element;
        this.settings = settings;
        this.galleryId = element.dataset.galleryId;
        this.items = [];
        
        this.init();
    }
    
    init() {
        this.items = Array.from(this.element.querySelectorAll('.fotogrids-item img'));
        
        this.trackView();
        
        this.initializeFilters();
        
        if (this.element.classList.contains('fotogrids-layout-masonry')) {
            this.initializeMasonry();
        }
    }
    
    trackView() {
        if (!this.settings.stats_tracking || !this.galleryId) {
            return;
        }
        
        fetch(`${this.settings.restUrl}stats/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': this.settings.nonce,
            },
            body: JSON.stringify({
                object_type: 'gallery',
                object_id: parseInt(this.galleryId),
            }),
        }).catch(error => {
            console.warn('Error tracking gallery view:', error);
        });
    }
    
    initializeFilters() {
        const filterContainer = this.element.querySelector('.fotogrids-filters');
        if (!filterContainer) {
            return;
        }
        
        const filterButtons = filterContainer.querySelectorAll('[data-filter]');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterItems(button.dataset.filter);
                
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }
    
    filterItems(filter) {
        const items = this.element.querySelectorAll('.fotogrids-item');
        
        items.forEach(item => {
            if (filter === 'all' || item.dataset.tags?.includes(filter)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    initializeMasonry() {
        const items = this.element.querySelectorAll('.fotogrids-item');
        const columns = parseInt(this.element.dataset.columns) || 3;
        
        const images = this.element.querySelectorAll('img');
        let loadedItems = 0;
        
        const checkAllLoaded = () => {
            loadedItems++;
            if (loadedItems === images.length) {
                this.layoutMasonry(items, columns);
            }
        };
        
        images.forEach(img => {
            if (img.complete) {
                checkAllLoaded();
            } else {
                img.addEventListener('load', checkAllLoaded);
                img.addEventListener('error', checkAllLoaded);
            }
        });
    }
    
    layoutMasonry(items, columns) {
        const columnHeights = new Array(columns).fill(0);
        const gap = 20;
        
        items.forEach((item, index) => {
            const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
            const left = (shortestColumn * (100 / columns)) + '%';
            const top = columnHeights[shortestColumn] + 'px';
            
            item.style.position = 'absolute';
            item.style.left = left;
            item.style.top = top;
            item.style.width = `calc(${100 / columns}% - ${gap}px)`;
            
            columnHeights[shortestColumn] += item.offsetHeight + gap;
        });
        
        this.element.style.height = Math.max(...columnHeights) + 'px';
    }
}

class FotoGridsSharing {
    static trackShare(itemId, network) {
        const settings = window.fotogrids || {};
        if (!settings.stats_tracking) {
            return;
        }
        
        fetch(`${settings.restUrl}stats/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': settings.nonce,
            },
            body: JSON.stringify({
                object_type: 'item',
                object_id: parseInt(itemId),
                network: network,
            }),
        }).catch(error => {
            console.warn('Error tracking share:', error);
        });
    }
    
    static shareItem(img, network) {
        const itemUrl = img.dataset.full || img.src;
        const caption = img.alt || '';
        const pageUrl = window.location.href;
        
        let shareUrl = '';
        
        switch (network) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(caption)}`;
                break;
            case 'pinterest':
                shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(itemUrl)}&description=${encodeURIComponent(caption)}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(pageUrl)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(itemUrl).then(() => {
                });
                this.trackShare(img.dataset.id, network);
                return;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
            this.trackShare(img.dataset.id, network);
        }
    }
}

new FotoGrids();
