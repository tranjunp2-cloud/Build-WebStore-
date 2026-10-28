/**
 * TC-AIREL-210..212 — the product description the copilot reads and writes (markdown <-> Lexical): links both
 * ways (only web, mail, phone and relative addresses), unsafe addresses stay plain text, and which descriptions the
 * copilot cannot rewrite without losing something (pictures, blocks, quotes, nested lists, links to a record).
 * Real: lib/products/product-rich-text.
 */
import { describe, expect, it } from 'vitest'
import {
    DESCRIPTION_HAS_PICTURES,
    DESCRIPTION_UNSUPPORTED,
    descriptionBlocker,
    descriptionLockMessage,
    isSafeLinkUrl,
    lexicalToMarkdown,
    markdownToLexical,
} from '@/lib/products/product-rich-text'

type N = Record<string, unknown>
const text = (value: string, format = 0): N => ({ type: 'text', text: value, format })
const link = (url: string, children: N[], fields: N = {}): N => ({ type: 'link', fields: { linkType: 'custom', url, newTab: false, ...fields }, children })
const para = (...children: N[]): N => ({ type: 'paragraph', children })
const doc = (...children: N[]) => ({ root: { type: 'root', children } })
/** every node of a Lexical tree */
const walk = (node: unknown): N[] => (node && typeof node === 'object' ? [node as N, ...(((node as N).children as unknown[]) ?? []).flatMap(walk)] : [])
const find = (value: unknown, type: string) => walk((value as { root: unknown }).root).filter((n) => n.type === type)

describe('links both ways [TC-AIREL-210]', () => {
    it('writes [text](url) as a Payload link node with the text inside', () => {
        const { root } = markdownToLexical('See [our guide](https://shop.my/guide?a=1&b=2) first.')

        const [paragraph] = root.children!
        expect(paragraph?.children?.map((n) => n.type)).toEqual(['text', 'link', 'text'])
        const node = paragraph?.children?.[1] as N
        expect(node).toMatchObject({ type: 'link', version: 3, fields: { linkType: 'custom', newTab: false, url: 'https://shop.my/guide?a=1&b=2' } })
        expect((node.children as N[])[0]).toMatchObject({ type: 'text', text: 'our guide', format: 0 })
    })

    it('reads a link node as [text](url), for custom links and plain Lexical links, in paragraphs, headings and lists', () => {
        const value = doc(
            { type: 'heading', tag: 'h2', children: [text('Sizes '), link('/size-guide', [text('chart')])] },
            para(text('Mail '), link('mailto:hi@shop.my', [text('us')]), text(' or '), { type: 'link', url: 'tel:+60123456789', children: [text('call')] }),
            { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [link('https://a.test/x', [text('Care', 1)])] }] },
        )

        expect(lexicalToMarkdown(value)).toBe('## Sizes [chart](/size-guide)\n\nMail [us](mailto:hi@shop.my) or [call](tel:+60123456789)\n\n- [**Care**](https://a.test/x)')
        expect(descriptionBlocker(value)).toBeNull()
    })

    it('keeps links with bold and italic in or around them (read back in one canonical form that then stays put)', () => {
        const markdown = [
            'Read [our **care** guide](https://shop.my/care) and *[the sizes](/sizes)* or **see [here](https://a.test/b) now**.',
            '- [One](https://a.test/1)\n- Two [link](#top)',
        ].join('\n\n')

        const lexical = markdownToLexical(markdown)
        const canonical = lexicalToMarkdown(lexical)!

        expect(canonical).toBe(
            [
                'Read [our **care** guide](https://shop.my/care) and [*the sizes*](/sizes) or **see** [**here**](https://a.test/b) **now**.',
                '- [One](https://a.test/1)\n- Two [link](#top)',
            ].join('\n\n'),
        )
        expect(lexicalToMarkdown(markdownToLexical(canonical))).toBe(canonical)
        expect(find(lexical, 'link')).toHaveLength(5)
        // a link inside bold text carries the bold mark on its words
        const inBold = find(lexical, 'link').find((n) => (n.fields as N).url === 'https://a.test/b') as N
        expect((inBold.children as N[])[0]).toMatchObject({ text: 'here', format: 1 })
    })

    it('puts the spaces of a bold run outside its marks', () => {
        expect(lexicalToMarkdown(doc(para(text('Wash'), text(' cold ', 1), text('only'))))).toBe('Wash **cold** only')
        expect(lexicalToMarkdown(doc(para(text('A', 1), text('B', 1), text(' ', 1), text('C', 3))))).toBe('**AB** ***C***')
    })

    it('keeps brackets and parentheses of an address safe for the markdown reading', () => {
        const value = doc(para(link('https://en.wikipedia.org/wiki/Batik_(cloth)', [text('Batik')])))

        const markdown = lexicalToMarkdown(value)

        expect(markdown).toBe('[Batik](https://en.wikipedia.org/wiki/Batik_%28cloth%29)')
        expect((find(markdownToLexical(markdown!), 'link')[0]?.fields as N).url).toBe('https://en.wikipedia.org/wiki/Batik_%28cloth%29')
    })

    it('reads a link with no address as its text (nothing is lost) and puts surrounding spaces outside the brackets', () => {
        expect(lexicalToMarkdown(doc(para(text('See '), { type: 'link', children: [text('our guide')] })))).toBe('See our guide')
        expect(lexicalToMarkdown(doc(para(text('a'), link('/a', [text(' spaced ')]), text('b'))))).toBe('a [spaced](/a) b')
    })
})

describe('unsafe addresses [TC-AIREL-211]', () => {
    it.each([
        'https://shop.my/a',
        'http://shop.my',
        'mailto:hi@shop.my',
        'tel:+60123456789',
        '/size-guide',
        './care',
        '../care',
        '#top',
    ])('accepts %s', (url) => expect(isSafeLinkUrl(url)).toBe(true))

    it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,AAAA', 'vbscript:x', '//evil.example/x', 'ftp://x.test/f', 'file:///etc/passwd', 'https://', 'shop.my/a', '', 'https://a.test/a b', 'mailto:'])(
        'rejects %s',
        (url) => expect(isSafeLinkUrl(url)).toBe(false),
    )

    it('rejects an address longer than 2000 characters', () => {
        expect(isSafeLinkUrl(`https://a.test/${'x'.repeat(1900)}`)).toBe(true)
        expect(isSafeLinkUrl(`https://a.test/${'x'.repeat(2000)}`)).toBe(false)
    })

    it('leaves an unsafe markdown link as the literal text, never as a link node', () => {
        const lexical = markdownToLexical('Click [here](javascript:alert(1)) or [there](//evil.example/x) or [ok](/fine).')

        expect(find(lexical, 'link').map((n) => (n.fields as N).url)).toEqual(['/fine'])
        expect(lexicalToMarkdown(lexical)).toContain('[here](javascript:alert(1))')
    })

    it('does not write a stored link with an unsafe address back, and says it can\'t rewrite that description', () => {
        const value = doc(para(text('Open '), link('javascript:alert(1)', [text('this')])))

        expect(lexicalToMarkdown(value)).toBe('Open this')
        expect(descriptionBlocker(value)).toBe('unsupported')
    })
})

describe('descriptions the copilot cannot rewrite [TC-AIREL-212]', () => {
    const upload = { type: 'upload', relationTo: 'media', value: { id: 9 } }

    it('names pictures first: an upload block, an image node, or one hidden in a paragraph', () => {
        for (const value of [doc(para(text('Hi')), upload), doc({ type: 'image', src: 'x.jpg' }), doc(para(text('Hi'), upload as N)), doc({ type: 'quote', children: [text('q')] }, upload)]) {
            expect(descriptionBlocker(value)).toBe('pictures')
            expect(descriptionLockMessage(value)).toBe(DESCRIPTION_HAS_PICTURES)
        }
        expect(DESCRIPTION_HAS_PICTURES).toBe('This description has pictures inside; change it in the product form.')
    })

    it('names other content markdown can\'t hold: quotes, tables, blocks, relationships, nested and check lists, links to a record', () => {
        const item = (...children: N[]): N => ({ type: 'listitem', children })
        const cases: unknown[] = [
            doc({ type: 'quote', children: [text('q')] }),
            doc({ type: 'table', children: [] }),
            doc({ type: 'block', fields: { blockType: 'cta' } }),
            doc({ type: 'relationship', relationTo: 'products', value: 3 }),
            doc({ type: 'horizontalrule' }),
            doc({ type: 'list', listType: 'bullet', children: [item(text('a'), { type: 'list', listType: 'bullet', children: [item(text('b'))] })] }),
            doc({ type: 'list', listType: 'check', children: [item(text('a'))] }),
            doc(para(link('', [text('Our shirt')], { linkType: 'internal', doc: { relationTo: 'products', value: 3 } }))),
            doc(para({ type: 'tab', text: '\t' } as N)),
        ]
        for (const value of cases) {
            expect(descriptionBlocker(value)).toBe('unsupported')
            expect(descriptionLockMessage(value)).toBe(DESCRIPTION_UNSUPPORTED)
        }
    })

    it('lets plain descriptions through: paragraphs, headings, lists, bold, italic, links, strings, empty values', () => {
        const rich = doc(
            { type: 'heading', tag: 'h2', children: [text('Care')] },
            para(text('Wash '), text('cold', 1), text(' and '), text('dry', 2), text(' '), link('https://a.test', [text('more')])),
            { type: 'list', listType: 'number', children: [{ type: 'listitem', children: [text('One')] }] },
            para(),
        )
        for (const value of [rich, 'plain text', null, undefined, {}, doc(), { root: {} }]) {
            expect(descriptionBlocker(value)).toBeNull()
            expect(descriptionLockMessage(value)).toBeNull()
        }
    })

    it('a description that passes the check survives read -> write -> read unchanged', () => {
        const rich = doc(
            { type: 'heading', tag: 'h2', children: [text('Care')] },
            para(text('Wash '), text('cold', 1), text(' and '), link('/care', [text('read more', 2)]), text('.')),
            { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [text('One')] }, { type: 'listitem', children: [text('Two')] }] },
        )
        expect(descriptionBlocker(rich)).toBeNull()

        const once = lexicalToMarkdown(rich)!
        expect(lexicalToMarkdown(markdownToLexical(once))).toBe(once)
    })
})
