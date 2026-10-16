/**
 * Publishes the caption and description editor at
 * window.FotoGridsAdmin.textEditor, so extensions can add editor features
 * or render the same editor without bundling a copy:
 *
 *   window.FotoGridsAdmin.textEditor.registerFeature( { name, element, toolbar, command } );
 *   window.FotoGridsAdmin.textEditor.getFeatures( profile );
 *   <window.FotoGridsAdmin.textEditor.Editor value={ html } onChange={ … } label="…" />
 *
 * Every change also dispatches the `fotogrids:admin:text_editor:change`
 * event on the editor, with detail { profile, field, value }.
 */
import {
	CHANGE_EVENT,
	Editor,
	getFeatures,
	registerFeature,
} from '@packages/fg-text-editor';

window.FotoGridsAdmin = window.FotoGridsAdmin || {};
if (!window.FotoGridsAdmin.textEditor) {
	window.FotoGridsAdmin.textEditor = Object.freeze({
		Editor,
		registerFeature,
		getFeatures,
		CHANGE_EVENT,
	});
}
