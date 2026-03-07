import Link from 'next/link'
import { Globe, Pencil, ExternalLink } from 'lucide-react'

type SiteCardData = {
    id: string
    name: string
    slug: string
    isPublished: boolean
    updatedAt: string
}

function SiteCard({ site }: { site: SiteCardData }) {
    const status = site.isPublished ? 'Published' : 'Draft'

    return (
        <div className="group rounded-xl border border-white/10 bg-[#1E293B] overflow-hidden transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5">
            {/* Thumbnail preview */}
            <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <Globe className="h-10 w-10 text-gray-700" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Link
                        href={`/editor/${site.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                        Open Editor
                    </Link>
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white truncate">{site.name}</h3>
                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${site.isPublished
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                    >
                        {status}
                    </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                    Last edited: {site.updatedAt}
                </p>
                <div className="mt-3 flex gap-2">
                    <Link
                        href={`/editor/${site.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                        <Pencil className="h-3 w-3" /> Edit
                    </Link>
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3 w-3" /> Preview
                    </button>
                </div>
            </div>
        </div>
    )
}

export function DashboardSiteGrid({ sites }: { sites: SiteCardData[] }) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">My Websites</h2>
                {sites.length > 6 && (
                    <Link href="/dashboard/sites" className="text-sm text-blue-400 hover:text-blue-300">
                        View All →
                    </Link>
                )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => (
                    <SiteCard key={site.id} site={site} />
                ))}
            </div>
        </div>
    )
}
