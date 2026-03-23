const { isEnabled } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const InviteCode = require('~/models/InviteCode');

/**
 * Middleware to check invite code during registration.
 * Only active when REQUIRE_INVITE_CODE=true.
 * Sets req.inviteCode if a valid invite code is provided.
 */
async function checkInviteCode(req, res, next) {
  if (!isEnabled(process.env.REQUIRE_INVITE_CODE)) {
    return next();
  }

  const { inviteCode } = req.body;

  if (!inviteCode) {
    return res.status(403).json({ message: 'Invite code is required.' });
  }

  try {
    const code = await InviteCode.findOne({ code: inviteCode, isActive: true });

    if (!code) {
      logger.warn(`[checkInviteCode] Invalid invite code attempted: ${inviteCode}`);
      return res.status(403).json({ message: 'Invalid invite code.' });
    }

    if (code.expiresAt && code.expiresAt < new Date()) {
      logger.warn(`[checkInviteCode] Expired invite code used: ${inviteCode}`);
      return res.status(403).json({ message: 'Invite code has expired.' });
    }

    if (code.maxUses > 0 && code.usedCount >= code.maxUses) {
      logger.warn(`[checkInviteCode] Invite code usage limit reached: ${inviteCode}`);
      return res.status(403).json({ message: 'Invite code has reached its usage limit.' });
    }

    req.inviteCode = code;
    next();
  } catch (error) {
    logger.error('[checkInviteCode] Error checking invite code:', error);
    return res.status(500).json({ message: 'Error validating invite code.' });
  }
}

module.exports = checkInviteCode;
