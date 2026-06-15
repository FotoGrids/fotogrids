import React from 'react';
import { createRoot } from 'react-dom/client';
import AlbumGalleries from './components/AlbumGalleries.jsx';

function initializeAlbumGalleries() {
	const albumGalleriesRoot = document.getElementById(
		'fotogrids-album-galleries-root',
	);

	if (albumGalleriesRoot && window.fotogridsAlbumGalleries) {
		const root = createRoot(albumGalleriesRoot);
		root.render(React.createElement(AlbumGalleries));
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeAlbumGalleries);
} else {
	setTimeout(initializeAlbumGalleries, 0);
}
