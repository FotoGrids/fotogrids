import React from 'react';
import Confirm from './Confirm';

const Alert = ({
    isOpen,
    onClose,
    variant = 'info',
    title,
    message,
    confirmLabel,
    children,
}) => (
    <Confirm
        isOpen={ isOpen }
        onClose={ onClose }
        onConfirm={ () => onClose?.('confirm') }
        variant={ variant }
        title={ title }
        message={ message }
        confirmLabel={ confirmLabel }
        showCancel={ false }
    >
        { children }
    </Confirm>
);

export default Alert;
