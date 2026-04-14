'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function uploadMediaAction(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')
    const altRaw = formData.get('alt')
    const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : file.name

    // Convert File to ArrayBuffer to Buffer for Payload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = await getPayload({ config: configPromise })

    // Magic byte validation handled by Media.ts beforeChange hook
    const res = await payload.create({
        collection: 'media',
        data: {
            alt,
        },
        file: {
            data: buffer,
            name: file.name,
            mimetype: file.type,
            size: file.size,
        },
        user: user as any,
    })

    return JSON.parse(JSON.stringify(res))
}

export async function getOrCreateCrateCartonIdAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    
    // Check if crate carton placeholder already exists
    const existing = await payload.find({
        collection: 'media',
        where: {
            alt: { equals: 'Crate Carton Placeholder' }
        },
        limit: 1
    })

    if (existing.docs.length > 0) {
        return existing.docs[0].id
    }

    // Try to read the static crate carton file backwards compatible location
    try {
        const filePath = path.join(process.cwd(), 'public', 'images', 'crate-carton.png')
        if (!fs.existsSync(filePath)) {
            console.error('[Crate Carton Seed] Local placeholder not found:', filePath)
            return null
        }
        const fileData = fs.readFileSync(filePath)
        
        const res = await payload.create({
            collection: 'media',
            data: {
                alt: 'Crate Carton Placeholder',
            },
            file: {
                data: fileData,
                name: 'crate-carton-placeholder.png',
                mimetype: 'image/png',
                size: fileData.length,
            },
            user: user as Parameters<typeof payload.create>[0]['user'],
        })
        
        return res.id
    } catch (err) {
        console.error('Failed to create crate carton placeholder from local file', err)
        return null
    }
}
