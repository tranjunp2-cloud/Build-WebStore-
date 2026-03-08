import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '@payload-config'
import { importMap } from '../importMap.js'

type PageProps = {
    params: Promise<{ segments?: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const paramsPromise = (params: Promise<{ segments?: string[] }>) =>
    params.then((p) => ({ segments: p.segments ?? [] }))

const searchParamsPromise = (searchParams: Promise<{ [key: string]: string | string[] | undefined }>) =>
    searchParams.then((s) => s as { [key: string]: string | string[] })

export const generateMetadata = ({ params, searchParams }: PageProps) =>
    generatePageMetadata({
        config,
        params: paramsPromise(params),
        searchParams: searchParamsPromise(searchParams),
    })

const Page = async ({ params, searchParams }: PageProps) => (
    <RootPage
        config={config}
        importMap={importMap}
        params={paramsPromise(params)}
        searchParams={searchParamsPromise(searchParams)}
    />
)

export default Page
