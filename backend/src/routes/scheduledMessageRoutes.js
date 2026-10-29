
const express = require("express");
const mongoose = require("../../../database/node_modules/mongoose");

const requireAuth = require("../middleware/requireAuth");
const Conversation = require("../../../database/src/models/Conversation");
const ScheduledMessage = require("../../../database/src/models/ScheduledMessage");
const messageService = require("../../../database/src/services/messageService");
const {
  encryptMessage,
  decryptMessage,
} = require("../../../database/src/utils/encryption");

const router = express.Router();

const ALLOWED_STATUSES = [
  "pending",
  "processing",
  "sent",
  "cancelled",
  "failed",
];

router.use(requireAuth);

function isValidId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function serializeMessage(message) {
  return {
    scheduledMessageId: message._id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    recipientId: message.recipientId.toString(),
    content: decryptMessage({
      encryptedContent: message.encryptedContent,
      iv: message.iv,
      authTag: message.authTag,
      keyVersion: message.keyVersion,
    }),
    scheduledAt: message.scheduledAt,
    status: message.status,
    attempts: message.attempts,
    sentMessageId: message.sentMessageId
      ? message.sentMessageId.toString()
      : null,
    failureReason: message.failureReason || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function isBadRequestError(error) {
  return /must be a future date|must contain|Invalid content|between 1 and 5000|scheduledAt/i.test(
    error.message || ""
  );
}

// POST /api/scheduled-messages
// Body: { conversationId, content, scheduledAt }
router.post("/", async (req, res) => {
  try {
    const { conversationId, content, scheduledAt } = req.body;

    if (!isValidId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid conversationId is required.",
      });
    }

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message content must contain 1–5000 characters.",
      });
    }

    const deliveryDate = new Date(scheduledAt);

    if (
      scheduledAt === undefined ||
      Number.isNaN(deliveryDate.getTime()) ||
      deliveryDate <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be a valid future date and time.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }).select("participants");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const recipientId = conversation.participants.find(
      (id) => id.toString() !== req.user._id.toString()
    );

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: "Could not identify the conversation recipient.",
      });
    }

    const scheduled = await messageService.scheduleMessage({
      conversationId,
      senderId: req.user._id.toString(),
      recipientId: recipientId.toString(),
      content,
      scheduledAt: deliveryDate,
    });

    return res.status(201).json({
      success: true,
      scheduledMessage: scheduled,
    });
  } catch (error) {
    if (isBadRequestError(error)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Schedule message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not schedule the message.",
    });
  }
});

// GET /api/scheduled-messages?status=pending
// Lists only messages created by the authenticated sender.
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled-message status.",
      });
    }

    const filter = {
      senderId: req.user._id,
      ...(status ? { status } : {}),
    };

    const messages = await ScheduledMessage.find(filter)
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      scheduledMessages: messages.map(serializeMessage),
    });
  } catch (error) {
    console.error("List scheduled messages error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load scheduled messages.",
    });
  }
});

// GET /api/scheduled-messages/:id
router.get("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled-message ID.",
      });
    }

    const message = await ScheduledMessage.findOne({
      _id: req.params.id,
      senderId: req.user._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Scheduled message not found.",
      });
    }

    return res.json({
      success: true,
      scheduledMessage: serializeMessage(message),
    });
  } catch (error) {
    console.error("Get scheduled message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not load the scheduled message.",
    });
  }
});

// PATCH /api/scheduled-messages/:id
// Body may contain content, scheduledAt, or both.
router.patch("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled-message ID.",
      });
    }

    const { content, scheduledAt } = req.body;
    const hasContent = Object.prototype.hasOwnProperty.call(
      req.body,
      "content"
    );
    const hasScheduledAt = Object.prototype.hasOwnProperty.call(
      req.body,
      "scheduledAt"
    );

    if (!hasContent && !hasScheduledAt) {
      return res.status(400).json({
        success: false,
        message: "Provide content or scheduledAt to update.",
      });
    }

    if (
      hasContent &&
      (typeof content !== "string" ||
        !content.trim() ||
        content.length > 5000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Message content must contain 1–5000 characters.",
      });
    }

    let deliveryDate;

    if (hasScheduledAt) {
      deliveryDate = new Date(scheduledAt);

      if (
        scheduledAt === undefined ||
        Number.isNaN(deliveryDate.getTime()) ||
        deliveryDate <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "scheduledAt must be a valid future date and time.",
        });
      }
    }

    const existing = await ScheduledMessage.findOne({
      _id: req.params.id,
      senderId: req.user._id,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Scheduled message not found.",
      });
    }

    if (existing.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending scheduled messages can be edited.",
      });
    }

    if (!hasScheduledAt && existing.scheduledAt <= new Date()) {
      return res.status(409).json({
        success: false,
        message: "This scheduled message is due and cannot be edited.",
      });
    }

    const updates = {};

    if (hasScheduledAt) {
      updates.scheduledAt = deliveryDate;
    }

    if (hasContent) {
      Object.assign(updates, encryptMessage(content));
    }

    // Atomic status check prevents editing a message already claimed
    // by the scheduled-message worker.
    const updated = await ScheduledMessage.findOneAndUpdate(
      {
        _id: req.params.id,
        senderId: req.user._id,
        status: "pending",
        ...(hasScheduledAt
          ? {}
          : { scheduledAt: { $gt: new Date() } }),
      },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "The message is no longer editable.",
      });
    }

    return res.json({
      success: true,
      scheduledMessage: serializeMessage(updated),
    });
  } catch (error) {
    console.error("Edit scheduled message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not edit the scheduled message.",
    });
  }
});

// DELETE /api/scheduled-messages/:id
// Only pending messages can be cancelled.
router.delete("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled-message ID.",
      });
    }

    const cancelled = await ScheduledMessage.findOneAndUpdate(
      {
        _id: req.params.id,
        senderId: req.user._id,
        status: "pending",
      },
      {
        $set: { status: "cancelled" },
        $unset: { claimToken: 1 },
      },
      { returnDocument: "after" }
    );

    if (!cancelled) {
      const existing = await ScheduledMessage.findOne({
        _id: req.params.id,
        senderId: req.user._id,
      }).select("_id status");

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Scheduled message not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Only pending scheduled messages can be cancelled.",
      });
    }

    return res.json({
      success: true,
      message: "Scheduled message cancelled.",
      scheduledMessageId: cancelled._id.toString(),
      status: cancelled.status,
    });
  } catch (error) {
    console.error("Cancel scheduled message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not cancel the scheduled message.",
    });
  }
});

module.exports = router;
