
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");

const ScheduledMessage = require("../models/ScheduledMessage");
const { decryptMessage } = require("../utils/encryption");
const { saveMessage } = require("./messageService");

const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 25;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

async function processDueScheduledMessages(
  deliverMessage,
  { limit = DEFAULT_BATCH_SIZE, now = new Date() } = {}
) {
  if (typeof deliverMessage !== "function") {
    throw new Error("A delivery callback is required.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Limit must be between 1 and 100.");
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid Date.");
  }

  // Recover stale processing attempts.
  const staleProcessingBefore = new Date(
    now.getTime() - PROCESSING_TIMEOUT_MS
  );

  await ScheduledMessage.updateMany(
    {
      status: "processing",
      lastAttemptAt: { $lte: staleProcessingBefore },
      attempts: { $lt: MAX_ATTEMPTS },
    },
    {
      $set: {
        status: "pending",
        failureReason: "Recovered after processing timeout.",
      },
      $unset: { claimToken: 1 },
    }
  );

  await ScheduledMessage.updateMany(
    {
      status: "processing",
      lastAttemptAt: { $lte: staleProcessingBefore },
      attempts: { $gte: MAX_ATTEMPTS },
    },
    {
      $set: {
        status: "failed",
        failureReason: "Processing timed out after maximum attempts.",
      },
      $unset: { claimToken: 1 },
    }
  );

  const dueMessages = await ScheduledMessage.find({
    scheduledAt: { $lte: now },
    status: "pending",
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ scheduledAt: 1, _id: 1 })
    .limit(limit)
    .select("_id")
    .lean();

  const results = [];

  for (const candidate of dueMessages) {
    const claimToken = randomUUID();

    // Atomically claim this pending message.
    const scheduled = await ScheduledMessage.findOneAndUpdate(
      {
        _id: candidate._id,
        scheduledAt: { $lte: now },
        status: "pending",
        attempts: { $lt: MAX_ATTEMPTS },
      },
      {
        $set: {
          status: "processing",
          lastAttemptAt: new Date(),
          claimToken,
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after" }
    );

    if (!scheduled) {
      continue;
    }

    try {
      const content = decryptMessage({
        encryptedContent: scheduled.encryptedContent,
        iv: scheduled.iv,
        authTag: scheduled.authTag,
        keyVersion: scheduled.keyVersion,
      });

      // The stable ID prevents duplicate database messages on retry.
      const message = await saveMessage({
        conversationId: scheduled.conversationId.toString(),
        senderId: scheduled.senderId.toString(),
        content,
        clientMessageId: `scheduled:${scheduled._id}`,
      });

      // Check ownership immediately before attempting delivery.
      const stillOwnsClaim = await ScheduledMessage.exists({
        _id: scheduled._id,
        status: "processing",
        claimToken,
      });

      if (!stillOwnsClaim) {
        results.push({
          scheduledMessageId: scheduled._id.toString(),
          status: "ownership_lost",
        });
        continue;
      }

      // Implemented by the real-time integration layer.
      await deliverMessage({
        message,
        recipientId: scheduled.recipientId.toString(),
      });

      const updateResult = await ScheduledMessage.updateOne(
        {
          _id: scheduled._id,
          status: "processing",
          claimToken,
        },
        {
          $set: {
            status: "sent",
            sentMessageId: new mongoose.Types.ObjectId(
              message.messageId
            ),
          },
          $unset: {
            failureReason: 1,
            claimToken: 1,
          },
        }
      );

      if (updateResult.matchedCount === 0) {
        results.push({
          scheduledMessageId: scheduled._id.toString(),
          status: "ownership_lost",
        });
        continue;
      }

      results.push({
        scheduledMessageId: scheduled._id.toString(),
        status: "sent",
        messageId: message.messageId,
      });
    } catch (error) {
      const exhausted = scheduled.attempts >= MAX_ATTEMPTS;

      const updateResult = await ScheduledMessage.updateOne(
        {
          _id: scheduled._id,
          status: "processing",
          claimToken,
        },
        {
          $set: {
            status: exhausted ? "failed" : "pending",
            failureReason: String(
              error.message || "Delivery failed"
            ).slice(0, 500),
          },
          $unset: {
            claimToken: 1,
          },
        }
      );

      results.push({
        scheduledMessageId: scheduled._id.toString(),
        status:
          updateResult.matchedCount === 0
            ? "ownership_lost"
            : exhausted
              ? "failed"
              : "pending",
      });
    }
  }

  return results;
}

module.exports = { processDueScheduledMessages };
