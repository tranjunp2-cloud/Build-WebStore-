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

    // Convert File to ArrayBuffer to Buffer for Payload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Server-side magic byte validation (BUG-F17.30 / TC-F17-02-13)
    // Prevents upload of renamed malicious files (.exe → .jpg) that bypass client accept attribute
    const ALLOWED_SIGNATURES = [
        { bytes: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },       // JPEG
        { bytes: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },  // PNG
    ]
    const fileBytes = new Uint8Array(buffer.slice(0, 4))
    const isValidImage = ALLOWED_SIGNATURES.some(sig =>
        sig.bytes.every((b, i) => fileBytes[i] === b)
    )
    if (!isValidImage) {
        throw new Error('Invalid file type. Only JPEG and PNG images are accepted.')
    }

    const payload = await getPayload({ config: configPromise })
    
    // Create the media document in Payload
    try {
        const res = await payload.create({
            collection: 'media',
            data: {
                alt: file.name || `upload-${Date.now()}`,
            },
            file: {
                data: buffer,
                name: file.name || `upload-${Date.now()}.jpg`,
                mimetype: file.type || 'image/jpeg',
                size: file.size,
            },
            user: user as Parameters<typeof payload.create>[0]['user'],
        })

        return JSON.parse(JSON.stringify(res))
    } catch (err) {
        console.error('[uploadMediaAction] Upload failed:', err)
        throw err
    }
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
