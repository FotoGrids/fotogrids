import React from 'react';

const ModalMain = ({ className = '', children, ...rest }) => (
    <div className={ `fg-modal__main ${ className }`.trim() } { ...rest }>
        { children }
    </div>
);

export default ModalMain;
