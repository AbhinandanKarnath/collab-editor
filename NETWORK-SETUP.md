# 🌐 Network Setup Guide for LAN Collaboration

This guide will help you set up the Collaborative Markdown Editor to work across different computers on your Local Area Network (LAN).

## 📋 Prerequisites

- All computers must be on the same network (LAN)
- Firewall settings must allow incoming connections on ports 3000 and 3001
- You know your server computer's local IP address

---

## 🔍 Step 1: Find Your Local IP Address

### On Windows (Server Computer):
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (WiFi or Ethernet).
Example: `192.168.1.100`

### On Mac/Linux:
```bash
ifconfig
# or
ip addr show
```
Look for your local IP (usually starts with 192.168.x.x or 10.0.x.x)

---

## 🛠️ Step 2: Configure Environment Variables

### On the Server Computer:

1. Create `client/.env` file (optional, auto-detected):
```env
VITE_SERVER_URL=http://YOUR_LOCAL_IP:3001
```
Replace `YOUR_LOCAL_IP` with your actual IP (e.g., `http://192.168.1.100:3001`)

2. Create `server/.env` file:
```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/collab-docs
```

---

## 🔥 Step 3: Configure Windows Firewall (Server Computer)

### Allow Incoming Connections:

1. **Open Windows Defender Firewall:**
   - Press `Win + R`
   - Type `wf.msc` and press Enter

2. **Create Inbound Rules:**
   
   **For Port 3000 (Frontend):**
   - Click "Inbound Rules" → "New Rule"
   - Select "Port" → Next
   - Select "TCP" → Specific local ports: `3000`
   - Select "Allow the connection" → Next
   - Check all profiles (Domain, Private, Public) → Next
   - Name: "React Vite Dev Server" → Finish

   **For Port 3001 (Backend):**
   - Click "Inbound Rules" → "New Rule"
   - Select "Port" → Next
   - Select "TCP" → Specific local ports: `3001`
   - Select "Allow the connection" → Next
   - Check all profiles (Domain, Private, Public) → Next
   - Name: "Node.js Socket.io Server" → Finish

### Quick PowerShell Method (Run as Administrator):
```powershell
New-NetFirewallRule -DisplayName "React Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Node Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

---

## 🚀 Step 4: Start the Application

On the **Server Computer**:

```bash
cd "E:\MCA\Sem VI\Project"
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3001
🌐 Server accessible on LAN at http://<your-local-ip>:3001

VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.100:3000/
```

---

## 💻 Step 5: Access from Other Computers

### On Client Computers (Same LAN):

1. **Open a web browser**

2. **Navigate to:**
   ```
   http://SERVER_LOCAL_IP:3000
   ```
   Example: `http://192.168.1.100:3000`

3. **Enter your name** and start collaborating!

---

## 🧪 Testing the Connection

### From Client Computer:

1. **Test Frontend Connection:**
   Open browser: `http://192.168.1.100:3000`

2. **Test Backend Connection:**
   Open browser: `http://192.168.1.100:3001/health`
   
   Should return:
   ```json
   {"status":"ok","timestamp":"2024-01-06T..."}
   ```

3. **Test Socket.io Connection:**
   Open browser console (F12) and check for:
   ```
   Connected to server: <socket-id>
   ```

---

## 🔧 Troubleshooting

### Issue: Cannot connect from other computers

**Solution 1: Check Firewall**
```powershell
# Run as Administrator
Get-NetFirewallRule -DisplayName "React Dev Server"
Get-NetFirewallRule -DisplayName "Node Server"
```

**Solution 2: Temporarily Disable Firewall (Testing Only)**
- Go to Windows Security → Firewall & network protection
- Turn off firewall for Private network (turn back on after testing)

**Solution 3: Check if ports are listening**
```cmd
netstat -an | findstr "3000 3001"
```
Should show:
```
TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING
TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING
```

### Issue: Connection works but not real-time sync

**Solution:**
- Check browser console for Socket.io errors
- Verify VITE_SERVER_URL in client/.env points to correct IP
- Restart both frontend and backend servers

### Issue: CORS errors in browser console

**Solution:**
Server is already configured to accept all origins. If issues persist, check:
```javascript
// In server/index.js, CORS is set to '*'
cors: {
  origin: '*',
  ...
}
```

---

## 📱 Mobile Device Access

You can also access the editor from mobile devices on the same WiFi network:

1. Open mobile browser
2. Navigate to: `http://SERVER_IP:3000`
3. Enter your name and collaborate!

---

## 🔒 Security Notes

**For Development/LAN Use:**
- Current setup accepts connections from any origin (`origin: '*'`)
- Fine for local network and development

**For Production:**
- Replace `origin: '*'` with specific allowed origins
- Use HTTPS with proper SSL certificates
- Implement proper authentication
- Use environment-based configuration

---

## 📊 Network Configuration Summary

| Computer | Access URL | Purpose |
|----------|-----------|---------|
| Server | `http://localhost:3000` | Direct access |
| Server | `http://192.168.1.100:3000` | LAN access |
| Client 1 | `http://192.168.1.100:3000` | LAN access |
| Client 2 | `http://192.168.1.100:3000` | LAN access |
| Client 3 | `http://192.168.1.100:3000` | LAN access |

Backend Server (Socket.io): `http://192.168.1.100:3001`

---

## ✅ Verification Checklist

- [ ] Found local IP address of server computer
- [ ] Updated `client/.env` with `VITE_SERVER_URL`
- [ ] Updated `server/.env` with MongoDB URI
- [ ] Created firewall rules for ports 3000 and 3001
- [ ] Started both frontend and backend servers
- [ ] Verified health endpoint: `http://SERVER_IP:3001/health`
- [ ] Accessed frontend from another computer
- [ ] Tested real-time collaboration between computers
- [ ] Checked browser console for connection status (🟢)

---

## 🎉 Success!

If you see the green indicator (🟢) in the editor header and can edit documents in real-time from multiple computers, congratulations! Your LAN setup is working perfectly.

---

## 📞 Need Help?

Common issues:
1. **Firewall blocking** - Most common issue
2. **Wrong IP address** - Double-check your local IP
3. **Network isolation** - Some routers isolate devices
4. **VPN interference** - Disconnect VPN and try again

Remember: Both computers must be on the same network (same WiFi/Ethernet router)!
