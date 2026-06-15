# Modal

Unified modal system for the FotoGrids admin. Built from small composable parts. Used directly via React components, or imperatively via the public API on `window.FotoGridsAdmin.modal`.

This contract is consumed by both Free and Pro, and is intended to be stable for 3rd-party plugins extending FotoGrids. Treat changes here as breaking.

---

## React components

### `<Modal>` — the root

```jsx
import { Modal } from '@/admin/src/components/shared/Modal';

<Modal
    isOpen={open}
    onClose={(reason) => setOpen(false)}
    size="md"                    // 'sm' | 'md' | 'lg' | 'xl' | 'cover' | 'full'
    hasSidebar={false}
    sidebarCollapsible={false}
    sidebarInitiallyCollapsed={false}
    closeOnOverlay={true}
    closeOnEsc={true}
    preventClose={saving}        // when true, esc/overlay/close-button all no-op
    initialFocusRef={null}
    type="my-thing"              // free-form string emitted in events
>
    <Modal.Header>
        <Modal.HeaderTitle>Edit item</Modal.HeaderTitle>
        <Modal.HeaderActions>
            <Button variant="primary">Save</Button>
        </Modal.HeaderActions>
    </Modal.Header>

    {/* Optional fixed band below the header — search, sort, filters,
        breadcrumbs. Stays visible while the body scrolls. */}
    <Modal.SubHeader>
        <input type="search" placeholder="Search…" />
        <select>...</select>
    </Modal.SubHeader>

    <Modal.Body>
        <Modal.Sidebar>...preview pane...</Modal.Sidebar>
        <Modal.Main>
            <Modal.Tabs tabs={TABS} activeId={tab} onChange={setTab} />
            <Modal.TabsPanel id="details" activeId={tab}>...</Modal.TabsPanel>
        </Modal.Main>
    </Modal.Body>

    <Modal.Footer>
        <Button variant="secondary" onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save</Button>
    </Modal.Footer>

    <Modal.Nav direction="prev" onClick={prev} />
    <Modal.Nav direction="next" onClick={next} />
</Modal>
```

#### Sizes

| Size | Dimensions | When to use |
|---|---|---|
| `sm` | 480px wide, auto height | Confirms, single-input prompts, tiny forms |
| `md` | 720px × auto | Most forms |
| `lg` | 1024px × 90vh | Editors with content (Item Edit) |
| `xl` | 1280px × 90vh | Wide content (Upgrade carousel) |
| `cover` | viewport minus 16px gap, 12px radius | Big content that should breathe |
| `full` | 100vw × 100vh, no radius | Edge-to-edge iframes |

#### Sub-component reference

- `Modal.Header` — flex row with leading zone (title + logo), trailing zone (actions + close). Detects `Modal.HeaderActions` children by their `__fgModalHeaderZone` static and routes them to trailing.
- `Modal.HeaderTitle` — props: `level` (1/2/3, default 2), `as` (override tag).
- `Modal.HeaderLogo` — small (20px) leading icon.
- `Modal.HeaderActions` — children render in the trailing zone next to close. A divider is auto-inserted between actions and close.
- `Modal.HeaderClose` — rendered automatically by `Modal.Header` unless `closeButton={false}`. Calls context's `requestClose('close-button')`.
- `Modal.Body` — scroll container. With `hasSidebar`, switches to flex row layout. Props: `padding`, `scroll`.
- `Modal.Sidebar` — 280px left pane. Renders the collapse toggle when the modal's `sidebarCollapsible` is true.
- `Modal.Main` — the right pane.
- `Modal.Tabs` — props: `tabs` (array of `{ id, label, badge?, disabled? }`), `activeId`, `onChange`, `disabled`, `emitEvents` (fires `tab-changed` event).
- `Modal.TabsPanel` — props: `id`, `activeId`. Renders children only when `id === activeId`.
- `Modal.Footer` — props: `align` (`right` | `left` | `between`), `divider`.
- `Modal.Nav` — props: `direction` (`prev` | `next`), `onClick`, `disabled`, `ariaLabel`. Rendered as overlay sibling, not inside the dialog.

### Wrappers

```jsx
import { Confirm, Prompt, Alert } from '@/admin/src/components/shared/Modal';

<Confirm
    isOpen={open}
    onClose={(reason) => setOpen(false)}
    onConfirm={async () => { await doIt(); }}
    variant="danger"          // 'info' | 'question' | 'warning' | 'danger' | 'success'
    title="Delete this?"
    message="This cannot be undone."
    confirmLabel="Delete"
    cancelLabel="Cancel"
    requireText="DELETE"      // optional: requires user to type this string before confirm enables
    busy={saving}             // disables both buttons, shows spinner on confirm
/>

<Prompt
    isOpen={open}
    onClose={setOpen(false)}
    onSubmit={async (value) => { await create(value); }}
    title="Name your template"
    inputLabel="Template name"
    inputPlaceholder="My Template"
    required
/>

<Alert isOpen={open} onClose={setOpen(false)} variant="success" title="Saved" message="..." />
```

`onConfirm` may return a Promise; the wrapper renders a busy spinner until it resolves, then closes automatically.

---

## Imperative API (window.FotoGridsAdmin.modal)

For React code that doesn't have a parent to mount into, or for any non-React JS (vanilla, jQuery, Pro modules without a React bundle):

```js
const handle = window.FotoGridsAdmin.modal.open({
    type: 'confirm',                     // 'confirm' | 'prompt' | 'alert' | 'custom'
    variant: 'danger',
    title: 'Delete?',
    message: '...',
    onConfirm: () => { … },              // sync or async; modal shows busy while pending
    onClose: (reason) => { … },
});

handle.close();                          // close programmatically
handle.update({ title: 'New title' });   // mutate options live
```

Convenience promise-returning shortcuts:

```js
const ok    = await window.FotoGridsAdmin.modal.confirm({ title, message });   // → boolean
const value = await window.FotoGridsAdmin.modal.prompt({ title, inputLabel }); // → string|null
await window.FotoGridsAdmin.modal.alert({ title, message });                   // → void

await window.FotoGridsAdmin.modal.danger({ title, message });    // 'confirm' variant=danger
await window.FotoGridsAdmin.modal.warning({ title, message });   // 'confirm' variant=warning
await window.FotoGridsAdmin.modal.info({ title, message });      // 'alert' variant=info
await window.FotoGridsAdmin.modal.success({ title, message });   // 'alert' variant=success
await window.FotoGridsAdmin.modal.question({ title, message });  // 'confirm' variant=question
```

For custom React content via the registry:

```js
window.FotoGridsAdmin.modal.open({
    type: 'custom',
    size: 'lg',
    render: ({ close }) => <ProCustomThing onCancel={close} />,
});
```

`window.FotoGridsAdmin.modal.close(id?)` closes a specific id or no-op. `closeAll()` clears the stack.

---

## React hook (for Pro React bundles)

```js
import { useModal } from '@/admin/src/components/shared/Modal';
// or from Pro: window.FotoGridsAdmin.modal.hooks.useModal

const Component = () => {
    const modal = useModal();

    const handleDelete = async () => {
        const ok = await modal.danger({
            title: __('Delete?', 'fotogrids'),
            message: __('...', 'fotogrids'),
            confirmLabel: __('Delete', 'fotogrids'),
        });
        if (ok) {
            await doDelete();
            modal.success({ title: __('Deleted', 'fotogrids') });
        }
    };
};
```

---

## Custom DOM events

All events fire on `document` with the prefix `fotogrids:admin:modal:`. Listen with `window.FotoGridsAdmin.modal.on(...)` or directly with `addEventListener`.

| Event | Detail |
|---|---|
| `opened`      | `{ id, type, size }` |
| `closed`      | `{ id, type, reason }` — reason: `overlay` \| `esc` \| `close-button` \| `confirm` \| `cancel` \| `programmatic` |
| `confirmed`   | `{ id, type, variant }` |
| `tab-changed` | `{ modalId, fromTab, toTab }` (only when `Modal.Tabs emitEvents` is set) |

```js
window.FotoGridsAdmin.modal.on('opened', (e) => {
    console.log('modal opened:', e.detail);
});
```

---

## Stacking

Modals stack automatically. Each open modal pushes onto the stack and gets a `--stack-N` modifier class on `.fg-modal`, with z-index ramped by `--fg-modal-z`. `Esc` closes only the topmost. Body scroll-lock reference-counts so the page only re-scrolls when the last modal closes.

```jsx
// Inside a Template Preview modal, opening an Info alert just stacks:
const modal = useModal();
<Button onClick={() => modal.info({ title: 'About templates', message: '...' })}>
    Info
</Button>
```

---

## Extension registries

Slot-injection registries for modals that are designed to be extended by Pro / 3rd party. (To be populated as modals are migrated.)

```js
// Pro adds a tab to ItemEditModal:
window.FotoGridsAdmin.registerItemEditTab({
    id:        'pro-seo',
    label:     'SEO',
    badge:     'PRO',
    component: ProSeoTab,
    order:     50,
    when:      ({ itemData }) => itemData.mime_type?.startsWith('image/'),
});
```

---

## CSS rules

- Modal shell styles live in `styles/fg-modal/`. **Don't override them.** If you need a one-off width, add a custom class via the `className` prop and write a scoped rule in your modal's own SCSS.
- The shell exposes CSS variables on `.fg-modal__dialog`: `--fg-modal-width`, `--fg-modal-height`, `--fg-modal-max-width`, `--fg-modal-max-height`, `--fg-modal-radius`. Override these from your custom class — never via `style={{ ... }}` inline.

> **Note on naming.** The JSX surface uses unprefixed names (`Modal`, `Confirm`, `Prompt`, `Alert`, `useModal`). The CSS class namespace remains `.fg-modal` and the global imperative API remains `window.FotoGridsAdmin.modal` — these are stable cross-surface contracts and were intentionally not renamed.
