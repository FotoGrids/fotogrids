window.FotoGridsDynamicOptions = window.FotoGridsDynamicOptions || {};

/**
 * Resolve a setting's options, fetching them when the setting declares an
 * endpoint.
 *
 * A setting opts in with `api_endpoint` plus `options_key`; `fallback_options`
 * are shown while the request is in flight and kept if it fails, and
 * `append_option` and `exclude_values` adjust the resulting list. A setting
 * without `api_endpoint` resolves to its static `options` immediately.
 *
 * @param {Object}   setting          The catalog setting definition.
 * @param {Object}   [context]        Optional context.
 * @param {Function} [context.decorate] Maps each fetched option before use.
 * @return {{options: Array, loading: boolean}} Resolved options and load state.
 */
const useDynamicOptions = (setting, context = {}) => {
	const { useEffect, useState } = wp.element;
	const { decorate } = context;

	const isDynamic = Boolean(setting.api_endpoint);

	const withAppended = (list) => {
		const options = Array.isArray(list) ? list : [];
		if (
			setting.append_option &&
			!options.find((opt) => opt.value === setting.append_option.value)
		) {
			return [...options, setting.append_option];
		}
		return options;
	};

	const getFallback = () => withAppended(setting.fallback_options || []);

	const [options, setOptions] = useState(() =>
		isDynamic ? getFallback() : setting.options || []
	);
	const [loading, setLoading] = useState(isDynamic);

	useEffect(() => {
		if (!isDynamic) {
			setOptions(setting.options || []);
			setLoading(false);
			return;
		}

		let cancelled = false;

		const fetchOptions = async () => {
			try {
				const response = await fetch(setting.api_endpoint, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings?.nonce || '',
					},
				});

				if (cancelled) {
					return;
				}

				if (!response.ok) {
					console.warn(
						'FotoGrids: Failed to fetch dynamic options, using fallback'
					);
					setOptions(getFallback());
					return;
				}

				const data = await response.json();
				if (cancelled) {
					return;
				}

				let fetched = data[setting.options_key] || [];

				if (setting.exclude_values && setting.exclude_values.length) {
					fetched = fetched.filter(
						(option) =>
							!setting.exclude_values.includes(option.value)
					);
				}

				if (typeof decorate === 'function') {
					fetched = fetched.map(decorate);
				}

				setOptions(withAppended(fetched));
			} catch (error) {
				if (cancelled) {
					return;
				}
				console.warn(
					'FotoGrids: Error fetching dynamic options:',
					error
				);
				setOptions(getFallback());
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		fetchOptions();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setting.api_endpoint, setting.options_key, setting.exclude_values]);

	return { options, loading };
};

window.FotoGridsDynamicOptions.useDynamicOptions = useDynamicOptions;
