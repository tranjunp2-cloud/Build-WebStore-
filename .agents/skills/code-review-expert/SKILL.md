# Code Review Expert Skill

Analyzes code against SOLID principles, security best practices, and performance standards.

## Workflow

1.  **Context Loading**: Read target file(s) or PR diff.
2.  **Multidimensional Review**:
    -   **SOLID**: Check against `references/solid-checklist.md`.
    -   **Security**: Check against `references/security-checklist.md`.
    -   **Quality**: Check against `references/code-quality-checklist.md`.
    -   **Redundancy**: Match against `references/removal-plan.md`.
3.  **Synthesis**: Generate structured report.
4.  **Interaction**: Ask user which fixes to implement.

## Instructions

### 1) Initial Analysis

When a user requests a review (`/code-review` or manual request), start by summarizing the scope and intent of the code.

### 2) Reporting Format

Use the following section headers:

#### 📊 OVERALL SUMMARY
- Score: [1-5]
- Scope: [Files/PR]
- Summary: 2-3 sentences.

#### 🚨 P0: CRITICAL (Bugs & Security)
- [File:L123-145]: [Description of vulnerability/bug]
- **Recommendation**: [Code fix snippet]

#### ⚠️ P1: HIGH (SOLID & Logic)
- [File:L50-80]: [SOLID violation or major logic flaw]
- **Recommendation**: [Refactor suggestion]

#### 📝 P2: MEDIUM (Quality & Standards)
- [Description]

#### 💡 P3: LOW (Style & Nits)
- [Description]

### 3) Protocol for Implementation

If the user chooses to "Fix all" or specific items:
1.  Verify the fix doesn't break existing tests.
2.  Ask for confirmation after each logical group of fixes.

### 4) Language Support

Primary support for TypeScript/JavaScript (Next.js/Node.js). Secondary support for Python, Go, and SQL.
