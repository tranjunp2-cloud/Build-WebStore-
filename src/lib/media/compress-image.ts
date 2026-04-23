const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_WIDTH = 1920

export async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(img.src)
            if (img.width <= MAX_WIDTH && file.size <= MAX_SIZE) {
                resolve(file)
                return
            }
            const canvas = document.createElement('canvas')
            const scale = Math.min(1, MAX_WIDTH / img.width)
            canvas.width = img.width * scale
            canvas.height = img.height * scale
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => {
                resolve(blob ? new File([blob], file.name, { type: 'image/webp' }) : file)
            }, 'image/webp', 0.85)
        }
        img.src = URL.createObjectURL(file)
    })
}
