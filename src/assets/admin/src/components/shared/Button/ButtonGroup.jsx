import React from 'react';

const ButtonGroup = ({ className = '', children, ...rest }) => (
    <div className={ `fg-button-group ${ className }`.trim() } { ...rest }>
        { children }
    </div>
);

export default ButtonGroup;
