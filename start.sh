#!/usr/bin/bash
#
#
#

pm2 stop librechat

pm2 delete librechat

pm2 start npm --name "librechat" -- run backend


