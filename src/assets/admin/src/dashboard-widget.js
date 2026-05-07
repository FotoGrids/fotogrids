/**
 * FotoGrids Dashboard Widget JavaScript
 */

(function() {
    'use strict';
    
    const { restUrl, restNonce, pluginUrl } = window.fotogridsDashboard || {};
    
    if (!restUrl) {
        return;
    }
    
    // Configure API fetch with nonce
    if (typeof wp !== 'undefined' && wp.apiFetch) {
        wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(restNonce));
    }
    
    /**
     * Load news and updates
     * 
     * Note: Stats and recently edited are now loaded server-side in PHP
     */
    async function loadNews() {
        const container = document.getElementById('fotogrids-dw-news-list');
        if (!container) {
            return;
        }
        
        try {
            const response = await wp.apiFetch({
                path: restUrl + 'admin/news'
            });
            
            // Handle response - wp.apiFetch returns the data directly from rest_ensure_response
            let news = response;
            
            // Debug: log the response to see what we're getting
            if (typeof console !== 'undefined' && console.log) {
                console.log('News response:', news, 'Type:', typeof news, 'Is Array:', Array.isArray(news));
            }
            
            // Ensure we have an array
            if (!Array.isArray(news)) {
                // If it's not an array, try to extract it
                if (news && typeof news === 'object') {
                    // Check various possible response formats
                    if (news.data && Array.isArray(news.data)) {
                        news = news.data;
                    } else if (Array.isArray(Object.values(news)[0])) {
                        news = Object.values(news)[0];
                    } else {
                        // Not an array, treat as empty
                        console.warn('News response is not an array:', news);
                        news = [];
                    }
                } else {
                    news = [];
                }
            }
            
            // Final check - ensure it's an array before using forEach
            if (!Array.isArray(news)) {
                console.error('News is still not an array after processing:', news);
                container.innerHTML = '<div class="fotogrids-dw-empty">' + 
                    'Unable to load news and updates.' + 
                    '</div>';
                return;
            }
            
            if (news.length === 0) {
                container.innerHTML = '<div class="fotogrids-dw-empty">' + 
                    'No news available at this time.' + 
                    '</div>';
                return;
            }
            
            let html = '';
            news.forEach(item => {
                html += `
                    <div class="fotogrids-dw-news-item">
                        <div class="fotogrids-dw-news-item-title">
                            <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
                                ${escapeHtml(item.title || 'Untitled')}
                            </a>
                        </div>
                        <div class="fotogrids-dw-news-item-description">
                            ${escapeHtml(item.description || '')}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading news:', error);
            container.innerHTML = '<div class="fotogrids-dw-empty">' + 
                'Unable to load news and updates.' + 
                '</div>';
        }
    }
    
    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Initialize when DOM is ready
     */
    function init() {
        // Check if we're on the dashboard
        if (!document.getElementById('fotogrids-dw-news-list')) {
            return;
        }
        
        // Only load news (stats and recently edited are loaded server-side)
        loadNews();
    }
    
    // Wait for DOM and wp.apiFetch
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Wait a bit for wp.apiFetch to be available
            setTimeout(init, 100);
        });
    } else {
        setTimeout(init, 100);
    }
})();









