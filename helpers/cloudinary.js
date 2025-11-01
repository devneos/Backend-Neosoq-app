const cloudinary = require('cloudinary').v2;
// Configure from CLOUDINARY_URL if present
if (process.env.CLOUDINARY_URL) {
  try { cloudinary.config({ secure: true }); } catch (e) { /* ignore */ }
}

const uploadFile = async (filePath, options = {}) => {
  if (!process.env.CLOUDINARY_URL) return null;
  const res = await cloudinary.uploader.upload(filePath, { resource_type: 'auto', ...options });
  return res.secure_url || res.url || null;
};

module.exports = { uploadFile, cloudinary };
