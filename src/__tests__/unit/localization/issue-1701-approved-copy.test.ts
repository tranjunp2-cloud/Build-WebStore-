import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }
type CsvRow = Record<string, string>
type ReconciliationManifest = {
    source: { recordCount: number }
    scalarDrift: {
        contextChangedHold: Array<{ key: string }>
        sourceContentConflictHold: Array<{ key: string }>
        brandingConflictHold: { keys: string[] }
    }
    missingPathGroups: Array<{ keys: string[] }>
    arrays: {
        itemMapped: Array<{ key: string; en: string[]; ms: string[] }>
        needsBusinessConfirmation: Array<{ key: string }>
        preserveCurrentUnusableSource: Array<{ key: string }>
    }
    contractOverrides: Array<{ key: string; decision: string }>
}

const EXPECTED_HEADERS = [
    'area',
    'key_or_element',
    'source_ref',
    'ux_category',
    'review_priority',
    'ux_note',
    'location',
    'en_copy',
    'suggested_en_copy',
    'bahasa_copy',
    'suggested_bahasa_copy',
    'review_bahasa_copy',
]
const EXPECTED_SOURCE_SHA256 = '85c0bc5829ed256e390393879b5d31dddf02dd67f00edfa7dbf839614e2bc0dd'
const SOURCE_PATH = join(process.cwd(), 'docs/translation-dev-view.csv')
const MANIFEST_PATH = join(process.cwd(), 'scripts/i18n/issue-1701-reconciliation.json')
const enLocale = en as unknown as JsonObject
const msLocale = ms as unknown as JsonObject
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ReconciliationManifest

function parseCsv(text: string): string[][] {
    const records: string[][] = []
    let record: string[] = []
    let field = ''
    let quoted = false

    const finishRecord = () => {
        record.push(field)
        records.push(record)
        record = []
        field = ''
    }

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        const next = text[index + 1]

        if (quoted) {
            if (char === '"' && next === '"') {
                field += '"'
                index += 1
            } else if (char === '"') {
                quoted = false
            } else if (char === '\r' && next === '\n') {
                field += '\n'
                index += 1
            } else {
                field += char
            }
            continue
        }

        if (char === '"' && field.length === 0) {
            quoted = true
        } else if (char === '"') {
            field += char
        } else if (char === ',') {
            record.push(field)
            field = ''
        } else if (char === '\r' && next === '\n') {
            finishRecord()
            index += 1
        } else if (char === '\n') {
            finishRecord()
        } else {
            field += char
        }
    }

    if (quoted) {
        throw new Error('Unclosed quoted CSV field')
    }
    if (field.length > 0 || record.length > 0) {
        finishRecord()
    }

    return records
}

function loadSourceRows(): CsvRow[] {
    const source = readFileSync(SOURCE_PATH, 'utf8').replace(/^\uFEFF/, '')
    const [headers, ...records] = parseCsv(source)

    expect(headers).toEqual(EXPECTED_HEADERS)
    return records.map((record, rowIndex) => {
        if (record.length !== headers.length) {
            throw new Error(`CSV row ${rowIndex + 2} has ${record.length} columns`)
        }
        return Object.fromEntries(headers.map((header, index) => [header, record[index]]))
    })
}

function resolvePath(root: JsonObject, dottedPath: string): JsonValue | undefined {
    let value: JsonValue = root
    for (const part of dottedPath.split('.')) {
        if (!value || Array.isArray(value) || typeof value !== 'object' || !(part in value)) {
            return undefined
        }
        value = value[part]
    }
    return value
}

function flattenShape(value: JsonValue, path = '$'): Record<string, string> {
    if (Array.isArray(value)) {
        return value.reduce<Record<string, string>>(
            (shape, child, index) => ({
                ...shape,
                ...flattenShape(child, `${path}[${index}]`),
            }),
            { [path]: 'array' },
        )
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value).sort().reduce<Record<string, string>>(
            (shape, key) => ({
                ...shape,
                ...flattenShape(value[key], path === '$' ? key : `${path}.${key}`),
            }),
            { [path]: 'object' },
        )
    }
    return { [path]: value === null ? 'null' : typeof value }
}

function placeholders(value: string): string[] {
    return (value.match(/\{[^{}]+\}/g) ?? []).sort()
}

function htmlContracts(value: string): string[] {
    const contracts: string[] = []
    const tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g
    let match: RegExpExecArray | null
    while ((match = tagPattern.exec(value)) !== null) {
        contracts.push(`${match[0].startsWith('</') ? '/' : ''}${match[1]}`)
    }
    return contracts.sort()
}

const contextHolds = new Set(manifest.scalarDrift.contextChangedHold.map(entry => entry.key))
const sourceContentHolds = new Set(manifest.scalarDrift.sourceContentConflictHold.map(entry => entry.key))
const brandingHolds = new Set(manifest.scalarDrift.brandingConflictHold.keys)
const missingKeys = new Set(manifest.missingPathGroups.flatMap(group => group.keys))
const mappedArrays = new Map(manifest.arrays.itemMapped.map(entry => [entry.key, entry]))
const pendingArrays = new Set(manifest.arrays.needsBusinessConfirmation.map(entry => entry.key))
const preservedArrays = new Set(manifest.arrays.preserveCurrentUnusableSource.map(entry => entry.key))
const contractDecisions = new Map(manifest.contractOverrides.map(entry => [entry.key, entry.decision]))
const runtimeHolds = new Set(
    manifest.contractOverrides
        .filter(entry => entry.decision === 'preserve_placeholder')
        .map(entry => entry.key),
)

describe('GH-1701 approved English and Malay copy contracts', () => {
    it('[TC-GH1701-01] keeps identical recursive EN/MS path and value-type structure', () => {
        // Arrange
        const enShape = flattenShape(enLocale)

        // Act
        const msShape = flattenShape(msLocale)

        // Assert
        expect(msShape).toEqual(enShape)
        expect(Object.keys(enShape).length).toBeGreaterThan(4_000)
    })

    it('[TC-GH1701-02] accounts for every source CSV row through output or an explicit decision', () => {
        // Arrange
        const sourceBytes = readFileSync(SOURCE_PATH)
        const rows = loadSourceRows()
        const rowKeys = rows.map(row => row.key_or_element)
        const actualMissing: string[] = []
        const actualArrays: string[] = []
        let accountedRows = 0

        // Act
        for (const row of rows) {
            const key = row.key_or_element
            const enValue = resolvePath(enLocale, key)
            const msValue = resolvePath(msLocale, key)

            if (enValue === undefined || msValue === undefined) {
                expect(enValue).toBeUndefined()
                expect(msValue).toBeUndefined()
                expect(missingKeys.has(key)).toBe(true)
                actualMissing.push(key)
                accountedRows += 1
                continue
            }

            if (Array.isArray(enValue) || Array.isArray(msValue)) {
                expect(Array.isArray(enValue)).toBe(true)
                expect(Array.isArray(msValue)).toBe(true)
                expect(mappedArrays.has(key) || pendingArrays.has(key) || preservedArrays.has(key)).toBe(true)
                actualArrays.push(key)
                accountedRows += 1
                continue
            }

            expect(typeof enValue).toBe('string')
            expect(typeof msValue).toBe('string')

            if (sourceContentHolds.has(key)) {
                expect(enValue, `${key} held English output`).toBe(row.suggested_en_copy)
                expect(msValue, `${key} held Malay output`).toBe(row.bahasa_copy)
                expect(msValue).not.toBe(row.suggested_bahasa_copy)
                accountedRows += 1
                continue
            }

            if (contextHolds.has(key) || brandingHolds.has(key) || runtimeHolds.has(key)) {
                accountedRows += 1
                continue
            }

            let expectedEn = row.suggested_en_copy
            let expectedMs = row.suggested_bahasa_copy
            if (contractDecisions.get(key) === 'preserve_trailing_space') {
                expectedEn = `${expectedEn.trimEnd()} `
                expectedMs = `${expectedMs.trimEnd()} `
            }

            expect(enValue, `${key} English output`).toBe(expectedEn)
            expect(msValue, `${key} Malay output`).toBe(expectedMs)
            accountedRows += 1
        }

        // Assert
        expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(EXPECTED_SOURCE_SHA256)
        expect(rows).toHaveLength(manifest.source.recordCount)
        expect(new Set(rowKeys).size).toBe(rows.length)
        expect(accountedRows).toBe(rows.length)
        expect(actualMissing.sort()).toEqual([...missingKeys].sort())
        expect(actualArrays.sort()).toEqual([
            ...mappedArrays.keys(),
            ...pendingArrays,
            ...preservedArrays,
        ].sort())
    })

    it('[TC-GH1701-03] preserves mapped, pending, and object-array contracts', () => {
        // Arrange
        const classifiedArrayKeys = [
            ...mappedArrays.keys(),
            ...pendingArrays,
            ...preservedArrays,
        ]

        // Act
        const arrayContracts = classifiedArrayKeys.map(key => ({
            key,
            enValue: resolvePath(enLocale, key),
            msValue: resolvePath(msLocale, key),
            mapping: mappedArrays.get(key),
        }))

        // Assert
        expect(arrayContracts).toHaveLength(33)
        for (const contract of arrayContracts) {
            expect(Array.isArray(contract.enValue), `${contract.key} English array`).toBe(true)
            expect(Array.isArray(contract.msValue), `${contract.key} Malay array`).toBe(true)
            expect(flattenShape(contract.msValue as JsonValue[])).toEqual(
                flattenShape(contract.enValue as JsonValue[]),
            )
            if (contract.mapping) {
                expect(contract.enValue).toEqual(contract.mapping.en)
                expect(contract.msValue).toEqual(contract.mapping.ms)
            }
        }
    })

    it('[TC-GH1701-04] keeps placeholder and HTML contracts compatible across locales', () => {
        // Arrange
        const rows = loadSourceRows()

        // Act
        const scalarContracts = rows.flatMap(row => {
            const enValue = resolvePath(enLocale, row.key_or_element)
            const msValue = resolvePath(msLocale, row.key_or_element)
            return typeof enValue === 'string' && typeof msValue === 'string'
                ? [{ key: row.key_or_element, enValue, msValue }]
                : []
        })

        // Assert
        expect(scalarContracts).toHaveLength(3_298)
        for (const contract of scalarContracts) {
            expect(placeholders(contract.msValue), `${contract.key} placeholders`).toEqual(
                placeholders(contract.enValue),
            )
            expect(htmlContracts(contract.msValue), `${contract.key} HTML`).toEqual(
                htmlContracts(contract.enValue),
            )
        }
    })

    it('[TC-GH1701-05] preserves whitespace, multiline, and interpolation edge contracts', () => {
        // Arrange
        const enPayments = en.dashboard.settings.payments
        const msPayments = ms.dashboard.settings.payments
        const enCategory = en.dashboard.blog.categoryModal
        const msCategory = ms.dashboard.blog.categoryModal
        const enEmailTemplates = en.dashboard.settings.emailTemplates
        const msEmailTemplates = ms.dashboard.settings.emailTemplates

        // Act
        const lastEditedPlaceholders = {
            en: placeholders(enEmailTemplates.lastEdited),
            ms: placeholders(msEmailTemplates.lastEdited),
        }

        // Assert
        expect(enPayments.uploadError.endsWith(' ')).toBe(true)
        expect(msPayments.uploadError.endsWith(' ')).toBe(true)
        expect(enCategory.removeConfirmMsg).not.toContain('\n')
        expect(msCategory.removeConfirmMsg).toContain('\n')
        expect(placeholders(enCategory.removeConfirmMsg)).toEqual(['{name}'])
        expect(placeholders(msCategory.removeConfirmMsg)).toEqual(['{name}'])
        expect(lastEditedPlaceholders.en).toEqual(['{time}'])
        expect(lastEditedPlaceholders.ms).toEqual(['{time}'])
    })
})
