# 🚀 Deployment Guide (VPS)

This guide walks you through deploying the latest **MongoDB** and **Local Storage** changes to your VPS.

## 1. Login to VPS
Connect to your server via SSH:
```bash
ssh ubuntu@51.222.156.30
```
*(Enter password if prompted)*

## 2. Install MongoDB
Since we removed Firebase, we need MongoDB for the database.
Run these commands to install MongoDB Community Edition on Ubuntu:

```bash
# Import the public key used by the package management system
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor

# Create a list file for MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Reload local package database
sudo apt-get update

# Install the MongoDB packages
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Enable MongoDB to start on reboot
sudo systemctl enable mongod

# Verify it's running (should say "active (running)")
sudo systemctl status mongod
```

## 3. Pull Latest Code
Navigate to your project directory and pull the changes:

```bash
cd ~/Documents/Dhanuk/AutoSongStudio
git checkout default
git pull origin default
```

## 4. Install New Dependencies
We added `mongoose` and removed `firebase-admin`. Update `node_modules`:

```bash
cd backend
npm install
```

## 5. Update Environment Variables (.env)
You need to add the MongoDB URL and Storage Path to your `.env` file.

Open the file:
```bash
nano .env
```

**Add/Update these lines:**
```env
# Database
MONGO_URL=mongodb://localhost:27017/autosong
STORAGE_PATH=/home/ubuntu/autosong_storage

# REMOVE THIS LINE (No longer needed):
# FIREBASE_JSON_BASE64=...
```
*(Press `Ctrl+X`, then `Y`, then `Enter` to save)*

## 6. Restart Backend with PM2
Restart your services to apply changes.

```bash
# Delete old processes (optional, but good for clean slate)
pm2 delete all

# Start API Server
pm2 start server.js --name "autosong-api"

# Start Workers
pm2 start workers/index.js --name "autosong-workers"

# Save list so they revive on reboot
pm2 save
pm2 startup
```

## 7. Verify Deployment
Check the logs to ensure everything connected successfully:

```bash
pm2 logs
```
You should see:
- `✅ Connected to MongoDB` (in api logs)
- `✅ Workers connected to MongoDB` (in worker logs)
