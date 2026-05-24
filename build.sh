#!/usr/bin/bash

pm2 stop librechat

pm2 delete librechat

export NODE_OPTIONS="--max-old-space-size=4096"
npm install
npm run frontend


