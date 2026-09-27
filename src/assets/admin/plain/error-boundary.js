/**
 * Shared admin error boundary, registered on `window.FotoGridsAdmin` for the
 * webpack bundles and the plain settings script alike.
 */

class FotoGridsErrorBoundary extends wp.element.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
		this.handleReload = this.handleReload.bind(this);
	}

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		const { label } = this.props;
		console.error(
			`FotoGrids: render error${label ? ` in ${label}` : ''}`,
			error,
			info
		);
	}

	handleReload() {
		window.location.reload();
	}

	render() {
		const { error } = this.state;

		if (!error) {
			return this.props.children ?? null;
		}

		const { createElement: h } = wp.element;
		const { __ } = wp.i18n;

		// The admin header strips inserted `.notice` / `.error` / `.updated`
		// elements, so the fallback carries plugin-owned classes only.
		return h(
			'div',
			{ className: 'fotogrids-error-boundary' },
			h(
				'p',
				{ className: 'fotogrids-error-boundary__message' },
				__('This part of the screen failed to load.', 'fotogrids')
			),
			h(
				'p',
				{ className: 'fotogrids-error-boundary__actions' },
				h(
					'button',
					{
						type: 'button',
						className: 'button button-secondary',
						onClick: this.handleReload,
					},
					__('Reload page', 'fotogrids')
				)
			),
			h(
				'details',
				{ className: 'fotogrids-error-boundary__details' },
				h('summary', null, __('Error details', 'fotogrids')),
				h('pre', null, error.stack || String(error))
			)
		);
	}
}

const FotoGridsBoundaryBody = (props) => props.render();

window.FotoGridsAdmin = window.FotoGridsAdmin || {};
window.FotoGridsAdmin.ErrorBoundary = FotoGridsErrorBoundary;

/**
 * Wrap a deferred render call in an error boundary. The callback runs inside
 * the boundary's own child, so a throw in the callback body is caught too.
 *
 * @param {Object}      props  Boundary props, including `key` and `label`.
 * @param {()=>Object}  render Callback returning the element to guard.
 * @return {Object} The boundary element.
 */
window.FotoGridsAdmin.withErrorBoundary = (props, render) =>
	wp.element.createElement(
		FotoGridsErrorBoundary,
		props,
		wp.element.createElement(FotoGridsBoundaryBody, { render })
	);
