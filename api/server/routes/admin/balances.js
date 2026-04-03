const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireAdmin } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth);
router.use(requireAdmin);

/** GET /api/admin/balances - paginated list sorted by balance ascending */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const Balance = mongoose.models.Balance;
    const [balances, total] = await Promise.all([
      Balance.find({})
        .populate('user', 'name email avatar username')
        .sort({ tokenCredits: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Balance.countDocuments({}),
    ]);

    res.json({ balances, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error('[admin/balances] GET / error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** GET /api/admin/balances/:userId */
router.get('/:userId', async (req, res) => {
  try {
    const Balance = mongoose.models.Balance;
    const balance = await Balance.findOne({ user: req.params.userId })
      .populate('user', 'name email avatar username')
      .lean();
    if (!balance) {
      return res.status(404).json({ error: 'Balance not found', error_code: 'NOT_FOUND' });
    }
    res.json({ balance });
  } catch (err) {
    logger.error('[admin/balances] GET /:userId error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** PATCH /api/admin/balances/:userId - set absolute tokenCredits value */
router.patch('/:userId', async (req, res) => {
  try {
    const { tokenCredits } = req.body;
    if (typeof tokenCredits !== 'number' || isNaN(tokenCredits)) {
      return res
        .status(400)
        .json({ error: 'tokenCredits must be a number', error_code: 'INVALID_VALUE' });
    }
    const Balance = mongoose.models.Balance;
    const balance = await Balance.findOneAndUpdate(
      { user: req.params.userId },
      { $set: { tokenCredits } },
      { new: true, upsert: true },
    )
      .populate('user', 'name email avatar username')
      .lean();
    res.json({ balance });
  } catch (err) {
    logger.error('[admin/balances] PATCH /:userId error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

/** POST /api/admin/balances/:userId/add - increment/decrement tokenCredits */
router.post('/:userId/add', async (req, res) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res
        .status(400)
        .json({ error: 'amount must be a number', error_code: 'INVALID_VALUE' });
    }
    const Balance = mongoose.models.Balance;
    const balance = await Balance.findOneAndUpdate(
      { user: req.params.userId },
      { $inc: { tokenCredits: amount } },
      { new: true, upsert: true },
    )
      .populate('user', 'name email avatar username')
      .lean();
    res.json({ balance });
  } catch (err) {
    logger.error('[admin/balances] POST /:userId/add error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
