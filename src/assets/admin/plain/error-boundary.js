/**
 * Shared admin error boundary.
 *
 * Registers `window.FotoGridsAdmin.ErrorBoundary` and
 * `window.FotoGridsAdmin.withErrorBoundary`, so every admin React root - the
 * webpack bundles and the plain settings script alike - contains a render
 * error to the subtree that threw instead of unmounting the whole root.
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

		return h(
			'div',
			{
				className:
					'notice notice-error inline fotogrids-error-boundary',
			},
			h(
				'p',
				null,
				__('This part of the screen failed to load.', 'fotogrids')
			),
			h(
				'p',
				null,
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
				null,
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
 * Wrap a deferred render call in an error boundary.
 *
 * The callback runs inside the boundary's own child, so a throw in the callback
 * body is caught too. A boundary placed around an already-built element tree is
 * not enough on its own, because that tree was built during the caller's render.
 *
 * @param {Object}   props  Boundary props, including `key` and `label`.
 * @param {Function} render Callback returning the element to guard.
 * @return {Object} The boundary element.
 */
window.FotoGridsAdmin.withErrorBoundary = (props, render) =>
	wp.element.createElement(
		FotoGridsErrorBoundary,
		props,
		wp.element.createElement(FotoGridsBoundaryBody, { render })
	);
