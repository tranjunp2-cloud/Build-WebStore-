/**
 * TC-AISEC-005 — an attached XLSX is read with bounded memory: the inflated entries of one file stop at
 * XLSX_INFLATED_LIMIT and entries that share their data are refused, so a few-KB zip bomb is a plain
 * "could not be read" instead of an out-of-memory prime-web function. A normal sheet still reads.
 * Real: read-document.ts; the XLSX bytes are built here (minimal ZIP: local headers, central directory, end record).
 */
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readDocumentText, XLSX_INFLATED_LIMIT } from '@/lib/ai-platform/agent-tools/read-document'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Entry = { name: string; content: Buffer; sameDataAs?: number }

/** A ZIP of deflated entries; `sameDataAs` points an entry's central record at an earlier entry's data. */
function zip(entries: Entry[]): Buffer {
    const locals: Buffer[] = []
    const offsets: number[] = []
    const sizes: number[] = []
    let offset = 0
    for (const entry of entries) {
        const data = deflateRawSync(entry.content)
        const name = Buffer.from(entry.name)
        const header = Buffer.alloc(30)
        header.writeUInt32LE(0x04034b50, 0)
        header.writeUInt16LE(8, 8)
        header.writeUInt32LE(data.length, 18)
        header.writeUInt32LE(entry.content.length, 22)
        header.writeUInt16LE(name.length, 26)
        offsets.push(offset)
        sizes.push(data.length)
        locals.push(header, name, data)
        offset += 30 + name.length + data.length
    }
    const central: Buffer[] = []
    entries.forEach((entry, i) => {
        const target = entry.sameDataAs ?? i
        const name = Buffer.from(entry.name)
        const record = Buffer.alloc(46)
        record.writeUInt32LE(0x02014b50, 0)
        record.writeUInt16LE(8, 10)
        record.writeUInt32LE(sizes[target]!, 20)
        record.writeUInt16LE(name.length, 28)
        record.writeUInt32LE(offsets[target]!, 42)
        central.push(record, name)
    })
    const directory = Buffer.concat(central)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(directory.length, 12)
    end.writeUInt32LE(offset, 16)
    return Buffer.concat([...locals, directory, end])
}

const sheet = (rows: string[][]) =>
    Buffer.from(`<worksheet><sheetData>${rows.map((r) => `<row>${r.map((v) => `<c t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`)

describe('XLSX reading limits [TC-AISEC-005]', () => {
    it('reads the cells of a normal sheet', async () => {
        const text = await readDocumentText(zip([{ name: 'xl/worksheets/sheet1.xml', content: sheet([['size', 'price'], ['S', '10']]) }]), XLSX)

        expect(text).toContain('size\tprice')
        expect(text).toContain('S\t10')
    })

    it('refuses a zip bomb: a small file whose entry inflates past the limit', async () => {
        const bomb = zip([{ name: 'xl/worksheets/sheet1.xml', content: Buffer.alloc(XLSX_INFLATED_LIMIT + 1024, 0x20) }])

        expect(bomb.length).toBeLessThan(100_000)
        await expect(readDocumentText(bomb, XLSX)).rejects.toThrow('too large')
    })

    it('refuses entries that share one compressed blob (the same data inflated many times)', async () => {
        const content = sheet([['a']])
        const shared = zip([
            { name: 'xl/worksheets/sheet1.xml', content },
            { name: 'xl/worksheets/sheet2.xml', content, sameDataAs: 0 },
        ])

        await expect(readDocumentText(shared, XLSX)).rejects.toThrow()
    })
})
