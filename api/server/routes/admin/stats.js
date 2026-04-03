const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireAdmin } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth);
router.use(requireAdmin);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

/** GET /api/admin/stats */
router.get('/', async (req, res) => {
  try {
    const User = mongoose.models.User;
    const Conversation = mongoose.models.Conversation;
    const Transaction = mongoose.models.Transaction;
    const InviteCode = mongoose.models.InviteCode;

    const today = startOfToday();
    const week = startOfWeek();

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      totalConvos,
      todayConvos,
      allTokenStats,
      todayTokenStats,
      activeInviteCodes,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: week } }),
      Conversation ? Conversation.countDocuments({}) : Promise.resolve(0),
      Conversation ? Conversation.countDocuments({ createdAt: { $gte: today } }) : Promise.resolve(0),
      Transaction
        ? Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$tokenValue' } } }])
        : Promise.resolve([]),
      Transaction
        ? Transaction.aggregate([
          { $match: { createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$tokenValue' } } },
        ])
        : Promise.resolve([]),
      InviteCode ? InviteCode.countDocuments({ isActive: true }) : Promise.resolve(0),
    ]);

    res.json({
      users: {
        total: totalUsers,
        today: todayUsers,
        thisWeek: weekUsers,
      },
      conversations: {
        total: totalConvos,
        today: todayConvos,
      },
      tokens: {
        totalConsumed: allTokenStats[0]?.total ?? 0,
        today: todayTokenStats[0]?.total ?? 0,
      },
      inviteCodes: {
        active: activeInviteCodes,
      },
    });
  } catch (err) {
    logger.error('[admin/stats] GET / error:', err);
    res.status(500).json({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
