// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DB_SETUP_PATH = path.resolve(process.cwd(), 'scripts/db-setup.js')
const { normalizeIndexPredicate } = require(DB_SETUP_PATH) as {
    normalizeIndexPredicate: (predicate: unknown) => string
}

// ── TC-F39-AC13: Fail-closed runtime issue uniqueness migration ─────────────
describe('[TC-F39-AC13] runtime promotion unique index', () => {
    it('normalizes PostgreSQL enum casts without weakening the predicate check', () => {
        const postgresPredicate =
            "((related_type = 'runtime'::enum_template_issues_related_type) AND (related_id IS NOT NULL))"

        expect(normalizeIndexPredicate(postgresPredicate)).toBe(
            "related_type = 'runtime' and related_id is not null",
        )
        expect(normalizeIndexPredicate(
            "related_type = 'runtime'::text OR related_id IS NOT NULL",
        )).not.toBe("related_type = 'runtime' and related_id is not null")
    })

    it('creates the exact partial unique index without destructive SQL', () => {
        // Arrange
        const script = fs.readFileSync(DB_SETUP_PATH, 'utf8')

        // Act
        const migration = script.match(
            /CREATE UNIQUE INDEX IF NOT EXISTS template_issues_runtime_related_id_uniq[\s\S]*?;/,
        )?.[0]

        // Assert
        expect(migration).toBeDefined()
        expect(migration).toContain('ON template_issues (related_id)')
        expect(migration).toContain(
            "WHERE related_type = 'runtime' AND related_id IS NOT NULL",
        )
        expect(migration).not.toMatch(/\bDROP\b/i)
    })

    it('verifies uniqueness, validity, key column, and exact predicate fail-closed', () => {
        // Arrange
        const script = fs.readFileSync(DB_SETUP_PATH, 'utf8')

        // Act
        const verifier = script.match(
            /const runtimeIssueIndex = await pool\.query\([\s\S]*?verified template_issues_runtime_related_id_uniq definition/,
        )?.[0]

        // Assert
        expect(verifier).toBeDefined()
        expect(verifier).toContain('index_metadata.indisunique')
        expect(verifier).toContain('index_metadata.indisvalid')
        expect(verifier).toContain(
            'JOIN pg_class AS table_class ON table_class.oid = index_metadata.indrelid',
        )
        expect(verifier).toContain("table_class.relname = 'template_issues'")
        expect(verifier).toContain("runtimeIndex.indexkey !== 'related_id'")
        expect(verifier).toContain(
            "runtimePredicate !== \"related_type = 'runtime' and related_id is not null\"",
        )
        expect(verifier).toContain('throw new Error(')
    })

    it('fails before index creation when duplicate runtime identities already exist', () => {
        // Arrange
        const script = fs.readFileSync(DB_SETUP_PATH, 'utf8')

        // Act
        const ensureIndex = script.match(
            /async function ensureRuntimeIssueUniqueIndex\(pool\) \{[\s\S]*?console\.log\('\[db-setup\] ✅ template_issues\.runtime_related_unique_idx \(fail-closed\)'\);\n\}/,
        )?.[0]

        // Assert
        expect(ensureIndex).toBeDefined()
        expect(ensureIndex).toContain(
            "WHERE related_type = 'runtime' AND related_id IS NOT NULL",
        )
        expect(ensureIndex).toContain('HAVING COUNT(*) > 1')
        expect(ensureIndex).toContain('if (duplicateRuntimeIssues.rows.length > 0)')
        expect(ensureIndex).toContain(
            'Cannot create template_issues_runtime_related_id_uniq: duplicate runtime related_id values exist',
        )
        expect(ensureIndex?.indexOf('HAVING COUNT(*) > 1')).toBeLessThan(
            ensureIndex?.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS') ?? -1,
        )
    })

    it('runs the fail-closed preflight after additive migrations in both startup modes', () => {
        // Arrange
        const script = fs.readFileSync(DB_SETUP_PATH, 'utf8')

        // Act
        const occurrences = script.match(
            /await runMigrations\(pool\);[\s\S]{0,200}?await ensureRuntimeIssueUniqueIndex\(pool\);/g,
        )

        // Assert
        expect(occurrences).toHaveLength(2)
    })
})
