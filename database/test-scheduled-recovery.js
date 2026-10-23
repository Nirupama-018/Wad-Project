
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Conversation = require("./src/models/Conversation");
const ScheduledMessage = require("./src/models/ScheduledMessage");
const { encryptMessage } = require("./src/utils/encryption");
const {
  processDueScheduledMessages,
} = require("./src/services/scheduledMessageService");

async function runTest() {
  let conversation;
  const scheduledIds = [];

  try {
    await connectDB();

    const senderId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();

    conversation = await Conversation.create({
      participants: [senderId, recipientId],
    });

    const oldAttemptTime = new Date(Date.now() - 10 * 60 * 1000);
    const encrypted = encryptMessage("Recovery test");

    const recoverable = await ScheduledMessage.create({
      conversationId: conversation._id,
      senderId,
      recipientId,
      ...encrypted,
      scheduledAt: new Date(Date.now() - 60_000),
      status: "processing",
      attempts: 1,
      lastAttemptAt: oldAttemptTime,
    });
    scheduledIds.push(recoverable._id);

    const exhausted = await ScheduledMessage.create({
      conversationId: conversation._id,
      senderId,
      recipientId,
      ...encrypted,
      scheduledAt: new Date(Date.now() - 60_000),
      status: "processing",
      attempts: 3,
      lastAttemptAt: oldAttemptTime,
    });
    scheduledIds.push(exhausted._id);

    // The callback must not run: recovery is what this test checks.
    // The recoverable item may be claimed immediately after recovery,
    // so we throw deliberately to return it to pending for inspection.
    await processDueScheduledMessages(async () => {
      throw new Error("Stop after recovery test claim");
    });

    const first = await ScheduledMessage.findById(recoverable._id);
    const second = await ScheduledMessage.findById(exhausted._id);

    console.log(
      "Recoverable record attempts:",
      first.attempts
    );
    console.log(
      "Recoverable record status:",
      first.status
    );
    console.log(
      "Exhausted record status:",
      second.status
    );

    if (
      first.status !== "pending" ||
      first.attempts !== 2 ||
      second.status !== "failed"
    ) {
      throw new Error("Crash-recovery test failed.");
    }

    console.log("\nPASS: Crash-recovery checks passed.");
  } finally {
    if (scheduledIds.length) {
      await ScheduledMessage.deleteMany({
        _id: { $in: scheduledIds },
      });
    }

    if (conversation) {
      await Conversation.deleteOne({ _id: conversation._id });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runTest().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
