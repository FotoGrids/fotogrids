import { useState, useEffect, useRef } from 'react';

const apiFetch = wp.apiFetch;

/**
 * Fetches top-N library entries sorted by usage_count descending, plus the
 * total entry count. Used by the per-tab header charts.
 *
 * Returns { topItems, total, loading }.
 * topItems: array of { id, name, usage_count, ... }
 */
const useLibraryStats = ({ entitySlug, limit = 7 }) => {
	const [topItems, setTopItems] = useState([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!entitySlug) return;
		setLoading(true);

		const library = window.fotogridsLibrary || {};
		const restBase = library.restBase || 'fotogrids/v1/library';

		const params = new URLSearchParams({
			page: '1',
			per_page: String(limit),
			orderby: 'usage_count',
			order: 'desc',
			search: '',
			unused_only: '0',
		});

		apiFetch({ path: `/${restBase}/${entitySlug}?${params}` })
			.then(res => {
				if (!mountedRef.current) return;
				setTopItems(Array.isArray(res.items) ? res.items : []);
				setTotal(Number(res.total) || 0);
				setLoading(false);
			})
			.catch(() => {
				if (!mountedRef.current) return;
				setLoading(false);
			});
	}, [entitySlug, limit]);

	return { topItems, total, loading };
};

export default useLibraryStats;
