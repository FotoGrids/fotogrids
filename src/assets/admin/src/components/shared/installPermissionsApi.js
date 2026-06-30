/**
 * Install the public Permissions API on window.FotoGridsAdmin.permissions.
 *
 * Called from global-modal-init.js (the always-on admin entry). Idempotent.
 *
 * Public surface (read by Pro and any 3rd-party admin JS):
 *
 *   window.FotoGridsAdmin.permissions.registerMatrixOverride(Component)
 *     Replace the read-only Permissions Manager matrix (Panel 2) with a
 *     Pro-supplied editable React component. The override receives:
 *       { registry, reload }
 *     where `registry` is the latest /permissions/registry payload and
 *     `reload` is an async function to re-fetch it after writes.
 *
 *   window.FotoGridsAdmin.permissions.registerPanelOverride('simple', C)
 *     Replace Panel 1 (Capability Settings) with a custom component, with
 *     the same props as above. Reserved for future Pro UX iterations.
 *
 *   window.FotoGridsAdmin.permissions.getRegistry()
 *     Return the last-fetched registry payload, or null if Panel hasn't
 *     loaded yet. Pro components can read this synchronously instead of
 *     refetching.
 *
 *   window.FotoGridsAdmin.permissions.on / off
 *     Subscribe to permission-related DOM events:
 *       'fotogrids:admin:permissions:registry-loaded' detail: { registry }
 *
 * Pro registers overrides by calling the registerX functions; the tab
 * picks them up either synchronously on mount or via the
 * 'fotogrids:admin:permissions:override' event when registered after mount.
 */

export const installPermissionsApi = () => {
	if (typeof window === 'undefined') return;

	window.FotoGridsAdmin = window.FotoGridsAdmin || {};
	if (window.FotoGridsAdmin.permissions) return;

	const namespace = {
		_matrixOverride: null,
		_simplePanelOverride: null,
		_registry: null,

		registerMatrixOverride(Component) {
			namespace._matrixOverride = Component || null;
			document.dispatchEvent(
				new CustomEvent('fotogrids:admin:permissions:override', {
					detail: { panel: 'matrix', component: Component || null },
				})
			);
		},

		registerPanelOverride(panel, Component) {
			if (panel === 'simple') {
				namespace._simplePanelOverride = Component || null;
				document.dispatchEvent(
					new CustomEvent('fotogrids:admin:permissions:override', {
						detail: {
							panel: 'simple',
							component: Component || null,
						},
					})
				);
			}
		},

		getRegistry() {
			return namespace._registry;
		},

		on(event, handler) {
			document.addEventListener(
				`fotogrids:admin:permissions:${event}`,
				handler
			);
		},

		off(event, handler) {
			document.removeEventListener(
				`fotogrids:admin:permissions:${event}`,
				handler
			);
		},
	};

	window.FotoGridsAdmin.permissions = namespace;
};
