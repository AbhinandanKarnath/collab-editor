const os = require('os');

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

const localIP = getLocalIPAddress();

console.log('\n' + '='.repeat(60));
console.log('🌐 NETWORK CONFIGURATION');
console.log('='.repeat(60));
console.log('\n📍 Your Local IP Address:', localIP);
console.log('\n📋 SETUP INSTRUCTIONS:\n');
console.log('1. Create client/.env with:');
console.log('   VITE_SERVER_URL=http://' + localIP + ':3001');
console.log('\n2. Access from other computers:');
console.log('   Frontend: http://' + localIP + ':3000');
console.log('   Backend:  http://' + localIP + ':3001');
console.log('\n3. Make sure Windows Firewall allows ports 3000 & 3001');
console.log('\n' + '='.repeat(60) + '\n');
