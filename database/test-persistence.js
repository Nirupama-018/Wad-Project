
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");

const Conversation = require("./src/models/Conversation");
const Message = require("./src/models/Message");

const {
  saveMessage,
  getMessageHistory,
} = require("./src/services/messageService");

async function runTest() {
  let conversationId;
  let conversation2Id;
  let userA;
  let userB;
  let connected = false;

  try {
    await connectDB();
    connected = true;

    // Ensure the unique index used for deduplication exists.
    await Message.init();

    // Temporary test users. No User model is needed for this test.
    userA = new mongoose.Types.ObjectId();
    userB = new mongoose.Types.ObjectId();

    const conversation = await Conversation.create({
      participants: [userA, userB],
    });

    conversationId = conversation._id;

    console.log("\n1. Conversation created.");

    const payload = {
      conversationId: conversationId.toString(),
      senderId: userA.toString(),
      content: "Hello! This is a persistence test.",
      clientMessageId: `test-${new mongoose.Types.ObjectId()}`,
    };

    const saved = await saveMessage(payload);

    console.log("2. Message saved:", Boolean(saved.messageId));

    // Check what was actually stored in MongoDB.
    const stored = await Message.findById(saved.messageId).lean();

    console.log(
      "3. Stored content is encrypted:",
      stored.encryptedContent !== payload.content
    );

    console.log(
      "4. Plaintext field absent:",
      !Object.prototype.hasOwnProperty.call(stored, "content")
    );

    // Verify the recipient can retrieve the original text.
    const history = await getMessageHistory({
      conversationId: conversationId.toString(),
      userId: userB.toString(),
    });

    console.log(
      "5. Authorized history returns original text:",
      history.length === 1 &&
        history[0].content === payload.content
    );

    // Verify an unrelated user is denied access.
    const stranger = new mongoose.Types.ObjectId();
    let accessDenied = false;

    try {
      await getMessageHistory({
        conversationId: conversationId.toString(),
        userId: stranger.toString(),
      });
    } catch {
      accessDenied = true;
    }

    console.log("6. Unauthorized history access denied:", accessDenied);

    // Retry the same message with the same idempotency key.
    const retry = await saveMessage(payload);
    const messageCount = await Message.countDocuments({
      conversationId,
    });

    console.log(
      "7. Retry returns the same message:",
      retry.messageId === saved.messageId
    );

    console.log(
      "8. Retry did not create a duplicate:",
      messageCount === 1
    );
// Reusing the same ID with different content must be rejected.
    let conflictingRetryRejected = false;

    try {
      await saveMessage({
        ...payload,
        content: "Different content with the same client ID.",
      });
    } catch (error) {
      conflictingRetryRejected = error.message.includes(
        "already used for different content"
      );
    }

    console.log(
      "9. Conflicting retry rejected:",
      conflictingRetryRejected
    );

    // The same sender and client ID must not reuse a message
    // from a different conversation.
    const conversation2 = await Conversation.create({
      participants: [userA, new mongoose.Types.ObjectId()],
    });
    conversation2Id = conversation2._id;
    let crossConversationRetryRejected = false;

    try {
      await saveMessage({
        ...payload,
        conversationId: conversation2._id.toString(),
      });
    } catch {
      crossConversationRetryRejected = true;
    }

    console.log(
      "10. Cross-conversation retry rejected:",
      crossConversationRetryRejected
    );

    const checks = [
      stored.encryptedContent !== payload.content,
      !Object.prototype.hasOwnProperty.call(stored, "content"),
      history.length === 1 && history[0].content === payload.content,
      accessDenied,
      retry.messageId === saved.messageId,
      messageCount === 1,
      conflictingRetryRejected,
      crossConversationRetryRejected,
    ];


    if (checks.every(Boolean)) {
      console.log("\nPASS: All persistence checks passed.");
    } else {
      console.error("\nFAIL: One or more checks failed.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\nIntegration test failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
            try {
        if (conversationId) {
          await Message.deleteMany({ conversationId });
          await Conversation.deleteOne({ _id: conversationId });
        }

        if (conversation2Id) {
          await Message.deleteMany({
            conversationId: conversation2Id,
          });
          await Conversation.deleteOne({
            _id: conversation2Id,
          });
        }
      } catch (cleanupError) {
        console.error(
          "Test cleanup failed:",
          cleanupError.message
        );
        process.exitCode = 1;
      }
      await mongoose.disconnect();
    }

    console.log("Temporary test records cleaned up.");
  }
}

runTest();
