import { useState, useEffect, useRef } from 'react';

const apiFetch = wp.apiFetch;

/**
 * Fetches top-N library entries sorted by usage_count descending, plus the
 * total entry count and the counts in the response's `summary`. Used by the
 * per-tab header charts.
 *
 * A new `refreshKey` refetches in place, keeping the current values on
 * screen until the response arrives.
 *
 * Returns { topItems, total, summary, loading }.
 * topItems: array of { id, name, usage_count, ... }
 * summary:  counts across every entry, e.g. { unused, with_coordinates }
 */
const useLibraryStats = ({ entitySlug, limit = 7, refreshKey = 0 }) => {
	const [topItems, setTopItems] = useState([]);
	const [total, setTotal] = useState(0);
	const [summary, setSummary] = useState({});
	const [loading, setLoading] = useState(true);
	const mountedRef = useRef(true);
	const reqIdRef = useRef(0);
	const queryRef = useRef('');

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!entitySlug) {
			return;
		}
		const query = `${entitySlug}|${limit}`;
		if (query !== queryRef.current) {
			queryRef.current = query;
			setLoading(true);
		}
		const reqId = ++reqIdRef.current;

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
			.then((res) => {
				if (!mountedRef.current || reqId !== reqIdRef.current) {
					return;
				}
				setTopItems(Array.isArray(res.items) ? res.items : []);
				setTotal(Number(res.total) || 0);
				setSummary(res.summary || {});
				setLoading(false);
			})
			.catch(() => {
				if (!mountedRef.current || reqId !== reqIdRef.current) {
					return;
				}
				setLoading(false);
			});
	}, [entitySlug, limit, refreshKey]);

	return { topItems, total, summary, loading };
};

export default useLibraryStats;
