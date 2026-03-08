/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
import config from '@payload-config'
import { importMap } from '../importMap.js'
import React from 'react'
import type { ServerFunctionClient } from 'payload'

type Args = {
    children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function serverFunction(args) {
    'use server'
    return handleServerFunctions({
        ...args,
        config,
        importMap,
    })
}

const Layout = ({ children }: Args) => (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
        {children}
    </RootLayout>
)

export default Layout
