/**
 * API Helper Utilities
 */

/**
 * Check if WordPress API is available
 */
export const isApiAvailable = () => {
	return typeof wp !== 'undefined' && typeof wp.apiFetch !== 'undefined';
};

/**
 * Fetch galleries from API
 */
export const fetchGalleries = (searchTerm = '') => {
	if (!isApiAvailable()) {
		return Promise.resolve({ galleries: [] });
	}

	const params = new URLSearchParams();
	if (searchTerm) params.append('search', searchTerm);

	return wp
		.apiFetch({
			path: `/fotogrids/v1/admin/galleries?${params.toString()}`,
			method: 'GET',
		})
		.catch(error => {
			console.error('Error fetching galleries:', error);
			return { galleries: [] };
		});
};

/**
 * Fetch albums from API
 */
export const fetchAlbums = (searchTerm = '') => {
	if (!isApiAvailable()) {
		return Promise.resolve({ albums: [] });
	}

	const params = new URLSearchParams();
	if (searchTerm) params.append('search', searchTerm);

	return wp
		.apiFetch({
			path: `/fotogrids/v1/admin/albums?${params.toString()}`,
			method: 'GET',
		})
		.catch(error => {
			console.error('Error fetching albums:', error);
			return { albums: [] };
		});
};

/**
 * Save gallery via API
 */
export const saveGallery = gallery => {
	if (!isApiAvailable()) {
		return Promise.reject(new Error('API not available'));
	}

	const isNew = !gallery.id;
	const method = isNew ? 'POST' : 'PUT';
	const path = isNew
		? '/fotogrids/v1/admin/galleries'
		: `/fotogrids/v1/admin/galleries/${gallery.id}`;

	return wp.apiFetch({
		path: path,
		method: method,
		data: {
			title: gallery.title,
			status: gallery.status || 'draft',
			layout: gallery.layout || 'grid',
			columns: gallery.columns || 3,
			lightbox: gallery.lightbox || false,
			captions: gallery.captions || false,
			lazy: gallery.lazy || false,
		},
	});
};

/**
 * Delete gallery via API
 */
export const deleteGallery = galleryId => {
	if (!isApiAvailable()) {
		return Promise.reject(new Error('API not available'));
	}

	return wp.apiFetch({
		path: `/fotogrids/v1/admin/galleries/${galleryId}`,
		method: 'DELETE',
	});
};

/**
 * Save album via API
 */
export const saveAlbum = album => {
	if (!isApiAvailable()) {
		return Promise.reject(new Error('API not available'));
	}

	const isNew = !album.id;
	const method = isNew ? 'POST' : 'PUT';
	const path = isNew
		? '/fotogrids/v1/admin/albums'
		: `/fotogrids/v1/admin/albums/${album.id}`;

	return wp.apiFetch({
		path: path,
		method: method,
		data: {
			title: album.title,
			status: album.status || 'draft',
			layout: album.layout || 'grid',
			gallery_ids: album.gallery_ids || [],
		},
	});
};

/**
 * Delete album via API
 */
export const deleteAlbum = albumId => {
	if (!isApiAvailable()) {
		return Promise.reject(new Error('API not available'));
	}

	return wp.apiFetch({
		path: `/fotogrids/v1/admin/albums/${albumId}`,
		method: 'DELETE',
	});
};

/**
 * Add items to gallery via API
 */
export const addItemsToGallery = (galleryId, itemIds) => {
	if (!isApiAvailable()) {
		return Promise.reject(new Error('API not available'));
	}

	return wp.apiFetch({
		path: `/fotogrids/v1/admin/galleries/${galleryId}/items`,
		method: 'POST',
		data: {
			item_ids: itemIds,
		},
	});
};

/**
 * Fetch dashboard overview statistics
 */
export const fetchDashboardStats = () => {
	if (!isApiAvailable()) {
		return Promise.resolve({
			galleries: 0,
			albums: 0,
			items: 0,
			views: 0,
			shares: 0,
			shortcodes_used: false,
		});
	}

	return wp
		.apiFetch({
			path: '/fotogrids/v1/admin/stats/overview',
			method: 'GET',
		})
		.catch(error => {
			console.error('Error fetching dashboard stats:', error);
			return {
				galleries: 0,
				albums: 0,
				items: 0,
				views: 0,
				shares: 0,
				shortcodes_used: false,
			};
		});
};
