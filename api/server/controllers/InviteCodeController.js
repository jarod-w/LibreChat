const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const InviteCode = require('~/models/InviteCode');

/**
 * Generate a random invite code string.
 * @param {number} length - Length of the code (default 8)
 * @returns {string} Uppercase alphanumeric code
 */
function generateCode(length = 8) {
  return crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();
}

/**
 * Create a new invite code.
 * POST /api/invite-codes
 */
const createInviteCode = async (req, res) => {
  try {
    const { code, maxUses = 0, expiresAt = null, note = '' } = req.body;

    const inviteCode = new InviteCode({
      code: code || generateCode(),
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      note,
      createdBy: req.user._id,
    });

    const saved = await inviteCode.save();
    logger.info(`[InviteCode] Created invite code: ${saved.code} by user: ${req.user._id}`);
    return res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Invite code already exists.' });
    }
    logger.error('[InviteCode] Error creating invite code:', error);
    return res.status(500).json({ message: 'Error creating invite code.' });
  }
};

/**
 * List all invite codes with pagination.
 * GET /api/invite-codes?page=1&limit=20
 */
const listInviteCodes = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      InviteCode.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InviteCode.countDocuments(),
    ]);

    return res.status(200).json({
      codes,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('[InviteCode] Error listing invite codes:', error);
    return res.status(500).json({ message: 'Error listing invite codes.' });
  }
};

/**
 * Get a single invite code by ID.
 * GET /api/invite-codes/:id
 */
const getInviteCode = async (req, res) => {
  try {
    const code = await InviteCode.findById(req.params.id).lean();
    if (!code) {
      return res.status(404).json({ message: 'Invite code not found.' });
    }
    return res.status(200).json(code);
  } catch (error) {
    logger.error('[InviteCode] Error getting invite code:', error);
    return res.status(500).json({ message: 'Error getting invite code.' });
  }
};

/**
 * Update an invite code.
 * PATCH /api/invite-codes/:id
 */
const updateInviteCode = async (req, res) => {
  try {
    const allowedUpdates = ['maxUses', 'expiresAt', 'isActive', 'note'];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = key === 'expiresAt' && req.body[key] ? new Date(req.body[key]) : req.body[key];
      }
    }

    const code = await InviteCode.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!code) {
      return res.status(404).json({ message: 'Invite code not found.' });
    }

    logger.info(`[InviteCode] Updated invite code: ${code.code} by user: ${req.user._id}`);
    return res.status(200).json(code);
  } catch (error) {
    logger.error('[InviteCode] Error updating invite code:', error);
    return res.status(500).json({ message: 'Error updating invite code.' });
  }
};

/**
 * Delete an invite code.
 * DELETE /api/invite-codes/:id
 */
const deleteInviteCode = async (req, res) => {
  try {
    const code = await InviteCode.findByIdAndDelete(req.params.id);
    if (!code) {
      return res.status(404).json({ message: 'Invite code not found.' });
    }

    logger.info(`[InviteCode] Deleted invite code: ${code.code} by user: ${req.user._id}`);
    return res.status(200).json({ message: 'Invite code deleted.' });
  } catch (error) {
    logger.error('[InviteCode] Error deleting invite code:', error);
    return res.status(500).json({ message: 'Error deleting invite code.' });
  }
};

module.exports = {
  createInviteCode,
  listInviteCodes,
  getInviteCode,
  updateInviteCode,
  deleteInviteCode,
};
