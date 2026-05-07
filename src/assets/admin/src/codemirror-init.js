async function loadCodeMirror() {
    try {
        const codemirrorModule = await import('codemirror');
        const cssModule = await import('@codemirror/lang-css');
        const jsModule = await import('@codemirror/lang-javascript');
        
        window.FotoGridsCodeMirror = {
            EditorView: codemirrorModule.EditorView,
            basicSetup: codemirrorModule.basicSetup,
            css: cssModule.css,
            javascript: jsModule.javascript
        };
        
        window.dispatchEvent(new CustomEvent('fotogridsCodeMirrorReady'));
    } catch (error) {
        console.error('FotoGrids:Error loading CodeMirror:', error);
    }
}

loadCodeMirror();
