import React from 'react';
import FotoGridsIcon from '../../FotoGridsIcon';

/**
 * Header logo slot. Renders the FotoGrids brand mark by default; pass
 * any node as `children` to override (e.g. a partner / co-brand logo).
 *
 * Size and variant of the default logo can be tuned via `logoSize` and
 * `logoVariant`; ignored when `children` is supplied.
 *
 * @since 1.0.0
 */
const ModalHeaderLogo = ({
    className = '',
    children,
    logoSize = 20,
    logoVariant = 'full',
    ...rest
}) => (
    <span
        className={ `fg-modal__header__logo ${ className }`.trim() }
        aria-hidden="true"
        { ...rest }
    >
        { children ?? <FotoGridsIcon size={ logoSize } variant={ logoVariant } /> }
    </span>
);

export default ModalHeaderLogo;
