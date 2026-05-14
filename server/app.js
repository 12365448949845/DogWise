const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

const path = require('path');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'Server is running', data: null });
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/articles', require('./src/routes/article'));
app.use('/api/comments', require('./src/routes/comment'));
app.use('/api/users', require('./src/routes/user'));
app.use('/api/notifications', require('./src/routes/notification'));
app.use('/api/messages', require('./src/routes/message'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/knowledge', require('./src/routes/knowledge'));
app.use('/api/ai', require('./src/routes/ai'));

// Error handler (must be last middleware)
app.use(errorHandler);

// Set up admin role for designated account
const setupAdmin = async () => {
  try {
    const User = require('./src/models/User');
    const result = await User.updateOne(
      { email: '123456@qq.com' },
      { $set: { role: 'admin' } }
    );
    if (result.modifiedCount > 0) {
      console.log('[Admin] Set admin role for 123456@qq.com');
    }
  } catch (err) {
    console.error('[Admin] Setup error:', err.message);
  }
};

// Connect to MongoDB & start server
connectDB().then(async () => {
  await setupAdmin();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
