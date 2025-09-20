import React from 'react';
import { render } from 'react-dom';
import AlbumGalleries from './components/AlbumGalleries.js';

// Initialize Album Galleries component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const albumGalleriesRoot = document.getElementById('fotogrids-album-galleries-root');
    
    if (albumGalleriesRoot && window.fotogridsAlbumGalleries) {
        render(React.createElement(AlbumGalleries), albumGalleriesRoot);
    }
});
