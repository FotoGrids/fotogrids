/**
 * Tests for FolderBreadcrumbs.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import FolderBreadcrumbs from '@/admin/src/components/folder-import/FolderBreadcrumbs.jsx';

const crumbs = [
	{ label: 'Uploads', path: '' },
	{ label: '2024', path: '2024' },
	{ label: '05', path: '2024/05' },
];

describe('FolderBreadcrumbs', () => {
	it('renders one button per crumb with separators between them', () => {
		const { container } = render(
			<FolderBreadcrumbs
				crumbs={crumbs}
				currentPath="2024/05"
				label="Folder path"
			/>
		);

		expect(
			screen.getByRole('navigation', { name: 'Folder path' })
		).toBeInTheDocument();
		expect(screen.getAllByRole('button')).toHaveLength(3);
		expect(
			container.querySelectorAll('.fg-upload-folder-crumbs__sep')
		).toHaveLength(2);
	});

	it('disables the crumb for the folder on screen', () => {
		render(<FolderBreadcrumbs crumbs={crumbs} currentPath="2024/05" />);

		expect(screen.getByRole('button', { name: '05' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Uploads' })).toBeEnabled();
	});

	it('navigates to the path of the crumb clicked', () => {
		const onNavigate = jest.fn();
		render(
			<FolderBreadcrumbs
				crumbs={crumbs}
				currentPath="2024/05"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '2024' }));
		fireEvent.click(screen.getByRole('button', { name: 'Uploads' }));

		expect(onNavigate.mock.calls).toEqual([['2024'], ['']]);
	});

	it('disables every crumb while work is in flight', () => {
		render(
			<FolderBreadcrumbs crumbs={crumbs} currentPath="2024/05" disabled />
		);

		screen
			.getAllByRole('button')
			.forEach((button) => expect(button).toBeDisabled());
	});

	it('renders an empty trail without crumbs', () => {
		render(<FolderBreadcrumbs />);

		expect(screen.getByRole('navigation')).toBeEmptyDOMElement();
	});
});
