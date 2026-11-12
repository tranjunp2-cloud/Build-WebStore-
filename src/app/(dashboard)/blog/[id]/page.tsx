import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { getTenantId, isSuperAdmin, type UserWithTenants } from '@/lib/blog/blog-access'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import BlogEditorPageClient from './BlogEditorPageClient'

type BlogEditorPageProps = {
    params: Promise<{ id: string }>
}

/**
 * Whether the signed-in user may open this post — the same rule as getBlogByIdAction (own workspace, or a
 * super-admin), read as one `tenant` column. This check loaded the whole post at depth 2 and threw it away; the
 * client then loads it again through getBlogByIdAction (TC-PERF-074).
 */
async function canOpenBlog(id: string): Promise<boolean> {
    const user = (await getCurrentUser()) as UserWithTenants | null
    if (!user) return false
    const payload = await getPayload({ config })
    const blog = (await payload.findByID({
        collection: 'blogs',
        id,
        depth: 0,
        disableErrors: true,
        select: { tenant: true },
    })) as { tenant?: string | number | { id: string | number } | null } | null
    if (!blog) return false
    if (isSuperAdmin(user)) return true
    const tenantId = getTenantId(user)
    const blogTenantId = typeof blog.tenant === 'object' ? blog.tenant?.id : blog.tenant
    return Boolean(tenantId && blogTenantId && String(tenantId) === String(blogTenantId))
}

export default async function BlogEditorPage({ params }: BlogEditorPageProps) {
    const { id } = await params

    if (id !== 'new' && !(await canOpenBlog(id))) notFound()

    return <BlogEditorPageClient agentEnabled={isAiAgentEnabled()} />
}
