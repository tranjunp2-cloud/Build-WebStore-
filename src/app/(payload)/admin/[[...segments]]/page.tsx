import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '@payload-config'

export const generateMetadata = () => generatePageMetadata({ config })

const Page = ({ params, searchParams }: any) => (
    <RootPage config={config} params={params} searchParams={searchParams} />
)

export default Page
