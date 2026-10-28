
const express = require("express");
//const mongoose = require("mongoose");
const User = require("../../../database/src/models/User");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    bio: user.bio,
  };
}

// All routes in this file require authentication.
router.use(requireAuth);

// GET /api/users/me
router.get("/me", (req, res) => {
  return res.json({
    success: true,
    user: publicUser(req.user),
  });
});

// PATCH /api/users/me
router.patch("/me", async (req, res, next) => {
  try {
    const allowedFields = ["name", "bio"];
    const suppliedFields = Object.keys(req.body || {});

    if (
      suppliedFields.length === 0 ||
      suppliedFields.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: "Only name and bio can be updated through this endpoint.",
      });
    }

    if (Object.hasOwn(req.body, "name")) {
      if (
        typeof req.body.name !== "string" ||
        !req.body.name.trim() ||
        req.body.name.trim().length > 60
      ) {
        return res.status(400).json({
          success: false,
          message: "Name must contain 1 to 60 characters.",
        });
      }

      req.user.name = req.body.name.trim();
    }

    if (Object.hasOwn(req.body, "bio")) {
      if (
        typeof req.body.bio !== "string" ||
        req.body.bio.length > 160
      ) {
        return res.status(400).json({
          success: false,
          message: "Bio must not exceed 160 characters.",
        });
      }

      req.user.bio = req.body.bio.trim();
    }

    await req.user.save();

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      user: publicUser(req.user),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users?search=alex
// Returns verified users for finding people to chat with.
router.get("/", async (req, res, next) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const filter = {
      _id: { $ne: req.user._id },
      isVerified: true,
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("name email bio")
      .sort({ name: 1 })
      .limit(20);

    return res.json({
      success: true,
      users: users.map(publicUser),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:userId
router.get("/:userId", async (req, res, next) => {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      isVerified: true,
    }).select("name email bio");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
