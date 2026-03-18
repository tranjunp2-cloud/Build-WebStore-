# Code Quality Checklist

## Error Handling
- [ ] No empty `catch` blocks.
- [ ] Meaningful error messages (not just "Something went wrong").
- [ ] Use custom error classes for domain-specific errors.
- [ ] Async operations always have `try/catch`.
- [ ] Unhandled promise rejection risk check.

## Performance
- [ ] O(N^2) or higher complexity loops check.
- [ ] Over-fetching data (selecting * instead of specific fields).
- [ ] Expensive calculations inside tight loops or render functions.
- [ ] Missing pagination on large collections.
- [ ] Heavy dependencies check (use lightweight alternatives).

## Boundary Conditions
- [ ] Empty arrays/objects handled.
- [ ] Null/undefined inputs handled.
- [ ] Large input strings/files handled (size limits).
- [ ] Timeout handling for external requests.
- [ ] Off-by-one errors in loops/slices.

## Logic & State
- [ ] Race conditions in async state updates.
- [ ] Stale closures in React/Hooks.
- [ ] Side effects in pure functions or getters.
- [ ] Redundant data transformations.
- [ ] Dead code (unused variables, functions, imports).

## Documentation
- [ ] Non-obvious logic is explained.
- [ ] Public APIs/methods have JSDoc.
- [ ] Complex regexes are broken down or commented.
- [ ] TODOs have tracking issue references.
