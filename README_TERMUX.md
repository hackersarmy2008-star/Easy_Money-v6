# Quick Deploy on Termux (Temporary)

**Prereqs:** Install Termux from F-Droid (recommended). Open Termux.

```bash
# copy your project folder to device, then in Termux:
cd ~/Easy-Money
bash start-termux.sh
```

The app serves on `http://0.0.0.0:5000`. On the same device, open your browser to `http://localhost:5000`.

To share on the internet temporarily, you can use Cloudflared (optional):
```bash
pkg install -y cloudflared
cloudflared tunnel --url http://localhost:5000
```

## Manual steps (if you prefer)

```bash
pkg update -y
pkg install -y nodejs sqlite
npm ci || npm install
node server.js
```
