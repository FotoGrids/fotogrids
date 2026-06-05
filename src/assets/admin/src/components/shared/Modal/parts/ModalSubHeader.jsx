import React from 'react';

/**
 * ModalSubHeader — optional fixed band beneath the header.
 *
 * Use for chrome that needs to stay visible while the body scrolls but
 * doesn't belong in the header itself: search inputs, filter pills,
 * sort dropdowns, view-mode toggles, breadcrumbs, etc. The picker
 * modal places its search + sort here so the result list scrolls
 * independently underneath.
 *
 * Layout: rendered between `<Modal.Header>` and `<Modal.Body>` in
 * source order. `flex-shrink: 0` so it never collapses; default bottom
 * divider matches the header's visual rhythm.
 *
 * Props
 * ----
 * - divider:    bool   — draw the bottom border (default true). Set
 *                       false when the body has its own leading
 *                       affordance (e.g. tabs) and a second divider
 *                       would be visual noise.
 * - className:  string — extra classes merged onto the root.
 * - children    — arbitrary content. No layout assumptions; consumers
 *                 own the inner flex / grid.
 *
 * @since 1.0.0
 */
const ModalSubHeader = ({
    divider = true,
    className = '',
    children,
    ...rest
}) => {
    const classes = [
        'fg-modal__sub-header',
        !divider && 'fg-modal__sub-header--no-divider',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } { ...rest }>
            { children }
        </div>
    );
};

export default ModalSubHeader;
