const mongoose = require('mongoose');

const inviteCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    maxUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        email: { type: String },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

const InviteCode = mongoose.model('InviteCode', inviteCodeSchema);

module.exports = InviteCode;
