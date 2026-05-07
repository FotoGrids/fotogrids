import React from 'react';
import { createRoot } from 'react-dom/client';
import AlbumAssignment from './components/AlbumAssignment.js';

function initializeAlbumAssignment() {
    const albumAssignmentRoot = document.getElementById('fotogrids-gallery-albums-root');

    if (!albumAssignmentRoot || !window.fotogridsAlbumAssignment) {
        return;
    }

    const root = createRoot(albumAssignmentRoot);
    root.render(React.createElement(AlbumAssignment));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAlbumAssignment);
} else {
    setTimeout(initializeAlbumAssignment, 0);
}
