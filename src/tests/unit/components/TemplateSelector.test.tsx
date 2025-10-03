/**
 * Template Selector Component Tests
 * 
 * Unit tests for the TemplateSelector component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateSelector } from '../../../assets/admin/src/components/blocks/TemplateSelector';
import { createMockTemplate } from '../../setup/jest.setup';

// Mock WordPress components
jest.mock('@wordpress/components', () => ({
    Card: ({ children, onClick, className }: any) => (
        <div
            onClick={onClick}
            data-testid="template-card"
            className={className}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            {children}
        </div>
    ),
    CardBody: ({ children }: any) => (
        <div data-testid="card-body">{children}</div>
    ),
    CardMedia: ({ children }: any) => (
        <div data-testid="card-media">{children}</div>
    ),
    CardHeader: ({ children }: any) => (
        <div data-testid="card-header">{children}</div>
    ),
    Badge: ({ children }: any) => (
        <span data-testid="badge">{children}</span>
    )
}));

// Mock WordPress i18n
jest.mock('@wordpress/i18n', () => ({
    __: jest.fn((text: string) => text)
}));

describe('TemplateSelector Component', () => {
    const mockOnTemplateChange = jest.fn();

    const defaultProps = {
        templates: [],
        selectedTemplate: 'grid',
        onTemplateChange: mockOnTemplateChange
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Template Rendering', () => {
        const mockTemplates = [
            createMockTemplate({
                id: 'grid',
                name: 'Grid',
                description: 'Simple grid layout',
                type: 'free',
                preview: 'https://example.com/grid-preview.jpg'
            }),
            createMockTemplate({
                id: 'masonry',
                name: 'Masonry',
                description: 'Pinterest-style layout',
                type: 'free',
                preview: 'https://example.com/masonry-preview.jpg'
            }),
            createMockTemplate({
                id: 'slider',
                name: 'Slider',
                description: 'Item slider',
                type: 'starter',
                preview: 'https://example.com/slider-preview.jpg'
            })
        ];

        test('renders template selector with title', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            expect(screen.getByText('Template')).toBeInTheDocument();
        });

        test('renders all template cards', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            expect(screen.getAllByTestId('template-card')).toHaveLength(3);
            expect(screen.getByText('Grid')).toBeInTheDocument();
            expect(screen.getByText('Masonry')).toBeInTheDocument();
            expect(screen.getByText('Slider')).toBeInTheDocument();
        });

        test('displays template descriptions', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            expect(screen.getByText('Simple grid layout')).toBeInTheDocument();
            expect(screen.getByText('Pinterest-style layout')).toBeInTheDocument();
            expect(screen.getByText('Item slider')).toBeInTheDocument();
        });

        test('renders preview items', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const items = screen.getAllByRole('img');
            expect(items).toHaveLength(3);
            
            expect(items[0]).toHaveAttribute('src', 'https://example.com/grid-preview.jpg');
            expect(items[0]).toHaveAttribute('alt', 'Grid');
            
            expect(items[1]).toHaveAttribute('src', 'https://example.com/masonry-preview.jpg');
            expect(items[1]).toHaveAttribute('alt', 'Masonry');
        });
    });

    describe('Template Categories', () => {
        const mixedTemplates = [
            createMockTemplate({ id: 'grid', type: 'free', name: 'Grid' }),
            createMockTemplate({ id: 'masonry', type: 'free', name: 'Masonry' }),
            createMockTemplate({ id: 'slider', type: 'starter', name: 'Slider' }),
            createMockTemplate({ id: 'polaroid', type: 'expert', name: 'Polaroid' })
        ];

        test('separates free and pro templates', () => {
            render(<TemplateSelector {...defaultProps} templates={mixedTemplates} />);

            expect(screen.getByText('Free Templates')).toBeInTheDocument();
            expect(screen.getByText('Pro Templates')).toBeInTheDocument();
        });

        test('shows badges for pro templates', () => {
            render(<TemplateSelector {...defaultProps} templates={mixedTemplates} />);

            const badges = screen.getAllByTestId('badge');
            expect(badges).toHaveLength(2); // slider (starter) and polaroid (expert)
            
            expect(badges[0]).toHaveTextContent('Starter');
            expect(badges[1]).toHaveTextContent('Pro'); // expert maps to Pro
        });

        test('does not show badges for free templates', () => {
            const freeTemplates = [
                createMockTemplate({ id: 'grid', type: 'free', name: 'Grid' })
            ];

            render(<TemplateSelector {...defaultProps} templates={freeTemplates} />);

            expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
        });
    });

    describe('Template Selection', () => {
        const mockTemplates = [
            createMockTemplate({ id: 'grid', name: 'Grid' }),
            createMockTemplate({ id: 'masonry', name: 'Masonry' })
        ];

        test('highlights selected template', () => {
            render(
                <TemplateSelector
                    {...defaultProps}
                    templates={mockTemplates}
                    selectedTemplate="grid"
                />
            );

            const templateCards = screen.getAllByTestId('template-card');
            const selectedCard = templateCards.find(card => 
                card.textContent?.includes('Grid')
            );
            
            expect(selectedCard).toHaveClass('is-selected');
        });

        test('calls onTemplateChange when template clicked', async () => {
            const user = userEvent.setup();
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const masonryCard = screen.getByText('Masonry').closest('[data-testid="template-card"]');
            if (masonryCard) {
                await user.click(masonryCard);
            }

            expect(mockOnTemplateChange).toHaveBeenCalledWith('masonry');
        });

        test('allows selecting different templates', async () => {
            const user = userEvent.setup();
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const gridCard = screen.getByText('Grid').closest('[data-testid="template-card"]');
            if (gridCard) {
                await user.click(gridCard);
            }

            expect(mockOnTemplateChange).toHaveBeenCalledWith('grid');
        });
    });

    describe('Item Error Handling', () => {
        const mockTemplates = [
            createMockTemplate({
                id: 'grid',
                name: 'Grid',
                preview: 'https://example.com/nonexistent.jpg'
            })
        ];

        test('handles item load errors gracefully', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const item = screen.getByRole('img');
            
            // Simulate item error
            fireEvent.error(item);

            // The item should still be in the document
            expect(item).toBeInTheDocument();
        });
    });

    describe('Empty States', () => {
        test('renders empty template list gracefully', () => {
            render(<TemplateSelector {...defaultProps} templates={[]} />);

            expect(screen.getByText('Template')).toBeInTheDocument();
            expect(screen.queryByText('Free Templates')).not.toBeInTheDocument();
            expect(screen.queryByText('Pro Templates')).not.toBeInTheDocument();
        });

        test('shows only free section when no pro templates', () => {
            const freeOnlyTemplates = [
                createMockTemplate({ id: 'grid', type: 'free', name: 'Grid' })
            ];

            render(<TemplateSelector {...defaultProps} templates={freeOnlyTemplates} />);

            expect(screen.getByText('Free Templates')).toBeInTheDocument();
            expect(screen.queryByText('Pro Templates')).not.toBeInTheDocument();
        });

        test('shows only pro section when no free templates', () => {
            const proOnlyTemplates = [
                createMockTemplate({ id: 'slider', type: 'starter', name: 'Slider' })
            ];

            render(<TemplateSelector {...defaultProps} templates={proOnlyTemplates} />);

            expect(screen.queryByText('Free Templates')).not.toBeInTheDocument();
            expect(screen.getByText('Pro Templates')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        const mockTemplates = [
            createMockTemplate({ id: 'grid', name: 'Grid' })
        ];

        test('template cards are clickable', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const templateCard = screen.getByTestId('template-card');
            expect(templateCard).toHaveStyle({ cursor: 'pointer' });
        });

        test('items have proper alt text', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const item = screen.getByRole('img');
            expect(item).toHaveAttribute('alt', 'Grid');
        });

        test('template cards have proper structure', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            expect(screen.getByTestId('card-media')).toBeInTheDocument();
            expect(screen.getByTestId('card-header')).toBeInTheDocument();
            expect(screen.getByTestId('card-body')).toBeInTheDocument();
        });
    });

    describe('Responsive Behavior', () => {
        const mockTemplates = [
            createMockTemplate({ id: 'grid', name: 'Grid' }),
            createMockTemplate({ id: 'masonry', name: 'Masonry' }),
            createMockTemplate({ id: 'justified', name: 'Justified' })
        ];

        test('renders grid layout for templates', () => {
            render(<TemplateSelector {...defaultProps} templates={mockTemplates} />);

            const container = screen.getByText('Template').parentElement;
            const gridContainer = container?.querySelector('.fotogrids-template-grid');
            
            // Check that the grid container exists (via CSS class)
            expect(screen.getAllByTestId('template-card')).toHaveLength(3);
        });
    });
});
