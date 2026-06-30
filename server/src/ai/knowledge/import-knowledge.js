const KnowledgeDocumentProcessor = require('./KnowledgeDocumentProcessor');
const KnowledgeVectorManager = require('./KnowledgeVectorManager');

/**
 * 批量导入知识库文档到 Qdrant
 */
async function importKnowledge() {
  console.log('\n=== 开始导入知识库 ===\n');

  const processor = new KnowledgeDocumentProcessor();
  const vectorManager = new KnowledgeVectorManager();

  try {
    // 1. 扫描所有文档文件
    console.log('1. 扫描知识库文档...');
    const files = await processor.scanDocuments();
    console.log(`✓ 找到 ${files.length} 个文档文件\n`);

    if (files.length === 0) {
      console.log('没有找到任何文档，请检查 knowledge_base/ 目录');
      return;
    }

    // 2. 处理每个文档
    let totalChunks = 0;
    const allChunks = [];

    console.log('2. 处理文档并切块...');
    for (const filePath of files) {
      try {
        const chunks = await processor.processDocument(filePath);
        allChunks.push(...chunks);
        totalChunks += chunks.length;
        console.log(`  ✓ ${filePath.split('knowledge_base')[1]}: ${chunks.length} chunks`);
      } catch (error) {
        console.error(`  ✗ ${filePath}: ${error.message}`);
      }
    }

    console.log(`\n✓ 共生成 ${totalChunks} 个知识块\n`);

    // 3. 批量存入 Qdrant
    console.log('3. 存入向量数据库...');

    // 分批存储（每批 50 个，避免单次请求过大）
    const batchSize = 50;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      await vectorManager.saveBatchKnowledge(batch);
      console.log(`  ✓ 已存储 ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length} 个知识块`);
    }

    console.log('\n✓ 所有知识块已存入 Qdrant\n');

    // 4. 显示统计信息
    console.log('4. 知识库统计...');
    const stats = await vectorManager.getStats();
    console.log(`  总向量数: ${stats.totalPoints}`);
    console.log(`  索引向量数: ${stats.indexedVectorsCount}`);
    console.log(`  状态: ${stats.status}\n`);

    console.log('=== 知识库导入完成 ===\n');

  } catch (error) {
    console.error('导入失败:', error);
    throw error;
  }
}

// 直接运行
if (require.main === module) {
  importKnowledge()
    .then(() => {
      console.log('导入成功完成');
      process.exit(0);
    })
    .catch(err => {
      console.error('导入失败:', err);
      process.exit(1);
    });
}

module.exports = { importKnowledge };
