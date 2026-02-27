// Quick proxy test — run AFTER starting both servers
setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/documents')
    const data = await res.text()
    console.log('✅ Proxy test PASSED — response:', data.substring(0, 150))
  } catch (e) {
    console.log('❌ Proxy test FAILED:', e.message)
  }
  process.exit(0)
}, 1000)
