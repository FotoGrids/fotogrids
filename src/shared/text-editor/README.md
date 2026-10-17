# text-editor

A small visual editor for formatted captions and descriptions. It builds on `formatted-text`, so it can only produce markup the formatter accepts.

## Editor

```jsx
<Editor
	id="fotogrids-item-caption"
	label="Caption"
	value={ html }
	onChange={ ( html ) => … }
	profile={ profile }            // effective profile; the bundled one when omitted
	field="caption"                // passed in the change event
	disabledReason={ null }        // a string disables the formatting tools and is shown under the field
	reasonLink={ { url, label } }  // optional link after the reason
	stripsFormatting={ false }     // tells the user a change is saved without formatting
	linkDefaults={ { newTab: true, nofollow: false } }
	rows={ 3 }
	disabled={ false }
/>
```

`value` is the stored text. `onChange` is called only when the user changes something, with the stored form: allowed markup and `"\n"` for line breaks. Every change also dispatches `fotogrids:admin:text_editor:change` on the editor, with detail `{ profile, field, value }`; it bubbles.

Text holding markup the editor can't show opens in HTML mode, and the Visual switch stays unavailable until that markup is removed, so nothing is lost silently.

## Features

The toolbar is built from a feature registry. The built-in features are bold, italic, link and clear formatting. A feature is offered only when the profile allows its element.

```js
registerFeature( {
	name: 'highlight',
	element: 'mark',
	toolbar: { icon: { text: 'H' }, label: 'Highlight', order: 40 },
	shortcut: 'primary+shift+h',
	isActive: ( { state } ) => state.isMarked( [ 'mark' ] ),
	command: ( { engine } ) => engine.toggleMark( [ 'mark' ] ),
} );
getFeatures( profile );
```

In the admin, `window.FotoGridsAdmin.textEditor` exposes `Editor`, `registerFeature`, `getFeatures` and `CHANGE_EVENT`.

## Engine

`TextEngine` attaches to a `contenteditable` element. Typing, deleting, spell-check and composition stay native and are read back through the formatter. Line breaks, formatting, paste, drop and undo go through the engine. The document model is a list of blocks holding inline text runs and line breaks with marks; positions are linear offsets that survive every re-render.

The pure commands (`commands.ts`) and the model (`model.ts`) are exported for tests and extensions.
