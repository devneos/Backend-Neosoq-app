const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../helpers/auth');

// Cookie options helper (same rules as other auth flows)
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: !!isProd,
    sameSite: isProd ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

// POST /admin/auth/signin
const adminSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).exec();
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const allowed = ['admin', 'support', 'moderator'];
    const roles = (user.roles || []).map(r => (typeof r === 'string' ? r.toLowerCase() : r));
    const isAdmin = roles.some(r => allowed.includes(r));
    if (!isAdmin) return res.status(403).json({ error: 'Admin sign-in only' });

    // Issue tokens
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: user._id,
          verified: user.verified,
          phoneNumber: user.phoneNumber,
          img: user.profileImage,
          username: user.username,
          roles: user.roles,
          position: user.position,
          adminAccess: user.adminAccess,
        },
      },
      process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { username: user.username },
      process.env.REFRESH_TOKEN_SECRET || 'abcdefghijkl',
      { expiresIn: '7d' }
    );

    res.cookie('jwt', refreshToken, getCookieOptions());

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        adminAccess: user.adminAccess,
      },
    });
  } catch (error) {
    console.error('adminSignIn error:', error);
    return res.status(500).json({ error: 'Failed to sign in' });
  }
};

module.exports = {
  adminSignIn,
};
