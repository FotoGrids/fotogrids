# FotoGrids Testing Documentation

Comprehensive testing setup for the FotoGrids WordPress plugin, covering unit tests, integration tests, and end-to-end testing.

## Testing Stack

### Core Technologies

-   **Jest**: Primary testing framework
-   **React Testing Library**: Component testing utilities
-   **jsdom**: DOM simulation for browser environment
-   **ts-jest**: TypeScript support for Jest
-   **@testing-library/jest-dom**: Additional Jest matchers

### WordPress Integration

-   **WordPress API Mocks**: Mock WordPress functions and globals
-   **REST API Testing**: Mock WordPress REST API responses
-   **Block Editor Mocks**: Mock Gutenberg block editor components

## Project Structure

```
src/tests/
├── setup/                      # Test configuration
│   ├── jest.setup.js          # Global test setup
│   ├── globalSetup.js         # Pre-test environment setup
│   ├── globalTeardown.js      # Post-test cleanup
│   ├── cssTransform.js        # CSS import transformer
│   └── fileTransform.js       # Static file transformer
├── unit/                      # Unit tests
│   ├── helpers.test.js        # Helper functions tests
│   └── components/            # React component tests
│       ├── GallerySelector.test.tsx
│       ├── TemplateSelector.test.tsx
│       └── GalleryPreview.test.tsx
├── integration/               # Integration tests
│   ├── rest-api.test.js      # REST API integration
│   └── block-editor.test.js  # Block editor integration
├── e2e/                      # End-to-end tests (future)
│   └── gallery-workflow.test.js
├── fixtures/                 # Test data
│   └── test-data.js          # Mock data and utilities
└── README.md                 # This documentation
```

## Test Categories

### 1. Unit Tests (`src/tests/unit/`)

Test individual components and functions in isolation.

#### Helper Functions Tests

```javascript
// src/tests/unit/helpers.test.js
describe('fotogrids_get_gallery', () => {
    test('should return gallery when valid', () => {
        // Test implementation
    });
});
```

#### React Component Tests

```javascript
// src/tests/unit/components/GallerySelector.test.tsx
describe('GallerySelector Component', () => {
    test('renders gallery list', () => {
        render(<GallerySelector galleries={mockGalleries} />);
        expect(screen.getByText('Gallery 1')).toBeInTheDocument();
    });
});
```

### 2. Integration Tests (`src/tests/integration/`)

Test how different parts work together.

#### REST API Integration

```javascript
// src/tests/integration/rest-api.test.js
describe('FotoGrids REST API', () => {
    test('fetches galleries from endpoint', async () => {
        const galleries = await wp.apiFetch({
            path: '/fotogrids/v1/galleries',
        });
        expect(galleries).toHaveLength(2);
    });
});
```

#### Block Editor Integration

```javascript
// Test block registration and WordPress integration
describe('Gutenberg Block Integration', () => {
    test('registers block with correct attributes', () => {
        // Test block registration
    });
});
```

### 3. End-to-End Tests (`src/tests/e2e/`)

Test complete user workflows (future implementation).

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Test Patterns

```bash
# Run specific test file
npm test helpers.test.js

# Run tests matching pattern
npm test -- --testNamePattern="Gallery"

# Run tests for specific component
npm test GallerySelector

# Run only changed files
npm test -- --onlyChanged
```

## Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup/jest.setup.js'],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/assets/$1',
    },
    collectCoverageFrom: ['src/assets/**/*.{js,ts,tsx}', '!src/tests/**/*'],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
};
```

### Global Setup (`src/tests/setup/jest.setup.js`)

```javascript
import '@testing-library/jest-dom';

// Mock WordPress globals
global.wp = {
    apiFetch: jest.fn(),
    i18n: { __: jest.fn(text => text) },
};

// Mock browser APIs
global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
```

## Mocking Strategy

### WordPress Functions

```javascript
// Mock WordPress database functions
global.wpdb = {
    prepare: jest.fn(),
    get_results: jest.fn(),
    get_var: jest.fn(),
};

// Mock WordPress post functions
global.get_post = jest.fn();
global.get_post_meta = jest.fn();
```

### WordPress Components

```javascript
// Mock Gutenberg components
jest.mock('@wordpress/components', () => ({
    Button: ({ children, onClick }) => (
        <button onClick={onClick}>{children}</button>
    ),
    Placeholder: ({ children, label }) => (
        <div data-testid='placeholder'>
            <div>{label}</div>
            {children}
        </div>
    ),
}));
```

### API Responses

```javascript
// Mock REST API responses
const mockApiFetch = jest.fn();
mockApiFetch.mockResolvedValue([{ id: 1, title: 'Test Gallery' }]);
```

## Test Data and Fixtures

### Mock Data (`src/tests/fixtures/test-data.js`)

```javascript
export const mockGalleries = [
    {
        id: 1,
        title: 'Test Gallery',
        item_count: 5,
        featured_item: 'https://example.com/item.jpg',
    },
];

export const createMockGallery = (overrides = {}) => ({
    id: 1,
    title: 'Test Gallery',
    ...overrides,
});
```

### Utility Functions

```javascript
// Create test data with overrides
const gallery = createMockGallery({
    title: 'Custom Gallery',
    item_count: 10,
});

// Setup component with props
const renderGallerySelector = (props = {}) => {
    return render(
        <GallerySelector
            galleries={mockGalleries}
            onGallerySelect={jest.fn()}
            {...props}
        />,
    );
};
```

## Testing Patterns

### Component Testing

```javascript
describe('Component Name', () => {
    // Test rendering
    test('renders correctly', () => {
        render(<Component />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    // Test user interactions
    test('handles click events', async () => {
        const user = userEvent.setup();
        const mockHandler = jest.fn();

        render(<Component onClick={mockHandler} />);
        await user.click(screen.getByRole('button'));

        expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    // Test props
    test('accepts custom props', () => {
        render(<Component title='Custom Title' />);
        expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    // Test edge cases
    test('handles empty data gracefully', () => {
        render(<Component data={[]} />);
        expect(screen.getByText('No data available')).toBeInTheDocument();
    });
});
```

### Async Testing

```javascript
test('loads data asynchronously', async () => {
    mockApiFetch.mockResolvedValue(mockGalleries);

    render(<AsyncComponent />);

    // Wait for loading to complete
    await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Test Gallery')).toBeInTheDocument();
});
```

### Error Testing

```javascript
test('handles API errors', async () => {
    const mockError = new Error('API Error');
    mockApiFetch.mockRejectedValue(mockError);

    render(<Component />);

    await waitFor(() => {
        expect(screen.getByText('Error loading data')).toBeInTheDocument();
    });
});
```

## Coverage Requirements

### Coverage Thresholds

-   **Lines**: 70% minimum
-   **Functions**: 70% minimum
-   **Branches**: 70% minimum
-   **Statements**: 70% minimum

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Exclusions

```javascript
// Exclude from coverage
collectCoverageFrom: [
    'src/assets/**/*.{js,ts,tsx}',
    '!src/assets/**/*.d.ts',
    '!src/assets/**/index.{js,ts}',
    '!src/assets/**/*.stories.{js,ts,tsx}',
    '!src/tests/**/*',
];
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests focused** on single behaviors
5. **Use beforeEach/afterEach** for setup and cleanup

### Component Testing

1. **Test user interactions** rather than implementation details
2. **Use semantic queries** (`getByRole`, `getByLabelText`)
3. **Mock external dependencies** (APIs, WordPress functions)
4. **Test accessibility** features (ARIA labels, keyboard navigation)
5. **Test error states** and edge cases

### Async Testing

1. **Use `waitFor`** for asynchronous operations
2. **Mock timers** when testing time-dependent code
3. **Test loading states** and error handling
4. **Avoid testing implementation details** of async operations

### Mocking Guidelines

1. **Mock at the boundary** (API calls, external libraries)
2. **Keep mocks simple** and focused
3. **Reset mocks** between tests
4. **Mock consistently** across test files
5. **Document complex mocks** with comments

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: '18'
            - run: npm ci
            - run: npm run test:ci
            - run: npm run lint
            - run: npm run type-check
```

### Pre-commit Hooks

```json
{
    "husky": {
        "hooks": {
            "pre-commit": "npm run lint && npm run test:ci"
        }
    }
}
```

## Debugging Tests

### Debug Mode

```bash
# Run tests in debug mode
npm test -- --detectOpenHandles --forceExit

# Run specific test with debugging
npm test -- --testNamePattern="specific test" --verbose
```

### Console Output

```javascript
test('debug test', () => {
    render(<Component />);

    // Debug rendered output
    screen.debug();

    // Debug specific element
    const button = screen.getByRole('button');
    console.log(button.outerHTML);
});
```

### VS Code Integration

```json
// .vscode/launch.json
{
    "configurations": [
        {
            "name": "Debug Jest Tests",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/node_modules/.bin/jest",
            "args": ["--runInBand"],
            "console": "integratedTerminal"
        }
    ]
}
```

This comprehensive testing setup ensures code quality, reliability, and maintainability for the FotoGrids plugin while following WordPress and React best practices.
