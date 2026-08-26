import { redirect } from 'next/navigation'

/**
 * /register route — DISABLED per PRD F02 §4.3
 *
 * Owner accounts are created exclusively via SSO auto-provisioning.
 * Staff accounts are created via Owner invitation in CMS.
 * No self-registration is allowed.
 *
 * This page redirects to /login to prevent direct access.
 */
export default function RegisterPage() {
    redirect('/login')
}
