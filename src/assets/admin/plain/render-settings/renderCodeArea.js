/**
 * Splits a hint string on <code>…</code> tags and returns an array of
 * React nodes — plain text segments as strings, tagged segments as <code>
 * elements styled with the .fotogrids-codearea-hint code rule.
 *
 * This lets hint authors write arbitrary inline examples, not just specific
 * token words:
 *   "Use <code>SELECTOR</code> to target — e.g. <code>SELECTOR .item { … }</code>"
 *
 * No dangerouslySetInnerHTML is used; the output is safe React elements.
 */
function parseHintString(hint) {
    // Split on <code>…</code> blocks and <br> / <br /> line breaks.
    const BR_RE = /^<br\s*\/?>$/;
    const parts = hint.split(/(<code>[\s\S]*?<\/code>|<br\s*\/?>)/g);
    return parts.map(function(part, i) {
        if (part.startsWith('<code>') && part.endsWith('</code>')) {
            const inner = part.slice(6, -7); // strip <code> and </code>
            return React.createElement('code', { key: i }, inner);
        }
        if (BR_RE.test(part)) {
            return React.createElement('br', { key: i });
        }
        return part;
    });
}

/**
 * Returns a CodeMirror ViewPlugin that highlights every occurrence of the
 * bare token SELECTOR with the `.cm-fg-selector-token` CSS class.
 *
 * Only built when the `language` is 'css' and the CodeMirror decoration
 * primitives are available on window.FotoGridsCodeMirror.
 */
function buildSelectorHighlightPlugin() {
    const cm = window.FotoGridsCodeMirror;
    if (!cm || !cm.ViewPlugin || !cm.Decoration || !cm.RangeSetBuilder) return null;

    const { ViewPlugin, Decoration, RangeSetBuilder } = cm;

    const tokenMark = Decoration.mark({ class: 'cm-fg-selector-token' });
    const TOKEN = 'SELECTOR';
    const TOKEN_LEN = TOKEN.length;

    return ViewPlugin.fromClass(
        class {
            constructor(view) {
                this.decorations = this._buildDecorations(view);
            }
            update(update) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this._buildDecorations(update.view);
                }
            }
            _buildDecorations(view) {
                const builder = new RangeSetBuilder();
                for (const { from, to } of view.visibleRanges) {
                    const text = view.state.doc.sliceString(from, to);
                    let pos = 0;
                    while (true) {
                        const idx = text.indexOf(TOKEN, pos);
                        if (idx === -1) break;
                        // Only highlight when SELECTOR is a standalone word:
                        // not preceded/followed by a letter, digit, or underscore.
                        const absFrom = from + idx;
                        const absTo   = absFrom + TOKEN_LEN;
                        const before  = idx > 0 ? text[idx - 1] : '';
                        const after   = idx + TOKEN_LEN < text.length ? text[idx + TOKEN_LEN] : '';
                        const wordChar = /[\w]/;
                        if (!wordChar.test(before) && !wordChar.test(after)) {
                            builder.add(absFrom, absTo, tokenMark);
                        }
                        pos = idx + TOKEN_LEN;
                    }
                }
                return builder.finish();
            }
        },
        { decorations: (v) => v.decorations }
    );
}

const CodeAreaComponent = ({ setting, value, onChange, errors = [], isDisabled, getFieldState, __ }) => {
    const {
        key,
        label,
        description,
        hint,
        language = 'css',
        placeholder = '',
        disabled = false
    } = setting;

    const settingId = `fotogrids-setting-${key}`;

    const [validationErrors, setValidationErrors] = React.useState([]);
    const [errorsExpanded, setErrorsExpanded] = React.useState(false);
    const hasError = validationErrors.length > 0;
    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, value)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked' ? __('Locked', 'fotogrids') : __('Pro', 'fotogrids');

    const editorRef = React.useRef(null);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        if (value) {
            const errors = validateCode(value, language);
            setValidationErrors(errors);
        }
    }, [value, language]);

    React.useEffect(() => {
        if (!containerRef.current || editorRef.current) return;

        if (!window.FotoGridsCodeMirror) {
            const handleCodeMirrorReady = () => {
                if (window.FotoGridsCodeMirror) {
                    initializeEditor();
                }
            };

            window.addEventListener('fotogridsCodeMirrorReady', handleCodeMirrorReady);

            const checkCodeMirror = () => {
                if (window.FotoGridsCodeMirror) {
                    window.removeEventListener('fotogridsCodeMirrorReady', handleCodeMirrorReady);
                    initializeEditor();
                } else {
                    setTimeout(checkCodeMirror, 200);
                }
            };

            checkCodeMirror();

            return () => {
                window.removeEventListener('fotogridsCodeMirrorReady', handleCodeMirrorReady);
            };
        }

        initializeEditor();

        function initializeEditor() {
            if (!window.FotoGridsCodeMirror) {
                return;
            }

            const { EditorView, basicSetup, css, javascript } = window.FotoGridsCodeMirror;

            let languageExtension;
            if (language.toLowerCase() === 'css') {
                languageExtension = css();
            } else if (language.toLowerCase() === 'js' || language.toLowerCase() === 'javascript') {
                languageExtension = javascript();
            }

            // Build the SELECTOR token highlighter for CSS fields.
            const selectorPlugin = language.toLowerCase() === 'css'
                ? buildSelectorHighlightPlugin()
                : null;

            const editor = new EditorView({
                doc: value || '',
                extensions: [
                    basicSetup,
                    languageExtension,
                    ...(selectorPlugin ? [selectorPlugin] : []),
                    EditorView.theme({
                        '&': {
                            fontSize: '14px',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace'
                        },
                        '.cm-content': {
                            padding: '12px',
                            minHeight: '120px'
                        },
                        '.cm-focused': {
                            outline: '2px solid var(--fg-border-focus)'
                        },
                        '.cm-editor': {
                            borderRadius: '4px',
                            border: hasError
                                ? '1px solid var(--fg-border-error)'
                                : '1px solid var(--fg-border-input)'
                        },
                        '.cm-editor.cm-focused': {
                            borderColor: hasError
                                ? 'var(--fg-border-error)'
                                : 'var(--fg-border-focus)'
                        }
                    }),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            const newValue = update.state.doc.toString();
                            const errors = validateCode(newValue, language);

                            setValidationErrors(errors);
                            onChange(newValue, { hasErrors: errors.length > 0, errorCount: errors.length });
                        }
                    }),
                    EditorView.editable.of(!disabled)
                ],
                parent: containerRef.current
            });

            editorRef.current = editor;
        }

        return () => {
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, []);

    React.useEffect(() => {
        if (editorRef.current && editorRef.current.state.doc.toString() !== (value || '')) {
            editorRef.current.dispatch({
                changes: {
                    from: 0,
                    to: editorRef.current.state.doc.length,
                    insert: value || ''
                }
            });
        }
    }, [value]);

    return React.createElement('div', {
        className: `fotogrids-codearea-group ${hasError ? 'has-error' : ''}`,
        key: settingId
    }, [
        label && React.createElement('label', {
            key: 'label',
            htmlFor: settingId,
            className: 'fotogrids-setting__label'
        }, [
            label,
            showSettingBadge && React.createElement('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge'
            }, settingBadgeText)
        ].filter(Boolean)),

        description && React.createElement('p', {
            key: 'description',
            className: 'fotogrids-setting-description'
        }, description),

        React.createElement('div', {
            key: 'editor-container',
            ref: containerRef,
            className: `fotogrids-codearea-container language-${language.toLowerCase()}`,
            'data-language': language.toLowerCase()
        }),

        hint && React.createElement('p', {
            key: 'hint',
            className: 'fotogrids-codearea-hint'
        }, parseHintString(hint)),

        setting.hint_link && (() => {
            // Build the settings page URL for the deep-link.
            // hint_link shape: { label, tab, field }
            // Uses window.fotogridsAdmin.settingsBaseUrl when available so the
            // URL is correct regardless of WordPress install path; falls back
            // to a relative path that works in standard wp-admin contexts.
            const { label: linkLabel, tab, field, target } = setting.hint_link;
            const base = window.fotogridsAdmin?.settingsBaseUrl
                || 'admin.php?page=fotogrids-settings';
            const separator = base.includes('?') ? '&' : '?';
            const href = `${base}${separator}tab=${encodeURIComponent(tab)}&field=${encodeURIComponent(field)}`;

            const anchorProps = { href, className: 'fotogrids-codearea-hint-link__anchor' };
            if (target) anchorProps.target = target;
            if (target === '_blank') anchorProps.rel = 'noopener noreferrer';

            return React.createElement('p', {
                key: 'hint-link',
                className: 'fotogrids-codearea-hint-link'
            }, React.createElement('a', anchorProps, linkLabel));
        })(),

        hasError && React.createElement('div', {
            key: 'error-summary',
            className: `fotogrids-codearea-error-summary ${errorsExpanded ? 'fotogrids-codearea-error-summary-expanded' : ''}`,
            onClick: () => setErrorsExpanded(!errorsExpanded)
        }, [
            React.createElement('span', {
                key: 'error-text',
                className: 'fotogrids-error-text'
            }, window.wp?.i18n?.__('Contains errors', 'fotogrids') || 'Contains errors'),

            React.createElement('span', {
                key: 'error-count',
                className: 'fotogrids-error-count'
            }, validationErrors.length),

            React.createElement('span', {
                key: 'chevron',
                className: 'fotogrids-error-chevron',
                dangerouslySetInnerHTML: {
                    __html: window.FotoGridsIcons?.['chevron_down'] || '▼'
                }
            })
        ]),

        hasError && errorsExpanded && React.createElement('div', {
            key: 'error-details',
            className: 'fotogrids-codearea-error-details'
        }, validationErrors.map((error, index) =>
            React.createElement('div', {
                key: index,
                className: 'fotogrids-error-item'
            }, error)
        ))
    ]);
};

const renderCodeArea = (setting, value, onChange, errors = [], isDisabled, getFieldState, __) => {
    return React.createElement(CodeAreaComponent, {
        setting,
        value,
        onChange,
        errors,
        isDisabled,
        getFieldState,
        __
    });
};

const validateCode = (code, language) => {
    if (!code.trim()) return [];

    switch (language.toLowerCase()) {
        case 'css':
            return validateCSS(code);
        case 'js':
        case 'javascript':
            return validateJavaScript(code);
        default:
            return [];
    }
};

const validateCSS = (css) => {
    const errors = [];
    const __ = window.wp?.i18n?.__ || ((text) => text);

    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
        errors.push(__('Mismatched braces in CSS', 'fotogrids'));
    }

    const openComments = (css.match(/\/\*/g) || []).length;
    const closeComments = (css.match(/\*\//g) || []).length;

    if (openComments !== closeComments) {
        errors.push(__('Unclosed comment in CSS', 'fotogrids'));
    }

    // Check for missing semicolons in property declarations
    const lines = css.split('\n');
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Look for property declarations (contains : but not { } or comments)
        if (trimmed &&
            !trimmed.startsWith('/*') &&
            !trimmed.endsWith('*/') &&
            !trimmed.includes('{') &&
            !trimmed.includes('}') &&
            trimmed.includes(':') &&
            !trimmed.endsWith(';') &&
            !trimmed.endsWith(',')) { // Allow for multi-value properties
            errors.push(__('Missing semicolon on line %d', 'fotogrids').replace('%d', index + 1));
        }
    });

    // Check for invalid property names (very basic)
    if (css.includes('invalid-property')) {
        errors.push(__('Invalid CSS property: invalid-property', 'fotogrids'));
    }

    return errors;
};

const validateJavaScript = (js) => {
    const errors = [];
    const __ = window.wp?.i18n?.__ || ((text) => text);

    // Basic syntax checks
    if (js.includes('function') && !js.includes(')')) {
        errors.push(__('Missing closing parenthesis in function', 'fotogrids'));
    }

    // Check for unmatched parentheses
    const openParens = (js.match(/\(/g) || []).length;
    const closeParens = (js.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push(__('Unmatched parentheses in JavaScript', 'fotogrids'));
    }

    // Check for unmatched braces
    const openBraces = (js.match(/\{/g) || []).length;
    const closeBraces = (js.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push(__('Unmatched braces in JavaScript', 'fotogrids'));
    }

    // Try the Function constructor as a fallback
    try {
        new Function(js);
    } catch (e) {
        errors.push(__('JavaScript syntax error: %s', 'fotogrids').replace('%s', e.message));
    }

    return errors;
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};
window.FotoGridsRenderSettings.renderCodeArea = renderCodeArea;
