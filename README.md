# 🚀 Easy-Money – Termux Setup Guide

This project can be run directly inside **Termux** on Android.  
Follow the steps below to install all dependencies and start the app.

---

## ⚙️ Installation Commands (Termux)

Copy and paste the following commands **one by one** in your Termux terminal:

```bash
pkg update -y && pkg upgrade -y

pkg install -y nodejs-lts git python clang make pkg-config sqlite

pkg install -y tmux

termux-wake-lock

termux-setup-storage

cd storage
cd download
cd Easy-Money

npm config set python python3

npm install

npm install express body-parser cors jsonwebtoken bcryptjs sql.js

npm run start

npm install dotenv

pkg install -y cloudflared
cloudflared tunnel --url {YOUR_URL_HERE}cloudflared tunnel --url {provided url} '''
