// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { applyVariables, mergeTemplateConfig } from '@/lib/email/merge-template-config'
import type { EmailTemplateConfig } from '@/lib/email/types'

// ─── TC-F32: Variable Substitution & Merge ────────────────────────────

describe('applyVariables [TC-F32]', () => {
    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-01] replaces known {var} tokens with values', () => {
        // Arrange
        const input = 'Hello {customerName}, welcome to {brandName}!'
        const vars = {
            customerName: 'Alice',
            brandName: 'PrimeCommerce',
        }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBe('Hello Alice, welcome to PrimeCommerce!')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-02] leaves unknown {tokens} intact', () => {
        // Arrange
        const input = 'Order {orderNumber} placed on {unknownVar} at {timestamp}'
        const vars = {
            orderNumber: '12345',
        }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBe('Order 12345 placed on {unknownVar} at {timestamp}')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-03] HTML-escapes substituted values to prevent injection', () => {
        // Arrange
        const input = 'Hello {name}, check this: {script}'
        const vars = {
            name: 'User<img src=x onerror="alert(1)">',
            script: '<script>alert("xss")</script>',
        }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBe(
            'Hello User&lt;img src=x onerror=&quot;alert(1)&quot;&gt;, check this: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
        )
        expect(result).not.toContain('<img')
        expect(result).not.toContain('<script>')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-03.1] HTML-escapes all special characters (&, <, >, ", \')', () => {
        // Arrange
        const input = 'Content: {content}'
        const vars = {
            content: '& < > " \'',
        }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBe('Content: &amp; &lt; &gt; &quot; &#39;')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-04] returns undefined when input is undefined', () => {
        // Arrange
        const input = undefined
        const vars = { any: 'value' }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBeUndefined()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-04.1] handles numeric variable values', () => {
        // Arrange
        const input = 'Order total: {amount} units: {quantity}'
        const vars = {
            amount: 99.99,
            quantity: 5,
        }

        // Act
        const result = applyVariables(input, vars)

        // Assert
        expect(result).toBe('Order total: 99.99 units: 5')
    })
})

// ─── TC-F32: Template Config Merge ────────────────────────────────────

describe('mergeTemplateConfig [TC-F32]', () => {
    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-05] config=null: returns defaults with vars substituted', () => {
        // Arrange
        const defaults = {
            subject: 'Welcome {customerName}!',
            greeting: 'Hello',
            ctaLabel: 'Get Started',
            extra: 'unchanged',
        }

        const config = null
        const vars = { customerName: 'Alice' }
        const fieldMap = {
            subject: 'subject',
            greeting: 'greeting',
            ctaLabel: 'ctaLabel',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(result.subject).toBe('Welcome Alice!')
        expect(result.greeting).toBe('Hello')
        expect(result.ctaLabel).toBe('Get Started')
        expect(result.extra).toBe('unchanged')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-06] non-empty config field overrides default', () => {
        // Arrange
        const defaults = {
            subject: 'Default {type} Subject',
            greeting: 'Default Greeting',
            bodyText: 'Default Body',
        }

        const config: EmailTemplateConfig = {
            enabled: true,
            greeting: 'Hi there',
        }

        const vars = { type: 'Order' }
        const fieldMap = {
            subject: 'subject',
            greeting: 'greeting',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(result.subject).toBe('Default Order Subject') // subject only from defaults, with variables substituted
        expect(result.greeting).toBe('Hi there') // from config override
        expect(result.bodyText).toBe('Default Body')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-07] empty string config field does NOT override default (falls back)', () => {
        // Arrange
        const defaults = {
            subject: 'Default Subject',
            greeting: 'Default Greeting',
            ctaLabel: 'Default CTA',
        }

        const config: EmailTemplateConfig = {
            enabled: true,
            greeting: 'Custom Greeting',
            ctaLabel: '', // empty string should NOT override
        }

        const vars = {}
        const fieldMap = {
            subject: 'subject',
            greeting: 'greeting',
            ctaLabel: 'ctaLabel',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(result.subject).toBe('Default Subject') // subject always from defaults
        expect(result.greeting).toBe('Custom Greeting')
        expect(result.ctaLabel).toBe('Default CTA') // empty string falls back to default
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-05.1] substitutes variables in defaults and config overrides', () => {
        // Arrange
        const defaults = {
            subject: 'Hello {name}',
            greeting: 'Welcome to {brandName}',
        }

        const config: EmailTemplateConfig = {
            enabled: true,
            greeting: 'Hi {name}!', // overrides default greeting
        }

        const vars = {
            name: 'Bob',
            brandName: 'MyBrand',
        }

        const fieldMap = {
            subject: 'subject',
            greeting: 'greeting',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(result.subject).toBe('Hello Bob') // subject from defaults only, with variables substituted
        expect(result.greeting).toBe('Hi Bob!') // greeting from config override with variables substituted
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-05.2] does not mutate defaults object', () => {
        // Arrange
        const defaults = {
            subject: 'Default {var}',
            greeting: 'Hello',
        }

        const originalDefaults = JSON.parse(JSON.stringify(defaults))

        const config: EmailTemplateConfig = {
            enabled: true,
            subject: 'Custom',
        }

        const vars = { var: 'value' }
        const fieldMap = {
            subject: 'subject',
            greeting: 'greeting',
        }

        // Act
        mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(defaults).toEqual(originalDefaults)
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-06.1] handles missing fieldMap entries gracefully', () => {
        // Arrange
        const defaults = {
            subject: 'Subject',
            greeting: 'Greeting',
            closingText: 'Regards',
        }

        const config: EmailTemplateConfig = {
            enabled: true,
            closing: 'Best',
        }

        const vars = {}
        const fieldMap = {
            subject: 'subject',
            // greeting is NOT mapped
            closing: 'closingText',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        expect(result.subject).toBe('Subject') // subject always from defaults
        expect(result.greeting).toBe('Greeting') // unchanged (not mapped)
        expect(result.closingText).toBe('Best') // from config override
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-M-03.2] HTML-escapes values when merging config overrides', () => {
        // Arrange
        const defaults = {
            greeting: 'Hello {name}',
        }

        const config: EmailTemplateConfig = {
            enabled: true,
            greeting: 'Hi {name}', // override with a template containing a token
        }

        const vars = {
            name: 'User<script>alert(1)</script>',
        }

        const fieldMap = {
            greeting: 'greeting',
        }

        // Act
        const result = mergeTemplateConfig(defaults, config, vars, fieldMap)

        // Assert
        // The override "Hi {name}" is used, then {name} is substituted and escaped
        expect(result.greeting).toBe('Hi User&lt;script&gt;alert(1)&lt;/script&gt;')
        expect(result.greeting).not.toContain('<script>')
    })
})
