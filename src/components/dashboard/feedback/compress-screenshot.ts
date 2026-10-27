// Vercel limits request bodies to ~4.5 MB; the dialog still accepts originals up to 5 MB, so
// anything above this target is re-encoded as JPEG before upload.
const TARGET_BYTES = 3.5 * 1024 * 1024
const MAX_EDGE = 2560
const QUALITIES = [0.85, 0.7, 0.55]

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/** Returns the file untouched when small enough; otherwise a smaller JPEG (or the original if that fails). */
export async function compressScreenshot(file: File): Promise<File> {
    if (file.size <= TARGET_BYTES) return file

    let bitmap: ImageBitmap
    try {
        bitmap = await createImageBitmap(file)
    } catch {
        return file
    }

    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 3; attempt++) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) break
        ctx.fillStyle = '#fff' // PNG transparency has no JPEG equivalent
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const blob = await toBlob(canvas, QUALITIES[attempt])
        if (blob && blob.size <= TARGET_BYTES) {
            bitmap.close()
            return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
        }
        scale *= 0.75
    }
    bitmap.close()
    return file
}
