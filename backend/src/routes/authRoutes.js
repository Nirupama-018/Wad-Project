
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const User = require("../../../database/src/models/User");

const router = express.Router();

const COOKIE_NAME = "wavelength_token";
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 30 * 1000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again later." },
});

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    bio: user.bio,
    isVerified: user.isVerified,
  };
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function sendOtpEmail(user, otp) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: user.email,
      subject: "Your Wavelength verification code",
      text: `Your Wavelength verification code is ${otp}. It expires in 10 minutes.`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV ONLY] OTP for ${user.email}: ${otp}`);
    return;
  }

  throw new Error("Email delivery is not configured.");
}

async function issueOtp(user) {
  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");

  user.otpHash = hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  user.otpLastSentAt = new Date();
  await user.save();

  await sendOtpEmail(user, otp);
}

// POST /api/auth/signup
router.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const password = typeof req.body.password === "string"
      ? req.body.password
      : "";

    if (!name || name.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid name and email address.",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8 to 128 characters.",
      });
    }

    let user = await User.findOne({ email });

    if (user?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (user) {
      user.name = name;
      user.passwordHash = passwordHash;
    } else {
      user = new User({ name, email, passwordHash });
    }

    try {
      await issueOtp(user);
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "Could not send the verification code. Configure email delivery and try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Verification code sent. Check your email.",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and six-digit code.",
      });
    }

    const user = await User.findOne({ email })
      .select("+otpHash +otpExpiresAt");

    if (
      !user ||
      user.isVerified ||
      !user.otpHash ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() < Date.now() ||
      hashOtp(otp) !== user.otpHash
    ) {
      return res.status(400).json({
        success: false,
        message: "The code is invalid or expired.",
      });
    }

    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpLastSentAt = undefined;
    await user.save();

    setAuthCookie(res, createToken(user));

    return res.json({
      success: true,
      message: "Email verified successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

    const user = await User.findOne({ email })
      .select("+otpLastSentAt");

    if (!user || user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Unable to resend a code for this account.",
      });
    }

    if (
      user.otpLastSentAt &&
      Date.now() - user.otpLastSentAt.getTime() < RESEND_WAIT_MS
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another code.",
      });
    }

    try {
      await issueOtp(user);
    } catch {
      return res.status(503).json({
        success: false,
        message: "Could not send the verification code.",
      });
    }

    return res.json({
      success: true,
      message: "A new verification code has been sent.",
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const password = typeof req.body.password === "string"
      ? req.body.password
      : "";

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before signing in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    setAuthCookie(res, createToken(user));

    return res.json({
      success: true,
      message: "Signed in successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.json({ success: true, message: "Signed out successfully." });
});

module.exports = router;
