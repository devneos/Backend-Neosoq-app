const cloudinary = require('cloudinary').v2;
// Configure from CLOUDINARY_URL if present
if (process.env.CLOUDINARY_URL) {
  try { cloudinary.config({ secure: true }); } catch (e) { /* ignore */ }
}

const uploadFile = async (filePath, options = {}) => {
  if (!process.env.CLOUDINARY_URL) return null;
  const res = await cloudinary.uploader.upload(filePath, { resource_type: 'auto', ...options });
  // return both url and public_id so callers can delete if needed
  return {
    url: res.secure_url || res.url || null,
    public_id: res.public_id || null,
    raw: res
  };
};

const destroyFile = async (publicId) => {
  if (!process.env.CLOUDINARY_URL || !publicId) return null;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
    return res;
  } catch (e) {
    console.error('cloudinary destroy error', e && e.message ? e.message : e);
    return null;
  }
};

module.exports = { uploadFile, cloudinary };
