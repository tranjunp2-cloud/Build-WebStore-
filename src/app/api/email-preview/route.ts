/**
 * POST /api/email-preview
 * Renders an email template with demo fixture data and optional draft config.
 * No DB write, no email send — preview only.
 */

import { withAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { EMAIL_TEMPLATE_TYPES, type EmailTemplateType, type EmailTemplateConfig } from '@/lib/email/types'
import { templateRegistry } from '@/lib/email/template-registry'
import { EMAIL_PREVIEW_FIXTURES } from '@/lib/email/preview-fixtures'

export const POST = withAuth(async (_user, req) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { templateType, locale, draftConfig } = body as {
    templateType: unknown
    locale?: unknown
    draftConfig?: unknown
  }

  if (typeof templateType !== 'string' || !EMAIL_TEMPLATE_TYPES.includes(templateType as EmailTemplateType)) {
    return NextResponse.json({ error: 'Invalid templateType' }, { status: 400 })
  }

  const type = templateType as EmailTemplateType
  const validLocale = typeof locale === 'string' && ['en', 'ms'].includes(locale) ? locale : 'en'
  // Override fixture locale so the template renders in the correct language
  const fixture = { ...EMAIL_PREVIEW_FIXTURES[type], locale: validLocale }

  // draftConfig is optional; if provided it must be a plain object
  const config: EmailTemplateConfig | undefined =
    draftConfig != null && typeof draftConfig === 'object' && !Array.isArray(draftConfig)
      ? (draftConfig as EmailTemplateConfig)
      : undefined

  try {
    const { subject, html } = templateRegistry[type](fixture, config)
    return NextResponse.json({ subject, html })
  } catch (err) {
    // Surface render errors (e.g. missing i18n key) as 500 — do not log html content
    console.error('[email-preview] render error for type:', type, err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Template render failed' }, { status: 500 })
  }
})
