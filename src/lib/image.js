export async function compressImage(file, maxWidth = 900, quality = 0.78) {
  if (!file) return null
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const safeName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
        resolve(new File([blob], `${safeName || 'thumbnail'}.webp`, { type: 'image/webp' }))
      },
      'image/webp',
      quality
    )
  })
}
