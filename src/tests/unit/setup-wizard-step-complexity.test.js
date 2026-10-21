/**
 * Tests for components/setup-wizard/StepComplexity.jsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StepComplexity from '@/admin/src/components/setup-wizard/StepComplexity';
import {
	persistSetting,
	persistUserPreference,
} from '@/admin/src/components/setup-wizard/persist-setting';

jest.mock('@/admin/src/components/setup-wizard/persist-setting', () => ({
	persistSetting: jest.fn(() => Promise.resolve({ ok: true })),
	persistUserPreference: jest.fn(() => Promise.resolve({ ok: true })),
}));

const radio = (name) => screen.getByRole('radio', { name: new RegExp(name) });

describe('StepComplexity', () => {
	afterEach(() => {
		delete window.fotogridsAdmin;
		jest.clearAllMocks();
	});

	it('pre-selects the site default, not the user mode', () => {
		window.fotogridsAdmin = {
			siteSettingsMode: 'advanced',
			settingsMode: 'easy',
		};
		render(<StepComplexity />);
		expect(radio('Advanced').getAttribute('aria-checked')).toBe('true');
		expect(radio('Easy').getAttribute('aria-checked')).toBe('false');
	});

	it('falls back to Easy without a site default', () => {
		window.fotogridsAdmin = { settingsMode: 'advanced' };
		render(<StepComplexity />);
		expect(radio('Easy').getAttribute('aria-checked')).toBe('true');
	});

	it('saves a pick as the site default and the user mode', () => {
		window.fotogridsAdmin = { siteSettingsMode: 'easy' };
		render(<StepComplexity />);
		fireEvent.click(radio('Advanced'));
		expect(persistSetting).toHaveBeenCalledWith(
			'fotogrids_settings_mode',
			'advanced'
		);
		expect(persistUserPreference).toHaveBeenCalledWith(
			'settings_mode',
			'advanced'
		);
		expect(radio('Advanced').getAttribute('aria-checked')).toBe('true');
	});
});
