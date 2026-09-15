import React from 'react';
import { createRoot } from 'react-dom/client';
import AlbumAssignment from './components/AlbumAssignment.js';
import ErrorBoundary from './components/shared/ErrorBoundary';

function initializeAlbumAssignment() {
	const albumAssignmentRoot = document.getElementById(
		'fotogrids-gallery-albums-root'
	);

	if (!albumAssignmentRoot || !window.fotogridsAlbumAssignment) {
		return;
	}

	const root = createRoot(albumAssignmentRoot);
	root.render(
		React.createElement(
			ErrorBoundary,
			{ label: 'album assignment' },
			React.createElement(AlbumAssignment)
		)
	);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeAlbumAssignment);
} else {
	setTimeout(initializeAlbumAssignment, 0);
}
