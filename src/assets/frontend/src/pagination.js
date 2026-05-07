/**
 * FotoGrids Pagination Handler
 *
 * Handles pagination for galleries including:
 * - Load More button
 * - Page navigation
 * - Endless scroll
 */

class FotoGridsPagination {
    constructor(galleryElement) {
        this.gallery = galleryElement;
        this.galleryId = this.gallery.dataset.galleryId;
        this.instanceId = this.gallery.id;
        this.itemsContainer = this.gallery.querySelector('.fotogrids-gallery-items');
        this.paginationType = this.gallery.dataset.paginationType;
        this.paginationMethod = this.gallery.dataset.paginationMethod;
        this.itemsPerPage = parseInt(this.gallery.dataset.itemsPerPage) || 12;
        this.totalItems = parseInt(this.gallery.dataset.totalItems) || 0;
        this.totalPages = parseInt(this.gallery.dataset.totalPages) || 1;
        this.currentPage = parseInt(this.gallery.dataset.currentPage) || 1;
        this.isLoading = false;

        this.settings = window.fotogrids || {};

        if (!this.paginationType || this.paginationType !== 'paginated') {
            return;
        }

        this.init();
    }

    init() {
        switch (this.paginationMethod) {
            case 'load_more':
                this.initLoadMore();
                break;
            case 'pages':
                this.initPages();
                break;
            case 'endless_scroll':
                this.initEndlessScroll();
                break;
        }
    }

    initLoadMore() {
        const loadMoreButton = this.gallery.querySelector('.fotogrids-load-more-button');
        if (!loadMoreButton) return;

        loadMoreButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadNextPage();
        });
    }

    initPages() {
        const pageButtons = this.gallery.querySelectorAll('.fotogrids-page-button');

        pageButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(button.dataset.page);
                if (page && page !== this.currentPage && !this.isLoading) {
                    this.loadPage(page);
                }
            });
        });
    }

    initEndlessScroll() {
        if (!('IntersectionObserver' in window)) {
            // Fallback to load more button if IntersectionObserver is not supported
            this.fallbackToLoadMore();
            return;
        }

        const loader = this.gallery.querySelector('.fotogrids-endless-scroll-loader');
        if (!loader) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.currentPage < this.totalPages && !this.isLoading) {
                    this.loadNextPage();
                }
            });
        }, {
            rootMargin: '200px' // Start loading 200px before reaching the loader
        });

        // Create a sentinel element at the end of the gallery
        const sentinel = document.createElement('div');
        sentinel.className = 'fotogrids-pagination-sentinel';
        this.itemsContainer.appendChild(sentinel);
        observer.observe(sentinel);
    }

    fallbackToLoadMore() {
        // Convert endless scroll to load more button
        const loader = this.gallery.querySelector('.fotogrids-endless-scroll-loader');
        if (loader) {
            loader.innerHTML = '<button type="button" class="fotogrids-load-more-button">' +
                '<span class="fotogrids-load-more-text">' + this.settings.strings?.loadMore || 'Load More' + '</span>' +
                '<span class="fotogrids-load-more-loading" style="display: none;">' + (this.settings.strings?.loading || 'Loading...') + '</span>' +
                '</button>';
            loader.style.display = 'block';
            loader.classList.remove('fotogrids-endless-scroll-loader');
            loader.classList.add('fotogrids-pagination-load-more');

            const button = loader.querySelector('.fotogrids-load-more-button');
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadNextPage();
            });
        }
    }

    async loadNextPage() {
        if (this.currentPage >= this.totalPages || this.isLoading) {
            return;
        }

        await this.loadPage(this.currentPage + 1);
    }

    async loadPage(page) {
        if (this.isLoading || page < 1 || page > this.totalPages) {
            return;
        }

        this.isLoading = true;
        this.showLoading(page);

        try {
            const offset = (page - 1) * this.itemsPerPage;
            const response = await fetch(
                `${this.settings.restUrl}galleries/${this.galleryId}/items?limit=${this.itemsPerPage}&offset=${offset}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load items');
            }

            const items = await response.json();

            if (this.paginationMethod === 'pages') {
                // Replace items for page navigation
                this.replaceItems(items);
                this.updatePageControls(page);
                this.updateCurrentPage(page);
                this.scrollToTop();
            } else {
                // Append items for load more / endless scroll
                this.appendItems(items);
                this.currentPage = page;
                this.updateCurrentPage(page);

                // Hide load more button if we've reached the end
                if (this.currentPage >= this.totalPages) {
                    this.hideLoadMoreButton();
                }
            }

            // Reinitialize gallery features (lightbox, lazy loading, etc.)
            this.reinitializeGallery();

        } catch (error) {
            console.error('Error loading gallery items:', error);
            this.showError();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    replaceItems(items) {
        if (!this.itemsContainer) return;

        // Clear existing items
        this.itemsContainer.innerHTML = '';

        // Add new items
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.itemsContainer.appendChild(itemElement);
        });
    }

    appendItems(items) {
        if (!this.itemsContainer || items.length === 0) return;

        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.itemsContainer.appendChild(itemElement);
        });
    }

    createItemElement(item) {
        // Clone an existing item to get the correct structure and classes
        const existingItem = this.itemsContainer.querySelector('figure.fotogrids-item');
        if (existingItem) {
            const clonedItem = existingItem.cloneNode(false); // Clone without children
            clonedItem.innerHTML = existingItem.innerHTML; // Copy inner HTML structure

            // Update the image source and data attributes
            const img = clonedItem.querySelector('img');
            if (img) {
                img.src = item.medium || item.thumbnail || item.url;
                img.alt = item.alt || item.title || '';
                if (item.full) {
                    img.setAttribute('data-full', item.full);
                }
                if (item.id) {
                    img.setAttribute('data-id', item.id);
                }
            }

            // Update link href if it's a lightbox link
            const link = clonedItem.querySelector('a[data-fotogrids-lightbox], .fotogrids-lightbox-trigger');
            if (link && item.full) {
                link.href = item.full;
                if (item.caption) {
                    link.setAttribute('data-title', item.caption);
                }
            }

            // Update external link if applicable
            const extLink = clonedItem.querySelector('.fotogrids-external-link');
            if (extLink && item.external_url) {
                extLink.href = item.external_url;
            }

            // Update caption if it exists
            const caption = clonedItem.querySelector('.fotogrids-caption');
            if (caption) {
                if (item.caption) {
                    caption.textContent = item.caption;
                } else {
                    caption.remove();
                }
            }

            return clonedItem;
        }

        // Fallback: create basic structure if no existing item found
        const figure = document.createElement('figure');
        figure.className = 'fotogrids-item fotogrids-gallery-item';

        const img = document.createElement('img');
        img.src = item.medium || item.thumbnail || item.url || '';
        img.alt = item.alt || item.title || '';
        img.loading = 'lazy';

        if (item.full) {
            img.setAttribute('data-full', item.full);
        }
        if (item.id) {
            img.setAttribute('data-id', item.id);
        }

        // Check click behavior from gallery element
        const clickBehavior = this.gallery.dataset.clickBehavior || 'lightbox';
        img.setAttribute('data-click-behavior', clickBehavior);

        if (clickBehavior === 'lightbox' || this.gallery.classList.contains('fotogrids-lightbox')) {
            const link = document.createElement('a');
            link.href = item.full || item.url || '#';
            link.className = 'fotogrids-lightbox-trigger';
            link.setAttribute('data-fotogrids-lightbox', '');
            if (item.caption) {
                link.setAttribute('data-title', item.caption);
            }
            link.appendChild(img);
            figure.appendChild(link);
        } else {
            figure.appendChild(img);
        }

        // Add caption if available
        if (item.caption) {
            const caption = document.createElement('figcaption');
            caption.className = 'fotogrids-caption';
            caption.textContent = item.caption;
            figure.appendChild(caption);
        }

        return figure;
    }

    updatePageControls(page) {
        const pagination = this.gallery.querySelector('.fotogrids-pagination-pages');
        if (!pagination) return;

        // Update active page button
        const pageButtons = pagination.querySelectorAll('.fotogrids-page-number');
        pageButtons.forEach(btn => {
            const btnPage = parseInt(btn.dataset.page);
            if (btnPage === page) {
                btn.classList.add('fg-is-active');
            } else {
                btn.classList.remove('fg-is-active');
            }
        });

        // Update prev/next button states
        const prevButton = pagination.querySelector('.fotogrids-page-prev');
        const nextButton = pagination.querySelector('.fotogrids-page-next');

        if (prevButton) {
            if (page > 1) {
                prevButton.style.display = '';
                prevButton.dataset.page = (page - 1).toString();
            } else {
                prevButton.style.display = 'none';
            }
        }

        if (nextButton) {
            if (page < this.totalPages) {
                nextButton.style.display = '';
                nextButton.dataset.page = (page + 1).toString();
            } else {
                nextButton.style.display = 'none';
            }
        }
    }

    updateCurrentPage(page) {
        this.currentPage = page;
        this.gallery.dataset.currentPage = page.toString();
    }

    showLoading(page) {
        if (this.paginationMethod === 'load_more') {
            const button = this.gallery.querySelector('.fotogrids-load-more-button');
            if (button) {
                button.disabled = true;
                const text = button.querySelector('.fotogrids-load-more-text');
                const loading = button.querySelector('.fotogrids-load-more-loading');
                if (text) text.style.display = 'none';
                if (loading) loading.style.display = 'inline';
            }
        } else if (this.paginationMethod === 'endless_scroll') {
            const loader = this.gallery.querySelector('.fotogrids-endless-scroll-loader');
            if (loader) loader.style.display = 'block';
        } else if (this.paginationMethod === 'pages') {
            const pagination = this.gallery.querySelector('.fotogrids-pagination-pages');
            if (pagination) {
                pagination.classList.add('is-loading');
            }
        }
    }

    hideLoading() {
        if (this.paginationMethod === 'load_more') {
            const button = this.gallery.querySelector('.fotogrids-load-more-button');
            if (button) {
                button.disabled = false;
                const text = button.querySelector('.fotogrids-load-more-text');
                const loading = button.querySelector('.fotogrids-load-more-loading');
                if (text) text.style.display = 'inline';
                if (loading) loading.style.display = 'none';
            }
        } else if (this.paginationMethod === 'endless_scroll') {
            const loader = this.gallery.querySelector('.fotogrids-endless-scroll-loader');
            if (loader) loader.style.display = 'none';
        } else if (this.paginationMethod === 'pages') {
            const pagination = this.gallery.querySelector('.fotogrids-pagination-pages');
            if (pagination) {
                pagination.classList.remove('is-loading');
            }
        }
    }

    hideLoadMoreButton() {
        const button = this.gallery.querySelector('.fotogrids-load-more-button');
        if (button) {
            const container = button.closest('.fotogrids-pagination');
            if (container) {
                container.style.display = 'none';
            }
        }
    }

    showError() {
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fotogrids-pagination-error';
        errorDiv.textContent = this.settings.strings?.loadError || 'Failed to load more items. Please try again.';
        this.gallery.appendChild(errorDiv);

        // Remove error after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    scrollToTop() {
        // Scroll to top of gallery when changing pages
        this.gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    reinitializeGallery() {
        // Reinitialize lazy loading for new images
        if (this.settings.lazy_load) {
            const lazyImages = this.itemsContainer.querySelectorAll('img[loading="lazy"]:not(.fotogrids-lazy-loaded)');
            if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.classList.add('fotogrids-lazy-loaded');
                            observer.unobserve(img);
                        }
                    });
                });
                lazyImages.forEach(img => observer.observe(img));
            }
        }

        // Reinitialize lightbox if available
        if (window.FotoGridsLightbox) {
            const lightboxItems = this.itemsContainer.querySelectorAll('[data-lightbox]');
            lightboxItems.forEach(item => {
                // Lightbox should auto-initialize, but we can trigger reinit if needed
            });
        }

        // Reinitialize masonry layout if needed
        if (this.gallery.classList.contains('fotogrids-layout-masonry')) {
            // Trigger masonry relayout if a masonry library is used
            if (window.imagesLoaded) {
                imagesLoaded(this.itemsContainer, () => {
                    // Relayout masonry
                });
            }
        }
    }
}

// Initialize pagination for all paginated galleries
document.addEventListener('DOMContentLoaded', () => {
    const paginatedGalleries = document.querySelectorAll('.fotogrids-paginated');
    paginatedGalleries.forEach(gallery => {
        new FotoGridsPagination(gallery);
    });
});

// Also initialize for dynamically loaded galleries
if (window.FotoGrids) {
    const originalInit = window.FotoGrids.prototype.initializeGalleries;
    window.FotoGrids.prototype.initializeGalleries = function() {
        originalInit.call(this);

        // Initialize pagination for any new galleries
        const paginatedGalleries = document.querySelectorAll('.fotogrids-paginated:not([data-pagination-initialized])');
        paginatedGalleries.forEach(gallery => {
            gallery.setAttribute('data-pagination-initialized', 'true');
            new FotoGridsPagination(gallery);
        });
    };
}










