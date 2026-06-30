const mongoose = require('mongoose');
const Redis = require('ioredis');
require('dotenv').config();

async function clearMemory() {
  try {
    // 1. 连接 MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // 清空对话记录
    const result = await mongoose.connection.db.collection('conversations').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} conversations from MongoDB`);

    const count = await mongoose.connection.db.collection('conversations').countDocuments();
    console.log(`   Remaining conversations: ${count}`);

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

    // 2. 连接 Redis
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
    });

    console.log('✅ Redis connected');

    // 获取所有聊天相关的键
    const keys = await redis.keys('conversation:*');
    console.log(`   Found ${keys.length} conversation keys in Redis`);

    if (keys.length > 0) {
      // 批量删除
      await redis.del(...keys);
      console.log(`✅ Deleted ${keys.length} keys from Redis`);
    } else {
      console.log('   No keys to delete');
    }

    // 验证删除
    const remainingKeys = await redis.keys('conversation:*');
    console.log(`   Remaining keys: ${remainingKeys.length}`);

    await redis.quit();
    console.log('✅ Redis connection closed');

    console.log('\n🎉 Memory cleared successfully (MongoDB + Redis)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing memory:', error);
    process.exit(1);
  }
}

clearMemory();
