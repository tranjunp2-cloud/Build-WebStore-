import 'server-only'

import { SignJWT } from 'jose'
import { getAiPlatformContextSecret } from '@/lib/ai-platform/config'

export interface SettingsActor {
  id: string
  email: string
}

export const SETTINGS_TOKEN_ISSUER = 'prime-web'
export const SETTINGS_TOKEN_AUDIENCE = 'ai-platform:internal'
export const SETTINGS_TOKEN_SUBJECT = 'settings-admin'

/** Short-lived HS256 token for the internal settings API; `actor` is the super-admin prime-web verified. */
export async function signSettingsToken(actor: SettingsActor): Promise<string> {
  const secret = getAiPlatformContextSecret()
  if (!secret) throw new Error('AI_PLATFORM_CONTEXT_SECRET is not configured.')
  return new SignJWT({ actor: { id: actor.id, email: actor.email } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SETTINGS_TOKEN_ISSUER)
    .setAudience(SETTINGS_TOKEN_AUDIENCE)
    .setSubject(SETTINGS_TOKEN_SUBJECT)
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(new TextEncoder().encode(secret))
}
