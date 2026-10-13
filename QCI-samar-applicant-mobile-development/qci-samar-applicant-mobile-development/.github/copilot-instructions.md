Write modular and clean code that is easy to understand. Break down complex logic into smaller, reusable functions or components. Add comments only where necessary to clarify non-obvious code. Use Consistent Naming Conventions:

Always use descriptive names for variables, functions, and components. Use camelCase for variables and functions. Use PascalCase for React components. Replace any ambiguous or misleading names with clear and descriptive ones. Example: Before: let a = 10; function fn(x) { return x _ 2; } After: let counter = 10; function doubleValue(value) { return value _ 2; } Performance Optimization:

Use React Hooks such as useMemo and useCallback to prevent unnecessary re-renders. Optimize list rendering by using FlatList with a proper keyExtractor. Consider lazy loading for heavy components to improve startup time. Example: Use useMemo for expensive operations on list items, and useCallback for event handlers. Error Handling and Testing:

Wrap asynchronous operations in try-catch blocks to handle errors gracefully. Validate component properties using PropTypes or TypeScript. Write tests for critical functionality and components. Code Formatting and Organization:

Group related code (such as utility functions) together. Insert a single blank line to separate unrelated code blocks. Maintain consistent indentation and spacing throughout the project. Example: Group utility functions together, then leave a blank line before the component code. All imports should be together without any line breaks.

Keep dependencies updated to their latest stable versions. Remove unused imports and dead code regularly. Follow ESLint and Prettier guidelines to ensure a consistent coding style. Document modules and components clearly for easier maintenance.

Add comments for explaing some complex flows or logic.

Logging is done using Logger, not console.

Remove unused variables, functions, styles and other things.
