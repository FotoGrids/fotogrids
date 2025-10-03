/**
 * Gallery Selector Component Tests
 * 
 * Unit tests for the GallerySelector component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GallerySelector } from '../../../assets/admin/src/components/blocks/GallerySelector';
import { createMockGallery } from '../../setup/jest.setup';

// Mock WordPress components
jest.mock('@wordpress/components', () => ({
    Placeholder: ({ children, label, instructions, icon, className }: any) => (
        <div data-testid="placeholder" className={className}>
            <div data-testid="placeholder-icon">{icon}</div>
            <div data-testid="placeholder-label">{label}</div>
            <div data-testid="placeholder-instructions">{instructions}</div>
            {children}
        </div>
    ),
    Button: ({ children, onClick, isPrimary, ...props }: any) => (
        <button
            onClick={onClick}
            data-testid="button"
            data-primary={isPrimary}
            {...props}
        >
            {children}
        </button>
    ),
    Card: ({ children, onClick, className }: any) => (
        <div
            onClick={onClick}
            data-testid="card"
            className={className}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            {children}
        </div>
    ),
    CardBody: ({ children, style }: any) => (
        <div data-testid="card-body" style={style}>{children}</div>
    ),
    CardMedia: ({ children }: any) => (
        <div data-testid="card-media">{children}</div>
    ),
    CardHeader: ({ children }: any) => (
        <div data-testid="card-header">{children}</div>
    )
}));

// Mock WordPress icons
jest.mock('@wordpress/icons', () => ({
    gallery: 'gallery-icon',
    plus: 'plus-icon'
}));

// Mock WordPress i18n
jest.mock('@wordpress/i18n', () => ({
    __: jest.fn((text: string) => text)
}));

describe('GallerySelector Component', () => {
    const mockOnGallerySelect = jest.fn();
    const mockOnCreateNew = jest.fn();

    const defaultProps = {
        galleries: [],
        selectedGalleryId: 0,
        onGallerySelect: mockOnGallerySelect,
        onCreateNew: mockOnCreateNew
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Empty State', () => {
        test('renders empty state when no galleries', () => {
            render(<GallerySelector {...defaultProps} />);

            expect(screen.getByTestId('placeholder')).toBeInTheDocument();
            expect(screen.getByTestId('placeholder-label')).toHaveTextContent('FotoGrids Gallery');
            expect(screen.getByTestId('placeholder-instructions')).toHaveTextContent(
                'No galleries found. Create your first gallery to get started.'
            );
        });

        test('shows create new button in empty state', () => {
            render(<GallerySelector {...defaultProps} />);

            const createButton = screen.getByRole('button', { name: /create new gallery/i });
            expect(createButton).toBeInTheDocument();
        });

        test('calls onCreateNew when create button clicked in empty state', async () => {
            const user = userEvent.setup();
            render(<GallerySelector {...defaultProps} />);

            const createButton = screen.getByRole('button', { name: /create new gallery/i });
            await user.click(createButton);

            expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
        });
    });

    describe('Gallery List', () => {
        const mockGalleries = [
            createMockGallery({
                id: 1,
                title: 'Test Gallery 1',
                item_count: 5,
                featured_item: 'https://example.com/item1.jpg'
            }),
            createMockGallery({
                id: 2,
                title: 'Test Gallery 2',
                item_count: 10,
                featured_item: undefined
            })
        ];

        test('renders gallery list when galleries exist', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            expect(screen.getByTestId('placeholder-instructions')).toHaveTextContent(
                'Select a gallery to display, or create a new one.'
            );
        });

        test('renders gallery cards', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            expect(screen.getAllByTestId('card')).toHaveLength(3); // 2 galleries + create new
            expect(screen.getByText('Test Gallery 1')).toBeInTheDocument();
            expect(screen.getByText('Test Gallery 2')).toBeInTheDocument();
        });

        test('displays gallery metadata', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            expect(screen.getByText('5 items')).toBeInTheDocument();
            expect(screen.getByText('10 items')).toBeInTheDocument();
        });

        test('renders featured items when available', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const items = screen.getAllByRole('img');
            expect(items).toHaveLength(1); // Only gallery 1 has featured item
            expect(items[0]).toHaveAttribute('src', 'https://example.com/item1.jpg');
            expect(items[0]).toHaveAttribute('alt', 'Test Gallery 1');
        });

        test('handles missing featured items gracefully', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            // Gallery 2 should not have an item
            const gallery2Card = screen.getByText('Test Gallery 2').closest('[data-testid="card"]');
            const mediaInGallery2 = gallery2Card?.querySelector('[data-testid="card-media"]');
            expect(mediaInGallery2).toBeFalsy();
        });
    });

    describe('Gallery Selection', () => {
        const mockGalleries = [
            createMockGallery({ id: 1, title: 'Gallery 1' }),
            createMockGallery({ id: 2, title: 'Gallery 2' })
        ];

        test('highlights selected gallery', () => {
            render(
                <GallerySelector
                    {...defaultProps}
                    galleries={mockGalleries}
                    selectedGalleryId={1}
                />
            );

            const cards = screen.getAllByTestId('card');
            const selectedCard = cards.find(card => 
                card.textContent?.includes('Gallery 1')
            );
            
            expect(selectedCard).toHaveClass('is-selected');
        });

        test('calls onGallerySelect when gallery clicked', async () => {
            const user = userEvent.setup();
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const gallery1Card = screen.getByText('Gallery 1').closest('[data-testid="card"]');
            if (gallery1Card) {
                await user.click(gallery1Card);
            }

            expect(mockOnGallerySelect).toHaveBeenCalledWith(1);
        });

        test('allows selecting different galleries', async () => {
            const user = userEvent.setup();
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const gallery2Card = screen.getByText('Gallery 2').closest('[data-testid="card"]');
            if (gallery2Card) {
                await user.click(gallery2Card);
            }

            expect(mockOnGallerySelect).toHaveBeenCalledWith(2);
        });
    });

    describe('Create New Gallery', () => {
        const mockGalleries = [
            createMockGallery({ id: 1, title: 'Existing Gallery' })
        ];

        test('renders create new gallery card', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            expect(screen.getByText('Create New Gallery')).toBeInTheDocument();
        });

        test('create new card has correct styling', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const createCard = screen.getByText('Create New Gallery').closest('[data-testid="card"]');
            expect(createCard).toHaveClass('fotogrids-create-new');
        });

        test('calls onCreateNew when create card clicked', async () => {
            const user = userEvent.setup();
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const createCard = screen.getByText('Create New Gallery').closest('[data-testid="card"]');
            if (createCard) {
                await user.click(createCard);
            }

            expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
        });

        test('shows create button at bottom', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const buttons = screen.getAllByRole('button', { name: /create new gallery/i });
            expect(buttons).toHaveLength(1); // Bottom button (card click is not a button)
        });
    });

    describe('Accessibility', () => {
        const mockGalleries = [
            createMockGallery({ id: 1, title: 'Test Gallery' })
        ];

        test('has proper ARIA labels', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            expect(screen.getByTestId('placeholder')).toBeInTheDocument();
            expect(screen.getByTestId('placeholder-label')).toHaveTextContent('FotoGrids Gallery');
        });

        test('gallery cards are clickable', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const galleryCard = screen.getByText('Test Gallery').closest('[data-testid="card"]');
            expect(galleryCard).toHaveStyle({ cursor: 'pointer' });
        });

        test('create new card is clickable', () => {
            render(<GallerySelector {...defaultProps} galleries={mockGalleries} />);

            const createCard = screen.getByText('Create New Gallery').closest('[data-testid="card"]');
            expect(createCard).toHaveStyle({ cursor: 'pointer' });
        });
    });

    describe('Edge Cases', () => {
        test('handles empty gallery titles', () => {
            const galleriesWithEmptyTitle = [
                createMockGallery({ id: 1, title: '', item_count: 0 })
            ];

            render(<GallerySelector {...defaultProps} galleries={galleriesWithEmptyTitle} />);

            // Should still render the card
            expect(screen.getAllByTestId('card')).toHaveLength(2); // Gallery + create new
        });

        test('handles zero item count', () => {
            const galleriesWithNoItems = [
                createMockGallery({ id: 1, title: 'Empty Gallery', item_count: 0 })
            ];

            render(<GallerySelector {...defaultProps} galleries={galleriesWithNoItems} />);

            expect(screen.getByText('0 items')).toBeInTheDocument();
        });

        test('handles large item counts', () => {
            const galleriesWithManyItems = [
                createMockGallery({ id: 1, title: 'Large Gallery', item_count: 1500 })
            ];

            render(<GallerySelector {...defaultProps} galleries={galleriesWithManyItems} />);

            expect(screen.getByText('1500 items')).toBeInTheDocument();
        });
    });
});
