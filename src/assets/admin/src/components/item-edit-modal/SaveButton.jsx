import React, { useState, useEffect } from 'react';

const Spinner = () => (
    <svg className="fotogrids-save-spinner" viewBox="0 0 48 48" role="img" aria-label="A partial ring that rotates and then is shaped as a checkmark">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6">
            <circle className="spinner__worm" cx="24" cy="24" r="22" strokeDasharray="138.23 138.23" strokeDashoffset="-51.84" transform="rotate(-119)" />
            <path className="spinner__check" d="M 17 25 L 22 30 C 22 30 32.2 19.8 37.3 14.7 C 41.8 10.2 39 7.9 39 7.9" strokeDasharray="36.7 36.7" strokeDashoffset="-36.7" />
        </g>
    </svg>
);


const SaveButton = ({ 
    onClick, 
    saving, 
    hasChanges, 
    saveSuccess, 
    strings 
}) => {
    const [animationState, setAnimationState] = useState('idle'); // idle, saving, success, returning

    useEffect(() => {
        console.log('SaveButton: Props changed ->', { saving, saveSuccess, hasChanges });
        
        if (saving) {
            console.log('SaveButton: State -> saving');
            setAnimationState('saving');
        }
    }, [saving]);
    
    useEffect(() => {
        if (saveSuccess && !saving) {
            console.log('SaveButton: State -> success');
            setAnimationState('success');
            // After 40 seconds, start returning to idle state
            const timer = setTimeout(() => {
                console.log('SaveButton: State -> returning');
                setAnimationState('returning');
                // After 40 seconds, return to idle
                const returnTimer = setTimeout(() => {
                    console.log('SaveButton: State -> idle');
                    setAnimationState('idle');
                }, 20000); // 40 second delay for debugging
                return () => clearTimeout(returnTimer);
            }, 20000); // 40 second delay for debugging
            return () => clearTimeout(timer);
        } else if (!saveSuccess && !saving) {
            console.log('SaveButton: Resetting to idle (no saving, no saveSuccess)');
            setAnimationState('idle');
        }
    }, [saveSuccess, saving]);

    const getButtonClass = () => {
        let classes = 'button button-primary fotogrids-save-button';
        if (animationState === 'saving') classes += ' saving';
        if (animationState === 'success') classes += ' success';
        if (animationState === 'returning') classes += ' returning';
        console.log('SaveButton: Classes applied ->', classes);
        return classes;
    };

    const getButtonContent = () => {
        let content;
        switch (animationState) {
            case 'saving':
            case 'success':
                content = <Spinner />;
                break;
            case 'returning':
            case 'idle':
            default:
                content = strings.saveChanges || 'Save Changes';
        }
        console.log('SaveButton: Content for state', animationState, '->', content);
        return content;
    };

    return (
        <button
            type="button"
            className={getButtonClass()}
            onClick={onClick}
            disabled={!hasChanges || saving}
        >
            <span className="fotogrids-save-button-content">
                {getButtonContent()}
            </span>
        </button>
    );
};

export default SaveButton;
