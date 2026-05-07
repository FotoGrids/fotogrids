import React from 'react';
import Toast from './Toast';

const ToastContainer = ({ toasts, onDismiss }) => {
    if (!toasts || toasts.length === 0) {
        return null;
    }

    return (
        <div className="fotogrids-toast-container" aria-live="polite" aria-atomic="false">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    toast={toast}
                    onDismiss={onDismiss}
                />
            ))}
        </div>
    );
};

export default ToastContainer;

