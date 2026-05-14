const authService = require('../services/authService');
const { success } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        code: 400,
        message: 'All fields are required',
        data: null,
      });
    }

    const { user, token } = await authService.register({ username, email, password });
    success(res, { user, token }, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 400,
        message: 'Email and password are required',
        data: null,
      });
    }

    const { user, token } = await authService.login({ email, password });
    success(res, { user, token }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    success(res, { user }, 'User info retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
