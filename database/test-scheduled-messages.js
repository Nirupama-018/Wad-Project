
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Conversation = require("./src/models/Conversation");
const ScheduledMessage = require("./src/models/ScheduledMessage");
const Message = require("./src/models/Message");
const { encryptMessage } = require("./src/utils/encryption");
const {
  processDueScheduledMessages,
} = require("./src/services/scheduledMessageService");

async function runTest() {
  let conversation;
  let scheduled;

  try {
    await connectDB();

    // Temporary participant IDs; no real user records are created.
    const senderId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();

    conversation = await Conversation.create({
      participants: [senderId, recipientId],
    });

    const encrypted = encryptMessage("Scheduled test message");

    scheduled = await ScheduledMessage.create({
      conversationId: conversation._id,
      senderId,
      recipientId,
      ...encrypted,
      scheduledAt: new Date(Date.now() - 60_000),
      status: "pending",
    });

    console.log("1. Temporary scheduled message created.");

    // Simulated delivery callback; no socket or real user is contacted.
    const results = await processDueScheduledMessages(
      async ({ message, recipientId: target }) => {
        if (target !== recipientId.toString()) {
          throw new Error("Unexpected recipient.");
        }
        if (message.content !== "Scheduled test message") {
          throw new Error("Unexpected message content.");
        }
        console.log("2. Simulated delivery callback invoked.");
      }
    );

    const updated = await ScheduledMessage.findById(scheduled._id);
    const savedMessage = await Message.findById(updated.sentMessageId);

    console.log("3. Processor result:", results);
    console.log("4. Scheduled status is sent:", updated.status === "sent");
    console.log("5. Attempt count is one:", updated.attempts === 1);
    console.log(
      "6. Saved message content is encrypted:",
      Boolean(savedMessage?.encryptedContent) &&
        !savedMessage?.content
    );

    if (
      updated.status !== "sent" ||
      updated.attempts !== 1 ||
      !savedMessage
    ) {
      throw new Error("Scheduled-message test failed.");
    }

    console.log("\nPASS: Basic scheduled delivery test passed.");
  } finally {
    if (scheduled) {
      await Message.deleteMany({
        clientMessageId: `scheduled:${scheduled._id}`,
      });
      await ScheduledMessage.deleteOne({ _id: scheduled._id });
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
