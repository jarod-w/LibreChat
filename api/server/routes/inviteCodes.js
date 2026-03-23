const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { checkAdmin } = require('~/server/middleware/roles');
const {
  createInviteCode,
  listInviteCodes,
  getInviteCode,
  updateInviteCode,
  deleteInviteCode,
} = require('~/server/controllers/InviteCodeController');

const router = express.Router();

// All routes require JWT authentication and admin role
router.use(requireJwtAuth);
router.use(checkAdmin);

/**
 * Create a new invite code.
 * @route POST /api/invite-codes
 */
router.post('/', createInviteCode);

/**
 * List all invite codes with pagination.
 * @route GET /api/invite-codes
 */
router.get('/', listInviteCodes);

/**
 * Get a single invite code by ID.
 * @route GET /api/invite-codes/:id
 */
router.get('/:id', getInviteCode);

/**
 * Update an invite code.
 * @route PATCH /api/invite-codes/:id
 */
router.patch('/:id', updateInviteCode);

/**
 * Delete an invite code.
 * @route DELETE /api/invite-codes/:id
 */
router.delete('/:id', deleteInviteCode);

module.exports = router;
