import React, { useEffect, useState, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';

const Toast = ({ toast, onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const timerRef = useRef(null);
    const hasInitializedRef = useRef(false);
    const onDismissRef = useRef(onDismiss);
    const toastIdRef = useRef(toast.id);

    useEffect(() => {
        onDismissRef.current = onDismiss;
        toastIdRef.current = toast.id;
    }, [onDismiss, toast.id]);

    const handleDismiss = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsExiting(true);
        setTimeout(() => {
            onDismissRef.current(toastIdRef.current);
        }, 300);
    }, []);

    useEffect(() => {
        if (toast.duration && toast.duration > 0 && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            const toastTimestamp = toast.timestamp;
            const toastDuration = toast.duration;
            const interval = 100;

            const initialElapsed = Date.now() - toastTimestamp;
            const initialRemaining = Math.max(0, toastDuration - initialElapsed);
            const initialProgress = (initialRemaining / toastDuration) * 100;
            setProgress(initialProgress);

            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - toastTimestamp;
                const remaining = Math.max(0, toastDuration - elapsed);
                const progressPercent = (remaining / toastDuration) * 100;

                setProgress(progressPercent);

                if (remaining <= 0) {
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                    handleDismiss();
                }
            }, interval);

            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            };
        }
    }, [toast.id]);

    useEffect(() => {
        if (isExiting && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [isExiting]);


    const getIconName = () => {
        switch (toast.type) {
            case 'success':
                return 'check_circle';
            case 'error':
                return 'x_circle';
            case 'warning':
                return 'alert_circle';
            case 'info':
            default:
                return 'info_circle';
        }
    };

    const toastClasses = `fotogrids-toast fotogrids-toast--${toast.type} ${isExiting ? 'fotogrids-toast--exiting' : ''}`;

    return (
        <div className={toastClasses} role="alert" aria-live={toast.type === 'error' ? 'assertive' : 'polite'}>
            {toast.duration && toast.duration > 0 && (
                <div className="fotogrids-toast__progress">
                    <div
                        className="fotogrids-toast__progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            <div className="fotogrids-toast__content">
                <div className="fotogrids-toast__icon">
                    <Icon name={getIconName()} />
                </div>
                <div className="fotogrids-toast__message">
                    {toast.message}
                </div>
                <button
                    className="fotogrids-toast__dismiss"
                    onClick={handleDismiss}
                    aria-label="Dismiss notification"
                    type="button"
                >
                    <Icon name="x" />
                </button>
            </div>
        </div>
    );
};

export default Toast;

