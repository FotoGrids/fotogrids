# FotoGrids Gallery Templates

This directory contains the CSS and JavaScript files for FotoGrids gallery templates.

## Available Templates

### Free Templates

#### 1. Grid Layout (`grid`)
- **File**: `grid.css`, `grid.js`
- **Description**: Simple responsive grid layout with equal-sized squares
- **Features**:
  - Responsive grid columns (1-6 columns)
  - Perfect square aspect ratio
  - Smooth hover animations
  - Mobile-optimized breakpoints
  - Lazy loading support
  - Lightbox integration

#### 2. Masonry Layout (`masonry`)
- **File**: `masonry.css`, `masonry.js`
- **Description**: Pinterest-style masonry layout preserving image aspect ratios
- **Features**:
  - CSS Column-based masonry
  - Automatic column balancing
  - Responsive column counts
  - Staggered loading animations
  - Intelligent reordering for better balance
  - Break-inside: avoid for clean columns

#### 3. Justified Layout (`justified`)
- **File**: `justified.css`, `justified.js`
- **Description**: Justified rows with equal heights, similar to Google Photos
- **Features**:
  - Smart row justification algorithm
  - Configurable row heights (small, medium, large, xl)
  - Responsive height adjustments
  - Aspect ratio preservation
  - Advanced layout calculations
  - Smooth loading animations

### Pro Templates (Coming Soon)

#### 4. Slider Layout (`slider`)
- **Description**: Image slider with navigation controls
- **Features**: Touch/swipe support, autoplay, thumbnails

#### 5. Polaroid Layout (`polaroid`)
- **Description**: Polaroid-style scattered photo layout
- **Features**: Random rotations, drop shadows, vintage effects

## Template Structure

Each template consists of:

### CSS File
- Base layout styles
- Responsive breakpoints
- Animation definitions
- Accessibility features
- Reduced motion support

### JavaScript File
- Layout calculations
- Responsive handling
- Lazy loading implementation
- Lightbox integration
- Statistics tracking
- Performance optimizations

## Usage

Templates are automatically loaded based on the gallery's layout setting:

```php
// In shortcode
[fotogrids_gallery id="123" template="grid" cols="4"]

// In PHP
echo do_shortcode('[fotogrids_gallery id="123" template="masonry"]');
```

## Responsive Breakpoints

All templates use consistent breakpoints:
- **Mobile**: ≤ 480px
- **Small Tablet**: 481px - 767px  
- **Tablet**: 768px - 1023px
- **Desktop**: ≥ 1024px

## Column Behavior

### Grid Template
- **Mobile**: 1 column
- **Small Tablet**: 2 columns max
- **Tablet**: 3 columns max
- **Desktop**: Full column count

### Masonry Template
- **Mobile**: 1-2 columns
- **Small Tablet**: 2 columns max
- **Tablet**: 3 columns max
- **Desktop**: Full column count

### Justified Template
- **Mobile**: Single column fallback
- **Small Tablet**: 2-3 items per row
- **Tablet**: 3-4 items per row
- **Desktop**: Variable based on aspect ratios

## Performance Features

### Lazy Loading
- IntersectionObserver API
- 50px-100px margin for preloading
- Graceful fallback for older browsers
- Loading state animations

### Layout Optimization
- RequestAnimationFrame for smooth updates
- Debounced resize handlers (150-200ms)
- Efficient DOM manipulation
- CSS-based animations where possible

### Statistics Integration
- Automatic view tracking
- Layout-specific event data
- Non-blocking API calls
- Silent error handling

## Accessibility

### Keyboard Navigation
- Tab index support
- Enter/Space key activation
- Focus indicators
- ARIA labels where needed

### Screen Readers
- Proper alt text handling
- Semantic HTML structure
- Caption accessibility
- Skip links for large galleries

### Motion Preferences
- Respects `prefers-reduced-motion`
- Disables animations when requested
- Static fallbacks available

### High Contrast
- `prefers-contrast: high` support
- Enhanced borders and backgrounds
- Improved color contrast

## Browser Support

### Modern Features
- CSS Grid (Grid template)
- CSS Columns (Masonry template)
- Flexbox (Justified template)
- IntersectionObserver (Lazy loading)
- CSS Custom Properties

### Fallbacks
- IE11+ support with graceful degradation
- Fallback layouts for unsupported features
- Progressive enhancement approach

## Customization

### CSS Custom Properties
Templates support CSS custom properties for easy customization:

```css
.fotogrids-layout-grid {
  --grid-gap: 2rem;
  --grid-min-size: 200px;
  --hover-scale: 1.05;
  --animation-duration: 0.3s;
}
```

### JavaScript Events
Templates dispatch custom events for integration:

```javascript
// Gallery initialized
document.addEventListener('fotogrids:gallery:init', (e) => {
  console.log('Gallery initialized:', e.detail.galleryId);
});

// Layout calculated
document.addEventListener('fotogrids:layout:calculated', (e) => {
  console.log('Layout calculated:', e.detail.layout);
});

// Image loaded
document.addEventListener('fotogrids:image:loaded', (e) => {
  console.log('Image loaded:', e.detail.imageId);
});
```

## Development

### Adding New Templates
1. Create `template-name.css` and `template-name.js`
2. Follow the existing structure and patterns
3. Add responsive breakpoints
4. Include accessibility features
5. Add to REST API template list
6. Update documentation

### Testing
- Test on all supported browsers
- Verify responsive behavior
- Check accessibility with screen readers
- Test keyboard navigation
- Validate performance metrics

### Performance Guidelines
- Keep CSS under 10KB per template
- Minimize JavaScript execution
- Use efficient selectors
- Avoid layout thrashing
- Implement proper lazy loading
