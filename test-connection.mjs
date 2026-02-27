// Quick test: backend direct + proxy through Vite
async function test() {
  console.log('--- Testing backend directly (localhost:3001) ---')
  try {
    const r1 = await fetch('http://localhost:3001/health')
    console.log('✅ Backend health:', await r1.json())
  } catch (e) {
    console.log('❌ Backend unreachable:', e.message)
  }

  try {
    const r2 = await fetch('http://localhost:3001/api/documents')
    console.log('✅ Backend /api/documents:', (await r2.json()).length, 'docs')
  } catch (e) {
    console.log('❌ Backend /api/documents failed:', e.message)
  }

  console.log('\n--- Testing via Vite proxy (localhost:3000) ---')
  try {
    const r3 = await fetch('http://localhost:3000/api/documents')
    console.log('✅ Proxy /api/documents:', (await r3.json()).length, 'docs')
  } catch (e) {
    console.log('❌ Proxy /api/documents failed:', e.message)
  }
}
test()
