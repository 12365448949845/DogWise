const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const router = express.Router();
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { success } = require('../utils/response');

const MAX_WIDTH = 1200;
const QUALITY = 80;

router.post('/', auth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: 'No file uploaded' });
  }

  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.filename).toLowerCase();

    // Skip GIF (animated) compression
    if (ext !== '.gif') {
      const compressedName = `opt-${req.file.filename.replace(ext, '')}.webp`;
      const compressedPath = path.join(path.dirname(filePath), compressedName);

      await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(compressedPath);

      // Remove original file
      fs.unlink(filePath, () => {});

      const url = `/uploads/${compressedName}`;
      return success(res, { url }, 'File uploaded successfully');
    }

    const url = `/uploads/${req.file.filename}`;
    success(res, { url }, 'File uploaded successfully');
  } catch (err) {
    // Fallback: return original if compression fails
    const url = `/uploads/${req.file.filename}`;
    success(res, { url }, 'File uploaded successfully');
  }
});

module.exports = router;
