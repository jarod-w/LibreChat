const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireAdmin } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth);
router.use(requireAdmin);

/** GET /api/admin/users - paginated user list with search & filter */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      provider,
      emailVerified,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { username: re }];
    }
    if (role) filter.role = role;
    if (provider) filter.provider = provider;
    if (emailVerified !== undefined) filter.emailVerified = emailVerified === 'true';

    const User = mongoose.models.User;
    const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -totpSecret -backupCodes -refreshToken -__v')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error('[admin/users] GET / error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** GET /api/admin/users/:id */
router.get('/:id', async (req, res) => {
  try {
    const User = mongoose.models.User;
    const user = await User.findById(req.params.id)
      .select('-password -totpSecret -backupCodes -refreshToken -__v')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found', error_code: 'NOT_FOUND' });
    }
    res.json({ user });
  } catch (err) {
    logger.error('[admin/users] GET /:id error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** PATCH /api/admin/users/:id - update role, emailVerified, name, username */
router.patch('/:id', async (req, res) => {
  try {
    const ALLOWED = ['role', 'emailVerified', 'name', 'username'];
    const update = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'No valid fields to update', error_code: 'NO_FIELDS' });
    }
    const User = mongoose.models.User;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true },
    )
      .select('-password -totpSecret -backupCodes -refreshToken -__v')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found', error_code: 'NOT_FOUND' });
    }
    res.json({ user });
  } catch (err) {
    logger.error('[admin/users] PATCH /:id error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** POST /api/admin/users/:id/ban - set expiresAt to far future */
router.post('/:id/ban', async (req, res) => {
  try {
    const User = mongoose.models.User;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { expiresAt: new Date('9999-12-31') } },
      { new: true },
    )
      .select('-password -totpSecret -backupCodes -refreshToken -__v')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found', error_code: 'NOT_FOUND' });
    }
    res.json({ user });
  } catch (err) {
    logger.error('[admin/users] POST /:id/ban error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** POST /api/admin/users/:id/unban - clear expiresAt */
router.post('/:id/unban', async (req, res) => {
  try {
    const User = mongoose.models.User;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $unset: { expiresAt: '' } },
      { new: true },
    )
      .select('-password -totpSecret -backupCodes -refreshToken -__v')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found', error_code: 'NOT_FOUND' });
    }
    res.json({ user });
  } catch (err) {
    logger.error('[admin/users] POST /:id/unban error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
