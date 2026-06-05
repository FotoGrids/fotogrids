import React from 'react';

const ModalHeaderActions = ({ className = '', children, ...rest }) => (
    <div className={ `fg-modal__header__actions ${ className }`.trim() } { ...rest }>
        { children }
    </div>
);

ModalHeaderActions.__fgModalHeaderZone = 'trailing';

export default ModalHeaderActions;
