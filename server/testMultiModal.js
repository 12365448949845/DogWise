const MultiModalAgent = require('./src/ai/agents/MultiModalAgent');
require('dotenv').config();

/**
 * 测试 MultiModalAgent 的多模态能力
 */
async function testMultiModal() {
  console.log('========== MultiModal Agent Test ==========\n');

  const apiKey = process.env.ALIYUN_API_KEY;
  const baseURL = process.env.ALIYUN_BASE_URL;

  if (!apiKey) {
    console.error('❌ ALIYUN_API_KEY not found in .env');
    process.exit(1);
  }

  const agent = new MultiModalAgent(apiKey, baseURL, null);

  // 测试 1: 纯文本对话
  console.log('📝 Test 1: 纯文本对话\n');
  const textMessages = [
    { role: 'user', content: '金毛可以吃鸡蛋吗？' }
  ];

  const context1 = { userId: 'test_user' };

  console.log('发送消息:', textMessages[0].content);
  console.log('预期：使用 qwen-plus\n');

  let response1 = '';
  try {
    response1 = await agent.chat(textMessages, context1, (chunk) => {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.content);
      }
    });
    console.log('\n\n✅ Test 1 完成\n');
  } catch (error) {
    console.error('❌ Test 1 失败:', error.message);
  }

  // 测试 2: 图片理解（使用公开的狗狗图片 URL）
  console.log('========================================\n');
  console.log('🖼️  Test 2: 图片理解\n');

  // 使用一个公开的狗狗图片 URL（示例）
  const imageUrl = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1'; // 金毛照片

  const imageMessages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '这是什么品种的狗？请详细描述它的特征。' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];

  const context2 = { userId: 'test_user' };

  console.log('发送消息: 图片分析请求');
  console.log('图片 URL:', imageUrl);
  console.log('预期：使用 qwen-vl-max\n');

  let response2 = '';
  try {
    response2 = await agent.chat(imageMessages, context2, (chunk) => {
      if (chunk.type === 'text') {
        process.stdout.write(chunk.content);
      }
    });
    console.log('\n\n✅ Test 2 完成\n');
  } catch (error) {
    console.error('❌ Test 2 失败:', error.message);
  }

  console.log('========================================');
  console.log('🎉 所有测试完成！');
  process.exit(0);
}

testMultiModal();
