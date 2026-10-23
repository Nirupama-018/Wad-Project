
const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
      ],
      required: true,
      validate: {
        validator: function (participants) {
          return (
            participants.length === 2 &&
            !participants[0].equals(participants[1])
          );
        },
        message: "A conversation must have two distinct participants.",
      },
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
