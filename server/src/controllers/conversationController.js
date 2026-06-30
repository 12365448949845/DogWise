const Conversation = require('../models/Conversation');

/**
 * GET /api/ai/conversations
 * 获取用户的对话列表
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    const conversations = await Conversation.find({ user: userId, status: 'active' })
      .sort({ lastActiveAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('title lastActiveAt createdAt')
      .lean();

    const total = await Conversation.countDocuments({ user: userId, status: 'active' });

    res.json({
      code: 200,
      message: 'success',
      data: {
        conversations,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[getConversations] Error:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      timestamp: Date.now(),
    });
  }
};

/**
 * GET /api/ai/conversations/:id
 * 获取单个对话的详细信息（包含消息历史）
 */
exports.getConversationById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const conversation = await Conversation.findOne({ _id: id, user: userId }).lean();

    if (!conversation) {
      return res.status(404).json({
        code: 404,
        message: 'Conversation not found',
        timestamp: Date.now(),
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: { conversation },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[getConversationById] Error:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      timestamp: Date.now(),
    });
  }
};

/**
 * DELETE /api/ai/conversations/:id
 * 删除对话
 */
exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const conversation = await Conversation.findOne({ _id: id, user: userId });

    if (!conversation) {
      return res.status(404).json({
        code: 404,
        message: 'Conversation not found',
        timestamp: Date.now(),
      });
    }

    // 软删除（标记为 archived）
    conversation.status = 'archived';
    await conversation.save();

    res.json({
      code: 200,
      message: 'success',
      data: { deleted: true },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[deleteConversation] Error:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      timestamp: Date.now(),
    });
  }
};

/**
 * PUT /api/ai/conversations/:id
 * 更新对话标题
 */
exports.updateConversation = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        code: 400,
        message: 'title is required',
        timestamp: Date.now(),
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, user: userId },
      { title: title.slice(0, 100) },
      { new: true }
    ).select('title lastActiveAt createdAt');

    if (!conversation) {
      return res.status(404).json({
        code: 404,
        message: 'Conversation not found',
        timestamp: Date.now(),
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: { conversation },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[updateConversation] Error:', error);
    res.status(500).json({
      code: 500,
      message: error.message,
      timestamp: Date.now(),
    });
  }
};
