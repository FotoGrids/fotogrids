/**
 * FotoGrids Tools Component Registry
 *
 * A lightweight map of component-id → React component. This is the only
 * thing the JS side owns about tools - everything else (labels, descriptions,
 * tier, source, ordering) comes from the PHP manifest via REST.
 *
 * Usage:
 *   // Register (in each tool's index.js):
 *   ToolsComponents.register('regenerate-thumbnails', RegenerateThumbnailsTool);
 *
 *   // Look up (in ToolsPage):
 *   const Component = ToolsComponents.get(tool.component);
 *
 * Exposed as window.FotoGridsToolsComponents so Pro and third-party JS
 * bundles can register components without importing Free's module graph.
 */

const componentMap = {};

const ToolsComponents = {
	/**
	 * Register a React component for a tool id.
	 * Calling register() twice for the same id replaces the first registration
	 * (Pro can override a Free component this way).
	 *
	 * @param {string}          id        Tool component id (matches tool.component in the manifest).
	 * @param {React.Component} component The React component to render for this tool.
	 */
	register(id, component) {
		if (!id || !component) {
			console.warn(
				'FotoGridsToolsComponents.register: id and component are required.',
			);
			return;
		}
		componentMap[id] = component;

		// Notify ToolsPage (and any other listener) that this component is now
		// available. Fired after every registration so late-loading per-tool
		// bundles cause a re-render if the page is already mounted.
		window.dispatchEvent(
			new CustomEvent('fotogrids:tool-component-registered', {
				detail: { id },
			}),
		);
	},

	/**
	 * Look up a React component by id.
	 * Returns null if not found - callers should render a graceful fallback.
	 *
	 * @param  {string} id
	 * @return {React.Component|null}
	 */
	get(id) {
		return componentMap[id] || null;
	},
};

// Expose globally so Pro and third-party bundles can register without
// importing from Free's module graph.
window.FotoGridsToolsComponents = ToolsComponents;

export default ToolsComponents;
