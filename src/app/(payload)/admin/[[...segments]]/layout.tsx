import type { ServerFunctionClient } from 'payload'
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
/* Import full Payload CSS with theme variable definitions.
 * Without this, --theme-elevation-*, --color-base-* are undefined. */
import '@payloadcms/next/css'
import config from '@payload-config'
import React from 'react'
import { importMap } from '../importMap.js'

export { metadata } from '@payloadcms/next/layouts'

const serverFunction: ServerFunctionClient = async (args) => {
    'use server'
    return handleServerFunctions({
        ...args,
        config,
        importMap,
    })
}

type Args = {
    children: React.ReactNode
}

const Layout = ({ children }: Args) => (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
        {children}
    </RootLayout>
)

export default Layout
