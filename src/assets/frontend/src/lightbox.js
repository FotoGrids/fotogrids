/**
 * FotoGrids Lightbox
 * 
 * Standalone lightbox implementation for FotoGrids galleries
 * Supports all interaction settings and themes
 */

class FotoGridsLightbox {
    constructor(gallery) {
        this.gallery = gallery;
        this.isOpen = false;
        this.currentIndex = 0;
        this.images = [];
        this.autoProgressTimer = null;
        this.element = null;
        
        // Get settings from gallery data attributes
        this.settings = {
            theme: gallery.dataset.lightboxTheme || 'dark',
            transition: gallery.dataset.lightboxTransition || 'fade',
            duration: parseInt(gallery.dataset.lightboxDuration) || 300,
            autoProgress: gallery.dataset.lightboxAutoProgress === 'true',
            autoDelay: parseInt(gallery.dataset.lightboxAutoDelay) || 5,
            fitMedia: gallery.dataset.lightboxFitMedia !== 'false',
            mobileLayout: gallery.dataset.lightboxMobileLayout || 'mobile_optimized',
            showArrows: gallery.dataset.lightboxShowArrows !== 'false',
            arrowIcon: gallery.dataset.lightboxArrowIcon || 'chevron',
            arrowSize: parseInt(gallery.dataset.lightboxArrowSize) || 40,
            arrowColor: gallery.dataset.lightboxArrowColor || '#ffffff',
            showDots: gallery.dataset.lightboxShowDots === 'true',
            dotStyle: gallery.dataset.lightboxDotStyle || 'fill',
            dotColor: gallery.dataset.lightboxDotColor || '#ffffff',
            activeDotColor: gallery.dataset.lightboxActiveDotColor || '#007cba',
            dotsSpacing: gallery.dataset.lightboxDotsSpacing || '8px',
            customColor: gallery.dataset.lightboxCustomColor || '#000000'
        };
        
        this.createElement();
        this.bindEvents();
    }
    
    createElement() {
        this.element = document.createElement('div');
        this.element.className = `fotogrids-lightbox-overlay fotogrids-theme-${this.settings.theme} fotogrids-transition-${this.settings.transition}`;
        
        // Apply custom color if theme is custom
        if (this.settings.theme === 'custom') {
            this.element.style.setProperty('--lightbox-custom-color', this.settings.customColor);
        }
        
        // Build arrow icons based on settings
        const arrowIcons = {
            chevron: { prev: '‹', next: '›' },
            arrow: { prev: '←', next: '→' },
            triangle: { prev: '◀', next: '▶' }
        };
        
        const arrows = arrowIcons[this.settings.arrowIcon] || arrowIcons.chevron;
        
        this.element.innerHTML = `
            <div class="fotogrids-lightbox-container">
                <button class="fotogrids-lightbox-close" aria-label="Close" title="Close (Esc)">&times;</button>
                ${this.settings.showArrows ? `
                    <button class="fotogrids-lightbox-prev" aria-label="Previous" title="Previous (←)" style="color: ${this.settings.arrowColor}; font-size: ${this.settings.arrowSize}px;">${arrows.prev}</button>
                    <button class="fotogrids-lightbox-next" aria-label="Next" title="Next (→)" style="color: ${this.settings.arrowColor}; font-size: ${this.settings.arrowSize}px;">${arrows.next}</button>
                ` : ''}
                <div class="fotogrids-lightbox-content ${this.settings.fitMedia ? 'fit-media' : ''}">
                    <img src="" alt="" />
                    <div class="fotogrids-lightbox-caption"></div>
                </div>
                ${this.settings.showDots ? '<div class="fotogrids-lightbox-dots"></div>' : ''}
            </div>
        `;
        
        // Apply mobile layout class
        if (this.settings.mobileLayout === 'mobile_optimized') {
            this.element.classList.add('mobile-optimized');
        }
        
        document.body.appendChild(this.element);
    }
    
    bindEvents() {
        // Close button
        this.element.querySelector('.fotogrids-lightbox-close').addEventListener('click', () => {
            this.close();
        });
        
        // Navigation buttons (only if they exist)
        const prevBtn = this.element.querySelector('.fotogrids-lightbox-prev');
        const nextBtn = this.element.querySelector('.fotogrids-lightbox-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.prev();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.next();
            });
        }
        
        // Click outside to close
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });
        
        // Keyboard navigation
        this.keydownHandler = (e) => {
            if (!this.isOpen) return;
            
            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    if (this.settings.showArrows) {
                        this.prev();
                    }
                    break;
                case 'ArrowRight':
                    if (this.settings.showArrows) {
                        this.next();
                    }
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keydownHandler);
        
        // Dots navigation (if enabled)
        if (this.settings.showDots) {
            this.element.addEventListener('click', (e) => {
                if (e.target.matches('.fotogrids-lightbox-dot')) {
                    const index = parseInt(e.target.dataset.index);
                    this.goToImage(index);
                }
            });
        }
    }
    
    open(clickedImage) {
        // Get all images in the same gallery
        this.images = Array.from(this.gallery.querySelectorAll('.fotogrids-item img'));
        this.currentIndex = this.images.indexOf(clickedImage);
        
        // Set transition duration
        this.element.style.setProperty('--transition-duration', this.settings.duration + 'ms');
        
        this.showImage();
        this.buildDots();
        this.element.classList.add('active');
        this.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Start auto progress if enabled
        if (this.settings.autoProgress && this.images.length > 1) {
            this.startAutoProgress();
        }
        
        // Track image view
        this.trackImageView(clickedImage);
        
        // Focus management for accessibility
        this.element.focus();
    }
    
    close() {
        this.element.classList.remove('active');
        this.isOpen = false;
        
        // Stop auto progress
        this.stopAutoProgress();
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Return focus to the clicked image
        if (this.images[this.currentIndex]) {
            this.images[this.currentIndex].focus();
        }
    }
    
    prev() {
        this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.images.length - 1;
        this.showImage();
        this.updateDots();
        
        // Restart auto progress if enabled
        if (this.settings.autoProgress) {
            this.startAutoProgress();
        }
    }
    
    next() {
        this.currentIndex = this.currentIndex < this.images.length - 1 ? this.currentIndex + 1 : 0;
        this.showImage();
        this.updateDots();
        
        // Restart auto progress if enabled
        if (this.settings.autoProgress) {
            this.startAutoProgress();
        }
    }
    
    goToImage(index) {
        this.currentIndex = index;
        this.showImage();
        this.updateDots();
        
        // Restart auto progress if enabled
        if (this.settings.autoProgress) {
            this.startAutoProgress();
        }
    }
    
    startAutoProgress() {
        this.stopAutoProgress();
        this.autoProgressTimer = setTimeout(() => {
            if (this.isOpen) {
                this.next();
            }
        }, this.settings.autoDelay * 1000);
    }
    
    stopAutoProgress() {
        if (this.autoProgressTimer) {
            clearTimeout(this.autoProgressTimer);
            this.autoProgressTimer = null;
        }
    }
    
    buildDots() {
        if (!this.settings.showDots) return;
        
        const dotsContainer = this.element.querySelector('.fotogrids-lightbox-dots');
        if (!dotsContainer) return;
        
        dotsContainer.innerHTML = '';
        dotsContainer.style.setProperty('--dot-spacing', this.settings.dotsSpacing);
        
        this.images.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = `fotogrids-lightbox-dot fotogrids-dot-${this.settings.dotStyle}`;
            dot.dataset.index = index;
            dot.setAttribute('aria-label', `Go to image ${index + 1}`);
            dot.style.setProperty('--dot-color', this.settings.dotColor);
            dot.style.setProperty('--active-dot-color', this.settings.activeDotColor);
            dotsContainer.appendChild(dot);
        });
        
        this.updateDots();
    }
    
    updateDots() {
        if (!this.settings.showDots) return;
        
        const dots = this.element.querySelectorAll('.fotogrids-lightbox-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
            dot.setAttribute('aria-pressed', index === this.currentIndex);
        });
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
        
        // Update navigation button states (only if they exist)
        const prevBtn = this.element.querySelector('.fotogrids-lightbox-prev');
        const nextBtn = this.element.querySelector('.fotogrids-lightbox-next');
        
        if (prevBtn) {
            prevBtn.style.display = this.images.length > 1 && this.settings.showArrows ? 'block' : 'none';
        }
        if (nextBtn) {
            nextBtn.style.display = this.images.length > 1 && this.settings.showArrows ? 'block' : 'none';
        }
        
        // Update counter for screen readers
        this.element.setAttribute('aria-label', `Image ${this.currentIndex + 1} of ${this.images.length}`);
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
            console.warn('FotoGrids: Error tracking image view:', error);
        });
    }
    
    destroy() {
        // Clean up event listeners
        document.removeEventListener('keydown', this.keydownHandler);
        
        // Remove element from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Stop any running timers
        this.stopAutoProgress();
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

/**
 * FotoGrids Lightbox Manager
 * Handles initialization and management of lightbox instances
 */
class FotoGridsLightboxManager {
    constructor() {
        this.lightboxes = new Map();
        this.init();
    }
    
    init() {
        // Initialize lightbox for galleries that use lightbox interaction
        this.initializeLightboxGalleries();
        
        // Watch for dynamically added galleries
        if (window.MutationObserver) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const galleries = node.matches && node.matches('.fotogrids-gallery') ? 
                                [node] : 
                                node.querySelectorAll ? node.querySelectorAll('.fotogrids-gallery') : [];
                            
                            galleries.forEach((gallery) => {
                                this.initializeLightboxForGallery(gallery);
                            });
                        }
                    });
                });
            });
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    initializeLightboxGalleries() {
        const lightboxGalleries = document.querySelectorAll('.fotogrids-gallery[data-click-behavior="lightbox"], .fotogrids-gallery.fotogrids-lightbox');
        
        lightboxGalleries.forEach((gallery) => {
            this.initializeLightboxForGallery(gallery);
        });
    }
    
    initializeLightboxForGallery(gallery) {
        const galleryId = gallery.dataset.galleryId || gallery.id;
        
        // Skip if already initialized
        if (this.lightboxes.has(galleryId)) {
            return;
        }
        
        const clickBehavior = gallery.dataset.clickBehavior || 'lightbox';
        
        // Only initialize lightbox for galleries with lightbox click behavior
        if (clickBehavior !== 'lightbox' && !gallery.classList.contains('fotogrids-lightbox')) {
            return;
        }
        
        const lightbox = new FotoGridsLightbox(gallery);
        this.lightboxes.set(galleryId, lightbox);
        
        // First, add event listeners directly to lightbox trigger links to prevent default behavior
        const lightboxTriggers = gallery.querySelectorAll('.fotogrids-lightbox-trigger');
        lightboxTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                const img = trigger.querySelector('img');
                if (img) {
                    lightbox.open(img);
                }
                return false;
            }, true); // Use capturing phase
        });
        
        // Then add general click handlers with capturing to intercept before other handlers
        gallery.addEventListener('click', (e) => {
            // Handle different click scenarios
            // Check if clicked element or its parent is a lightbox trigger
            const lightboxTrigger = e.target.closest('.fotogrids-lightbox-trigger');
            if (lightboxTrigger) {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent ALL other handlers from running
                const img = lightboxTrigger.querySelector('img');
                if (img) {
                    lightbox.open(img);
                }
                return false; // Ensure event is fully stopped
            }
            
            // Handle clicks anywhere within a lightbox gallery item
            const lightboxItem = e.target.closest('.fotogrids-item');
            if (lightboxItem) {
                const galleryElement = lightboxItem.closest('.fotogrids-gallery');
                const clickBehavior = galleryElement ? galleryElement.dataset.clickBehavior : null;
                
                if (clickBehavior === 'lightbox' || galleryElement.classList.contains('fotogrids-lightbox')) {
                    e.preventDefault();
                    e.stopImmediatePropagation(); // Prevent ALL other handlers from running
                    
                    const img = lightboxItem.querySelector('img');
                    if (img) {
                        lightbox.open(img);
                    }
                    return false; // Ensure event is fully stopped
                }
            }
            
            // Handle direct image clicks in lightbox galleries (fallback)
            if (e.target.matches('.fotogrids-item-lightbox img') || 
                e.target.matches('.fotogrids-lightbox .fotogrids-item img')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                lightbox.open(e.target);
                return false;
            }
        }, true); // Use capturing phase to intercept early
        
        // Add keyboard support for gallery items
        const items = gallery.querySelectorAll('.fotogrids-item');
        items.forEach((item) => {
            item.setAttribute('tabindex', '0');
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const img = item.querySelector('img');
                    if (img) {
                        lightbox.open(img);
                    }
                }
            });
        });
    }
    
    destroyLightbox(galleryId) {
        const lightbox = this.lightboxes.get(galleryId);
        if (lightbox) {
            lightbox.destroy();
            this.lightboxes.delete(galleryId);
        }
    }
    
    destroyAll() {
        this.lightboxes.forEach((lightbox) => {
            lightbox.destroy();
        });
        this.lightboxes.clear();
        
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Auto-initialize when DOM is ready
let lightboxManager;

function initFotoGridsLightbox() {
    if (!lightboxManager) {
        lightboxManager = new FotoGridsLightboxManager();
    }
}

// Initialize based on document state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFotoGridsLightbox);
} else {
    initFotoGridsLightbox();
}

// Export for external use
window.FotoGridsLightbox = FotoGridsLightbox;
window.FotoGridsLightboxManager = FotoGridsLightboxManager;
