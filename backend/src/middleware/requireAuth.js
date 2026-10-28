
const jwt = require("jsonwebtoken");
const User = require("../../../database/src/models/User");

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.wavelength_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || !user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Please sign in again.",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please sign in again.",
    });
  }
}

module.exports = requireAuth;
