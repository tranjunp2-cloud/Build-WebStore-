# Git Commit Skill

Defines high-quality commit standards and provides tools for atomic commits.

## Workflow

1. **Diff Analysis**: Examine staged changes.
2. **Impact Assessment**: Determine scope and severity.
3. **Generate Message**: Follow Conventional Commits.
4. **Execution**: Push commit with formatted message.

## Conventional Commits

Format: `<type>[optional scope]: <description>`

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Instructions

### 1. Pre-commit check
Ensure that:
- Code compiles.
- No debug logs are present.
- Linting passes.

### 2. Analysis of changes
Group changes into logical units. If too many changes are present, suggest splitting them into multiple commits.

### 3. Generate Commit Message
Analyze the diff to determine type, scope, and description. Use present tense and imperative mood.

### 4. Execute Commit
Run `git commit -m` with the generated message.

## Best Practices
- Keep description under 72 characters.
- Use imperative mood ("add" not "added").
- One logical change per commit.
