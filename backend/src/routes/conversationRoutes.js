
const express = require("express");
const mongoose = require("../../../database/node_modules/mongoose");

const requireAuth = require("../middleware/requireAuth");
const User = require("../../../database/src/models/User");
const Conversation = require("../../../database/src/models/Conversation");
const messageService = require("../../../database/src/services/messageService");

const router = express.Router();

// All conversation endpoints require a verified, logged-in user.
router.use(requireAuth);

// GET /api/conversations
// List conversations belonging to the current user.
router.get("/", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const otherParticipantId = conversation.participants.find(
          (id) => id.toString() !== req.user._id.toString()
        );

        const otherUser = otherParticipantId
          ? await User.findById(otherParticipantId)
              .select("_id name email bio")
              .lean()
          : null;

        // Fetch the latest message through the existing service so
        // encrypted message content is decrypted consistently.
        const history = await messageService.getMessageHistory({
          conversationId: conversation._id.toString(),
          userId: req.user._id.toString(),
          limit: 1,
        });

        return {
          conversationId: conversation._id.toString(),
          otherUser: otherUser
            ? {
                userId: otherUser._id.toString(),
                name: otherUser.name,
                email: otherUser.email,
                bio: otherUser.bio || "",
              }
            : null,
          lastMessage: history.length > 0 ? history[0] : null,
          lastMessageAt: conversation.lastMessageAt,
        };
      })
    );

    res.json({
      success: true,
      conversations: results,
    });
  } catch (error) {
    console.error("List conversations error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not load conversations.",
    });
  }
});

// POST /api/conversations
// Create a one-to-one conversation, or return the existing one.
router.post("/", async (req, res) => {
  try {
    const { recipientId } = req.body;

    if (!mongoose.isObjectIdOrHexString(recipientId)) {
      return res.status(400).json({
        success: false,
        message: "A valid recipientId is required.",
      });
    }

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a conversation with yourself.",
      });
    }

    const recipient = await User.findOne({
      _id: recipientId,
      isVerified: true,
    }).select("_id name email bio");

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Verified recipient not found.",
      });
    }

    const participants = [req.user._id, recipient._id];

    let conversation = await Conversation.findOne({
      participants: {
        $all: participants,
        $size: 2,
      },
    });

    let created = false;

    if (!conversation) {
      try {
        conversation = await Conversation.create({ participants });
        created = true;
      } catch (error) {
        // If two requests create the same pair concurrently, check
        // whether the other request already created the conversation.
        conversation = await Conversation.findOne({
          participants: {
            $all: participants,
            $size: 2,
          },
        });

        if (!conversation) {
          throw error;
        }
      }
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      conversation: {
        conversationId: conversation._id.toString(),
        otherUser: {
          userId: recipient._id.toString(),
          name: recipient.name,
          email: recipient.email,
          bio: recipient.bio || "",
        },
        lastMessage: null,
        lastMessageAt: conversation.lastMessageAt,
      },
    });
  } catch (error) {
    console.error("Create conversation error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not create conversation.",
    });
  }
});

// GET /api/conversations/:conversationId/messages?limit=30&before=<timestamp>
router.get("/:conversationId/messages", async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isObjectIdOrHexString(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    // Check membership before returning any conversation data.
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }).select("_id");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const limit = req.query.limit ?? 30;
    const before = req.query.before;

    const messages = await messageService.getMessageHistory({
      conversationId,
      userId: req.user._id.toString(),
      limit,
      ...(before !== undefined ? { before } : {}),
    });

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    if (
      error.message.includes("History limit") ||
      error.message.includes("Invalid before timestamp")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Get message history error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not load message history.",
    });
  }
});

module.exports = router;
