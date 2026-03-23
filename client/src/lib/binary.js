/** Encode Uint8Array to base64 without stack overflow on large buffers. */
export function uint8ToBase64(u8) {
  const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
