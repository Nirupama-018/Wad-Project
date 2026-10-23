
const mongoose = require("mongoose");

const scheduledMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    encryptedContent: {
      type: String,
      required: true,
    },

    iv: {
      type: String,
      required: true,
    },

    authTag: {
      type: String,
      required: true,
    },

    keyVersion: {
      type: String,
      required: true,
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "sent", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    attempts: {
  type: Number,
  default: 0,
  min: 0,
},

lastAttemptAt: {
  type: Date,
  default: null,
},
claimToken: {
  type: String,
  default: null,
},

    sentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

scheduledMessageSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model(
  "ScheduledMessage",
  scheduledMessageSchema
);
