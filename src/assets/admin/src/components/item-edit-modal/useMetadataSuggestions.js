import { useEffect, useState } from 'react';
import { buildRestUrl } from '../../utils/rest-url';

const SEARCH_DELAY_MS = 200;

/**
 * Searches existing metadata terms of one type for the text being typed.
 *
 * The request waits until typing pauses, and a newer input aborts the request
 * still in flight, so the result always matches the current text.
 *
 * @param {string} type  Metadata route segment: 'tags', 'people' or 'locations'.
 * @param {string} input Current text in that type's input.
 * @return {Array<Object>} Terms whose name contains the input.
 */
const useMetadataSuggestions = (type, input) => {
	const [suggestions, setSuggestions] = useState([]);

	useEffect(() => {
		const search = (input || '').trim();

		if (!search) {
			setSuggestions([]);
			return undefined;
		}

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(
					buildRestUrl(`fotogrids/v1/metadata/${type}`, {
						search,
						_wpnonce: window.wpApiSettings?.nonce,
					}),
					{ signal: controller.signal }
				);
				const data = response.ok ? await response.json() : [];

				setSuggestions(Array.isArray(data) ? data : []);
			} catch (error) {
				if (error.name !== 'AbortError') {
					console.warn(`Failed to search ${type}:`, error);
				}
			}
		}, SEARCH_DELAY_MS);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [type, input]);

	return suggestions;
};

export default useMetadataSuggestions;
