require('dotenv').config();
const configureDns = require('../../config/dns');

configureDns();

const mongoose = require('mongoose');
const KnowledgeArticle = require('../../models/KnowledgeArticle');
const { syncKnowledgeArticle } = require('./MongoKnowledgeSync');

async function syncAll() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured');
  await mongoose.connect(process.env.MONGO_URI);

  const articles = await KnowledgeArticle.find({ status: 'published' });
  for (const article of articles) {
    await syncKnowledgeArticle(article);
  }
  console.log(`[KnowledgeSync] Synced ${articles.length} MongoDB articles`);
}

if (require.main === module) {
  syncAll()
    .then(() => mongoose.disconnect())
    .catch(async error => {
      console.error('[KnowledgeSync] Failed:', error.message);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

module.exports = { syncAll };
