// FotoGrids Frontend JavaScript
// Vanilla ES6+ implementation (no jQuery)

class FotoGrids {
    constructor() {
        this.galleries = [];
        this.lightbox = null;
        this.settings = window.fotogrids || {};
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeGalleries());
        } else {
            this.initializeGalleries();
        }
    }
    
    initializeGalleries() {
        // Find all gallery containers
        const galleryElements = document.querySelectorAll('.fotogrids-gallery');
        
        galleryElements.forEach(element => {
            const gallery = new FotoGridsGallery(element, this.settings);
            this.galleries.push(gallery);
        });
        
        // Initialize lightbox if enabled
        if (this.settings.lightbox) {
            this.initializeLightbox();
        }
        
        // Initialize lazy loading if enabled
        if (this.settings.lazy_load) {
            this.initializeLazyLoading();
        }
    }
    
    initializeLightbox() {
        // Simple lightbox implementation
        this.lightbox = new FotoGridsLightbox();
        
        // Attach lightbox to all gallery images
        document.addEventListener('click', (e) => {
            if (e.target.matches('.fotogrids-lightbox .fotogrids-item img')) {
                e.preventDefault();
                this.lightbox.open(e.target);
            }
        });
    }
    
    initializeLazyLoading() {
        // Use Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            const lazyImages = document.querySelectorAll('.fotogrids-lazy img[data-src]');
            
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            });
            
            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }
}

class FotoGridsGallery {
    constructor(element, settings) {
        this.element = element;
        this.settings = settings;
        this.galleryId = element.dataset.galleryId;
        this.images = [];
        
        this.init();
    }
    
    init() {
        // Get all images in this gallery
        this.images = Array.from(this.element.querySelectorAll('.fotogrids-item img'));
        
        // Track gallery view
        this.trackView();
        
        // Initialize filters if present
        this.initializeFilters();
        
        // Initialize masonry layout if needed
        if (this.element.classList.contains('fotogrids-layout-masonry')) {
            this.initializeMasonry();
        }
    }
    
    trackView() {
        if (!this.settings.stats_tracking || !this.galleryId) {
            return;
        }
        
        // Track gallery view
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
                this.filterImages(button.dataset.filter);
                
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }
    
    filterImages(filter) {
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
        // Simple masonry layout
        const items = this.element.querySelectorAll('.fotogrids-item');
        const columns = parseInt(this.element.dataset.columns) || 3;
        
        // Wait for images to load
        const images = this.element.querySelectorAll('img');
        let loadedImages = 0;
        
        const checkAllLoaded = () => {
            loadedImages++;
            if (loadedImages === images.length) {
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
        const gap = 20; // Gap between items
        
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
        
        // Set container height
        this.element.style.height = Math.max(...columnHeights) + 'px';
    }
}

class FotoGridsLightbox {
    constructor() {
        this.isOpen = false;
        this.currentIndex = 0;
        this.images = [];
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'fotogrids-lightbox-overlay';
        this.element.innerHTML = `
            <div class="fotogrids-lightbox-container">
                <button class="fotogrids-lightbox-close" aria-label="Close">&times;</button>
                <button class="fotogrids-lightbox-prev" aria-label="Previous">&#8249;</button>
                <button class="fotogrids-lightbox-next" aria-label="Next">&#8250;</button>
                <div class="fotogrids-lightbox-content">
                    <img src="" alt="" />
                    <div class="fotogrids-lightbox-caption"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
    }
    
    bindEvents() {
        // Close button
        this.element.querySelector('.fotogrids-lightbox-close').addEventListener('click', () => {
            this.close();
        });
        
        // Navigation buttons
        this.element.querySelector('.fotogrids-lightbox-prev').addEventListener('click', () => {
            this.prev();
        });
        
        this.element.querySelector('.fotogrids-lightbox-next').addEventListener('click', () => {
            this.next();
        });
        
        // Click outside to close
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
            }
        });
    }
    
    open(clickedImage) {
        // Get all images in the same gallery
        const gallery = clickedImage.closest('.fotogrids-gallery');
        this.images = Array.from(gallery.querySelectorAll('.fotogrids-item img'));
        this.currentIndex = this.images.indexOf(clickedImage);
        
        this.showImage();
        this.element.classList.add('active');
        this.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Track image view
        this.trackImageView(clickedImage);
    }
    
    close() {
        this.element.classList.remove('active');
        this.isOpen = false;
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    prev() {
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.images.length - 1;
        this.showImage();
    }
    
    next() {
        this.currentIndex = this.currentIndex < this.images.length - 1 ? this.currentIndex + 1 : 0;
        this.showImage();
    }
    
    showImage() {
        const img = this.images[this.currentIndex];
        const lightboxImg = this.element.querySelector('.fotogrids-lightbox-content img');
        const caption = this.element.querySelector('.fotogrids-lightbox-caption');
        
        // Use full size image if available
        const fullSrc = img.dataset.full || img.src;
        lightboxImg.src = fullSrc;
        lightboxImg.alt = img.alt;
        
        // Show caption if available
        const figcaption = img.closest('.fotogrids-item').querySelector('.fotogrids-caption');
        if (figcaption) {
            caption.textContent = figcaption.textContent;
            caption.style.display = 'block';
        } else {
            caption.style.display = 'none';
        }
        
        // Update navigation button states
        const prevBtn = this.element.querySelector('.fotogrids-lightbox-prev');
        const nextBtn = this.element.querySelector('.fotogrids-lightbox-next');
        
        prevBtn.style.display = this.images.length > 1 ? 'block' : 'none';
        nextBtn.style.display = this.images.length > 1 ? 'block' : 'none';
    }
    
    trackImageView(img) {
        const settings = window.fotogrids || {};
        if (!settings.stats_tracking) {
            return;
        }
        
        const imageId = img.dataset.id;
        if (!imageId) {
            return;
        }
        
        fetch(`${settings.restUrl}stats/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': settings.nonce,
            },
            body: JSON.stringify({
                object_type: 'image',
                object_id: parseInt(imageId),
            }),
        }).catch(error => {
            console.warn('Error tracking image view:', error);
        });
    }
}

// Social sharing functionality
class FotoGridsSharing {
    static trackShare(imageId, network) {
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
                object_type: 'image',
                object_id: parseInt(imageId),
                network: network,
            }),
        }).catch(error => {
            console.warn('Error tracking share:', error);
        });
    }
    
    static shareImage(img, network) {
        const imageUrl = img.dataset.full || img.src;
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
                shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(caption)}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent(caption)}&body=${encodeURIComponent(pageUrl)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(imageUrl).then(() => {
                    // Show success message
                    console.log('Image URL copied to clipboard');
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

// Initialize FotoGrids when script loads
new FotoGrids();
