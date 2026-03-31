export async function processImageFile(file: File, maxSizeMB = 2): Promise<File> {
    const sizeMB = file.size / (1024 * 1024)
    
    // If it's under the limit or not an image (e.g., svg, gif), return as is
    if (sizeMB <= maxSizeMB || !file.type.startsWith('image/')) {
        return file
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let { width, height } = img

                // Max dimensions to prevent crazy scale
                const MAX_WIDTH = 1920
                const MAX_HEIGHT = 1920

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width)
                        width = MAX_WIDTH
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round((width * MAX_HEIGHT) / height)
                        height = MAX_HEIGHT
                    }
                }

                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    return resolve(file)
                }
                
                ctx.drawImage(img, 0, 0, width, height)

                // Compress with WebP for better reduction
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return resolve(file)
                        const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        })
                        resolve(processedFile)
                    },
                    'image/webp',
                    0.8 // 80% quality
                )
            }
            img.onerror = (error) => reject(error)
        }
        reader.onerror = (error) => reject(error)
    })
}
