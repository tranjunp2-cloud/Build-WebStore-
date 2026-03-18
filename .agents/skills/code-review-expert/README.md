# Code Review Expert Skill

## Purpose

Automated, deep technical code review of pull requests or specific files based on SOLID, security, performance, and best practices.

## Capabilities

- **SOLID Analysis**: Identify violations of Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
- **Security Check**: Identify common vulnerabilities (OWASP), unsafe credential handling, and data leakage.
- **Performance Leak Detection**: Pinpoint O(N^2) loops, unnecessary re-renders, or memory leaks.
- **Maintenance Assessment**: Suggest refactors for "god objects", long functions, or complex conditionals.

## Usage

```bash
/code-review <pr-link>
/code-review <file-path>
/code-review-full
```

## Review Output Format

Reviews are presented as structured reports with priority levels:

- **P0 (Critical)**: Breaking bugs, security holes, performance disasters.
- **P1 (High)**: Logic errors, SOLID violations, poor error handling.
- **P2 (Medium)**: Style inconsistencies, missing documentation, slight performance issues.
- **P3 (Low)**: Nitpicks, minor readability improvements.

## Protocol

1. **Analysis**: Analyze the code against checklists in `references/`.
2. **Identification**: List specific line ranges for each issue.
3. **Reasoning**: Explain *why* it is an issue with code examples.
4. **Recommendation**: Provide a concrete refactor or fix.
5. **Score**: Give an overall maintainability score (1-5).
