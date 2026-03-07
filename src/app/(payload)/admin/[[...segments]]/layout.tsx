import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
import config from '@payload-config'
import React from 'react'

export { generateMetadata } from '@payloadcms/next/layouts'

type Args = {
    children: React.ReactNode
}

const Layout = ({ children }: Args) => <RootLayout config={config}>{children}</RootLayout>

export default Layout
