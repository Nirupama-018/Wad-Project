
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

    const senderId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();

    conversation = await Conversation.create({
      participants: [senderId, recipientId],
    });

    scheduled = await ScheduledMessage.create({
      conversationId: conversation._id,
      senderId,
      recipientId,
      ...encryptMessage("Simulated failure test"),
      scheduledAt: new Date(Date.now() - 60_000),
      status: "pending",
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      const results = await processDueScheduledMessages(
        async () => {
          throw new Error("Simulated delivery failure");
        }
      );

      const updated = await ScheduledMessage.findById(scheduled._id);

      console.log(
        `Attempt ${attempt}: status=${updated.status}, attempts=${updated.attempts}`
      );

      if (updated.attempts !== attempt) {
        throw new Error(`Unexpected attempt count on attempt ${attempt}`);
      }

      if (attempt < 3 && updated.status !== "pending") {
        throw new Error("Message should remain pending before final attempt.");
      }

      if (attempt === 3 && updated.status !== "failed") {
        throw new Error("Message should be failed after three attempts.");
      }

      if (!results.some((result) =>
        result.scheduledMessageId === scheduled._id.toString()
      )) {
        throw new Error("Processor did not report the scheduled message.");
      }
    }

    console.log("\nPASS: Retry limit test passed.");
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
