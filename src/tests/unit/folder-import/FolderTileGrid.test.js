/**
 * Tests for FolderTileGrid.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import FolderTileGrid from '@/admin/src/components/folder-import/FolderTileGrid.jsx';

const files = [
	{
		name: 'beach.jpg',
		path: 'trip/beach.jpg',
		thumbnail: 'beach-thumb.jpg',
		size: 2048,
		attachment_id: 5,
	},
	{
		name: 'hill.jpg',
		path: 'trip/hill.jpg',
		thumbnail: 'hill-thumb.jpg',
		size: 0,
		attachment_id: 0,
	},
];

const tileFor = (name) => screen.getByTitle(name).closest('li');

describe('FolderTileGrid', () => {
	it('renders an empty grid without files', () => {
		const { container } = render(<FolderTileGrid />);

		expect(
			container.querySelector('.fg-upload-folder-grid')
		).toBeEmptyDOMElement();
	});

	it('renders a tile per file with its thumbnail, name and size', () => {
		const { container } = render(
			<FolderTileGrid files={files} newBadgeLabel="New" />
		);

		expect(screen.getAllByRole('button')).toHaveLength(2);
		expect(
			container.querySelector('img[src="beach-thumb.jpg"]')
		).toBeInTheDocument();
		expect(
			tileFor('beach.jpg').querySelector('.fg-upload-folder-tile__meta')
		).toHaveTextContent('2.0 KB');
		expect(
			tileFor('hill.jpg').querySelector('.fg-upload-folder-tile__meta')
		).toBeEmptyDOMElement();
	});

	it('badges only the files not yet in the Media Library', () => {
		render(<FolderTileGrid files={files} newBadgeLabel="New" />);

		expect(
			tileFor('beach.jpg').querySelector('.fg-upload-folder-tile__badge')
		).toBeNull();
		expect(
			tileFor('hill.jpg').querySelector('.fg-upload-folder-tile__badge')
		).toHaveTextContent('New');
	});

	it('marks selected tiles', () => {
		render(<FolderTileGrid files={files} selected={['trip/hill.jpg']} />);

		const selected = tileFor('hill.jpg');
		expect(selected).toHaveClass('fg-upload-folder-tile--selected');
		expect(selected.querySelector('button')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(
			selected.querySelector('.fg-upload-folder-tile__check')
		).toBeInTheDocument();

		const unselected = tileFor('beach.jpg');
		expect(unselected).not.toHaveClass('fg-upload-folder-tile--selected');
		expect(unselected.querySelector('button')).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('toggles the path of the tile clicked', () => {
		const onToggle = jest.fn();
		render(<FolderTileGrid files={files} onToggle={onToggle} />);

		fireEvent.click(tileFor('beach.jpg').querySelector('button'));

		expect(onToggle).toHaveBeenCalledWith('trip/beach.jpg');
	});

	it('disables every tile while work is in flight', () => {
		render(<FolderTileGrid files={files} disabled />);

		screen
			.getAllByRole('button')
			.forEach((button) => expect(button).toBeDisabled());
	});
});
