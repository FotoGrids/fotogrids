import React from 'react';
import { render } from 'react-dom';
import AlbumAssignment from './components/AlbumAssignment.js';

// Initialize Album Assignment component when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const albumAssignmentRoot = document.getElementById('fotogrids-gallery-albums-root');
    
    if (albumAssignmentRoot && window.fotogridsAlbumAssignment) {
        render(React.createElement(AlbumAssignment), albumAssignmentRoot);
    }
});
