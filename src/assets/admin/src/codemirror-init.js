async function loadCodeMirror() {
	try {
		const codemirrorModule = await import('codemirror');
		const cssModule = await import('@codemirror/lang-css');
		const jsModule = await import('@codemirror/lang-javascript');
		const stateModule = await import('@codemirror/state');
		const viewModule = await import('@codemirror/view');

		window.FotoGridsCodeMirror = {
			EditorView: codemirrorModule.EditorView,
			basicSetup: codemirrorModule.basicSetup,
			css: cssModule.css,
			javascript: jsModule.javascript,
			// Decoration primitives used by the SELECTOR highlighter.
			RangeSetBuilder: stateModule.RangeSetBuilder,
			Decoration: viewModule.Decoration,
			ViewPlugin: viewModule.ViewPlugin,
		};

		window.dispatchEvent(new CustomEvent('fotogridsCodeMirrorReady'));
	} catch (error) {
		console.error('FotoGrids:Error loading CodeMirror:', error);
	}
}

loadCodeMirror();
