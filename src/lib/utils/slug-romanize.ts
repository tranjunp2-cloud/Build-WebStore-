import { pinyin } from 'pinyin-pro'
import { toRomaji } from 'wanakana'

/** Romanize Chinese (pinyin, no tones) and Japanese kana (romaji) runs, each padded with spaces. */
export function romanizeCjk(value: string): string {
    return value.replace(
        /[\u3040-\u309F]+|[\u30A0-\u30FF]+|[\u3400-\u4DBF\u4E00-\u9FFF]+/gu,
        (run) => ` ${/[\u3040-\u30FF]/u.test(run)
            ? toRomaji(run).replace(/([aeiou])\1+/gi, '$1')
            : pinyin(run, { toneType: 'none', type: 'array' }).join(' ')} `,
    )
}

/** Short (7 chars, base36) hash of a value: the same text always gives the same suffix. */
export function stableSlugSuffix(value: string): string {
    let hash = 2166136261
    for (const char of value.normalize('NFKC')) {
        hash ^= char.codePointAt(0) ?? 0
        hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7)
}
