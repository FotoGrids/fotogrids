/**
 * Locked Reason Component
 * Says why a Dashboard action is disabled for the current user.
 */
import React from 'react';
import Icon from '../shared/Icon';

const LockedReason = ({ children }) => (
	<small className="fg-abc-locked-reason">
		<Icon name="lock" className="fg-abc-locked-reason-icon" />
		{children}
	</small>
);

export default LockedReason;
