/**
 * Tests for FolderList.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import FolderList from '@/admin/src/components/folder-import/FolderList.jsx';

const folderButton = (name) =>
	screen
		.getAllByRole('button')
		.find(
			(button) =>
				button.querySelector('.fg-upload-folder-list__name')
					.textContent === name
		);

describe('FolderList', () => {
	it('renders nothing at the uploads root with no sub-folders', () => {
		const { container } = render(<FolderList folders={[]} parent={null} />);

		expect(container).toBeEmptyDOMElement();
	});

	it('lists sub-folders with their image counts', () => {
		const { container } = render(
			<FolderList
				folders={[
					{ name: '2024', count: 12 },
					{ name: 'empty', count: 0 },
				]}
			/>
		);

		expect(screen.getAllByRole('button')).toHaveLength(2);
		const counts = container.querySelectorAll(
			'.fg-upload-folder-list__count'
		);
		expect(counts).toHaveLength(1);
		expect(counts[0]).toHaveTextContent('12');
	});

	it('opens a sub-folder of the uploads root by its name', () => {
		const onNavigate = jest.fn();
		render(
			<FolderList
				folders={[{ name: '2024', count: 1 }]}
				currentPath=""
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(folderButton('2024'));

		expect(onNavigate).toHaveBeenCalledWith('2024');
	});

	it('opens a nested sub-folder by its full path', () => {
		const onNavigate = jest.fn();
		render(
			<FolderList
				folders={[{ name: '05', count: 1 }]}
				parent=""
				currentPath="2024"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(folderButton('05'));

		expect(onNavigate).toHaveBeenCalledWith('2024/05');
	});

	it('offers a parent entry that navigates up', () => {
		const onNavigate = jest.fn();
		render(
			<FolderList
				folders={[]}
				parent="2024"
				currentPath="2024/05"
				onNavigate={onNavigate}
			/>
		);

		fireEvent.click(folderButton('..'));

		expect(onNavigate).toHaveBeenCalledWith('2024');
	});

	it('disables every entry while work is in flight', () => {
		render(
			<FolderList
				folders={[{ name: 'a', count: 1 }]}
				parent=""
				disabled
			/>
		);

		screen
			.getAllByRole('button')
			.forEach((button) => expect(button).toBeDisabled());
	});
});
