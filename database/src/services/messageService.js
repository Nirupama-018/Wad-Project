
const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ScheduledMessage = require("../models/ScheduledMessage");

const {
  encryptMessage,
  decryptMessage,
} = require("../utils/encryption");

const MAX_MESSAGE_LENGTH = 5000;
const DEFAULT_HISTORY_LIMIT = 30;
const MAX_HISTORY_LIMIT = 100;

function toObjectId(value, fieldName) {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return new mongoose.Types.ObjectId(value);
}

function validateContent(content) {
  if (
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.length > MAX_MESSAGE_LENGTH
  ) {
    throw new Error(
      `Message content must contain 1-${MAX_MESSAGE_LENGTH} characters.`
    );
  }

  return content;
}

async function getAuthorizedConversation(conversationId, userId) {
  const conversationObjectId = toObjectId(
    conversationId,
    "conversationId"
  );
  const userObjectId = toObjectId(userId, "userId");

  const conversation = await Conversation.findOne({
    _id: conversationObjectId,
    participants: userObjectId,
  });

  if (!conversation) {
    throw new Error("Conversation not found or access denied.");
  }

  return conversation;
}

function decryptStoredMessage(message) {
  return {
    messageId: message._id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    content: decryptMessage({
      encryptedContent: message.encryptedContent,
      iv: message.iv,
      authTag: message.authTag,
      keyVersion: message.keyVersion,
    }),
    clientMessageId: message.clientMessageId || null,
    status: message.status,
    timestamp: message.createdAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
  };
}


async function saveMessage({
  conversationId,
  senderId,
  content,
  clientMessageId,
}) {
  const conversationObjectId = toObjectId(
    conversationId,
    "conversationId"
  );
  const senderObjectId = toObjectId(senderId, "senderId");
  const validatedContent = validateContent(content);

  if (
    clientMessageId !== undefined &&
    (typeof clientMessageId !== "string" ||
      clientMessageId.trim().length === 0 ||
      clientMessageId.length > 100)
  ) {
    throw new Error("Invalid clientMessageId.");
  }

  await getAuthorizedConversation(
    conversationObjectId,
    senderObjectId
  );

  const normalizedClientMessageId = clientMessageId?.trim();
  const encrypted = encryptMessage(validatedContent);

  let message;

  try {
    message = await Message.create({
      conversationId: conversationObjectId,
      senderId: senderObjectId,
      ...encrypted,
      clientMessageId: normalizedClientMessageId,
      status: "sent",
    });
  } catch (error) {
    if (error.code === 11000 && normalizedClientMessageId) {
      const existing = await Message.findOne({
        senderId: senderObjectId,
        clientMessageId: normalizedClientMessageId,
      });

      if (
        existing &&
        existing.conversationId.equals(conversationObjectId)
      ) {
        const existingContent = decryptMessage({
          encryptedContent: existing.encryptedContent,
          iv: existing.iv,
          authTag: existing.authTag,
          keyVersion: existing.keyVersion,
        });

        if (existingContent !== validatedContent) {
          throw new Error(
            "clientMessageId was already used for different content."
          );
        }

        return decryptStoredMessage(existing);
      }
    }

    throw error;
  }

  // The message is already persisted. A failure here must not cause
  // the caller to retry it as though the insertion had failed.
  try {
    await Conversation.updateOne(
      {
  _id: conversationObjectId,
  $or: [
    { lastMessageAt: null },
    { lastMessageAt: { $lt: message.createdAt } },
  ],
},
      { $set: { lastMessageAt: message.createdAt } }
    );
  } catch (error) {
    // The message remains saved. Log the secondary failure so it can
    // be diagnosed without falsely reporting that message creation failed.
    console.error(
      "Message saved, but lastMessageAt update failed:",
      error.message
    );
  }

  return {
    messageId: message._id.toString(),
    conversationId: conversationObjectId.toString(),
    senderId: senderObjectId.toString(),
    content: validatedContent,
    clientMessageId: message.clientMessageId || null,
    status: message.status,
    timestamp: message.createdAt,
  };
}


async function getMessageHistory({
  conversationId,
  userId,
  limit = DEFAULT_HISTORY_LIMIT,
  before,
}) {
  const conversation = await getAuthorizedConversation(
    conversationId,
    userId
  );

  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_HISTORY_LIMIT
  ) {
    throw new Error(
      `History limit must be between 1 and ${MAX_HISTORY_LIMIT}.`
    );
  }

  const query = {
    conversationId: conversation._id,
  };

  if (before !== undefined) {
    const beforeDate = new Date(before);

    if (Number.isNaN(beforeDate.getTime())) {
      throw new Error("Invalid before timestamp.");
    }

    query.createdAt = { $lt: beforeDate };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(parsedLimit)
    .lean();

  // Return oldest to newest for convenient chat rendering.
  return messages.reverse().map(decryptStoredMessage);
}

async function updateMessageStatus({
  messageId,
  userId,
  status,
}) {
  if (!["delivered", "read"].includes(status)) {
    throw new Error("Status must be delivered or read.");
  }

  const messageObjectId = toObjectId(messageId, "messageId");
  const userObjectId = toObjectId(userId, "userId");

  const message = await Message.findById(messageObjectId);

  if (!message) {
    throw new Error("Message not found.");
  }

  const conversation = await getAuthorizedConversation(
    message.conversationId,
    userObjectId
  );

  // Only the recipient can acknowledge delivery or reading.
  if (message.senderId.equals(userObjectId)) {
    throw new Error("Senders cannot acknowledge their own messages.");
  }

  const now = new Date();

  if (status === "delivered") {
    if (message.status === "sent") {
      message.status = "delivered";
      message.deliveredAt = now;
    }
  } else {
    message.status = "read";
    message.deliveredAt ||= now;
    message.readAt ||= now;
  }

  await message.save();

  return {
    messageId: message._id.toString(),
    conversationId: conversation._id.toString(),
    status: message.status,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
  };
}

async function scheduleMessage({
  conversationId,
  senderId,
  recipientId,
  content,
  scheduledAt,
}) {
  const conversation = await getAuthorizedConversation(
    conversationId,
    senderId
  );

  const senderObjectId = toObjectId(senderId, "senderId");
  const recipientObjectId = toObjectId(recipientId, "recipientId");

  if (senderObjectId.equals(recipientObjectId)) {
    throw new Error("Sender and recipient must be different.");
  }

  if (
    !conversation.participants.some((participant) =>
      participant.equals(recipientObjectId)
    )
  ) {
    throw new Error("Recipient is not a conversation participant.");
  }

  const validatedContent = validateContent(content);
  const deliveryDate = new Date(scheduledAt);

  if (
    scheduledAt === undefined ||
    Number.isNaN(deliveryDate.getTime()) ||
    deliveryDate <= new Date()
  ) {
    throw new Error("scheduledAt must be a future date and time.");
  }

  const encrypted = encryptMessage(validatedContent);

  const scheduledMessage = await ScheduledMessage.create({
    conversationId: conversation._id,
    senderId: senderObjectId,
    recipientId: recipientObjectId,
    ...encrypted,
    scheduledAt: deliveryDate,
    status: "pending",
  });

  return {
    scheduledMessageId: scheduledMessage._id.toString(),
    conversationId: conversation._id.toString(),
    senderId: senderObjectId.toString(),
    recipientId: recipientObjectId.toString(),
    scheduledAt: scheduledMessage.scheduledAt,
    status: scheduledMessage.status,
  };
}

module.exports = {
  saveMessage,
  getMessageHistory,
  updateMessageStatus,
  scheduleMessage,
};
