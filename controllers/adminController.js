const Invite = require('../models/Invite');
const { sendTemplateEmail } = require('../helpers/auth');
const crypto = require('crypto');

// Admin-only: create a staff invite and email link
const createStaffInvite = async (req, res) => {
  try {
    const { email, roles = ['User'], adminAccess = [] } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Generate secure token
    const token = crypto.randomBytes(24).toString('hex');

    // Calculate expiry (default 7 days)
    const days = parseInt(process.env.INVITE_EXPIRES_DAYS || '7', 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Create invite record
    const invite = await Invite.create({
      email: normalizedEmail,
      token,
      roles,
      adminAccess,
      createdBy: req.user?.id,
      expiresAt,
    });

    // Compose frontend link
    const frontendBase = process.env.FRONTEND_URL || process.env.BASE_URL || '';
    const link = `${frontendBase.replace(/\/$/, '')}/staff/signup?token=${token}`;

    const message = `You have been invited to join Neosoq as a staff member. Click the link below to complete your account setup:\n\n${link}\n\nIf you did not expect this invite, please ignore this email.`;

    try {
      await sendTemplateEmail(normalizedEmail, message, 'Neosoq Staff Invitation');
    } catch (e) {
      // Log email errors but still return success so admin isn't blocked by email provider
      console.error('Error sending invite email:', e);
    }

    // Don't return token in response for security
    return res.status(201).json({ message: 'Invite created and email sent (if configured)' });
  } catch (error) {
    console.error('createStaffInvite error:', error);
    return res.status(500).json({ error: 'Failed to create invite' });
  }
};

module.exports = {
  createStaffInvite,
};
