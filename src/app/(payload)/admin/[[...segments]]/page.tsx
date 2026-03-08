/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '@payload-config'
import { importMap } from '../importMap.js'

type Args = {
    params: Promise<{ segments: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({
    params,
    searchParams,
}: {
    params: Promise<{ segments: string[] }>
    searchParams: Promise<{ [key: string]: string | string[] }>
}): Promise<Metadata> =>
    generatePageMetadata({ config, params, searchParams })

const Page = ({ params, searchParams }: Args) => (
    <RootPage
        config={config}
        importMap={importMap}
        params={params}
        searchParams={searchParams}
    />
)

export default Page
