import React from 'react';

const OperationBanner = ({ message }) => (
	<div className="fg-ie-banner">
		<span className="fg-ie-banner__spinner" aria-hidden="true" />
		<span className="fg-ie-banner__message">{message}</span>
	</div>
);

export default OperationBanner;
