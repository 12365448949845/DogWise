const fs = require('fs').promises;
const path = require('path');

/**
 * KnowledgeDocumentProcessor - 知识文档处理器
 * 负责加载文档、按章节切块、提取 metadata
 */
class KnowledgeDocumentProcessor {
  constructor() {
    this.knowledgeBasePath = path.join(__dirname, '../../../knowledge_base');
  }

  /**
   * 处理单个文档文件
   * @param {string} filePath - 文档文件路径
   * @returns {Promise<Array>} - 切块后的文档片段
   */
  async processDocument(filePath) {
    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 从文件路径提取 metadata
      const metadata = this.extractMetadataFromPath(filePath);

      // 提取文档标题（第一个 # 标题）
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const documentTitle = titleMatch ? titleMatch[1].trim() : path.basename(filePath, path.extname(filePath));

      // 按章节切块
      const chunks = this.chunkBySection(content, documentTitle, metadata, filePath);

      console.log(`[KnowledgeDocumentProcessor] Processed: ${filePath}, ${chunks.length} chunks`);

      return chunks;
    } catch (error) {
      console.error(`[KnowledgeDocumentProcessor] Error processing ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 按 ## 二级标题切块
   * @param {string} content - 文档内容
   * @param {string} documentTitle - 文档标题
   * @param {Object} metadata - 基础 metadata
   * @param {string} filePath - 文件路径
   * @returns {Array} - chunks
   */
  chunkBySection(content, documentTitle, metadata, filePath) {
    const chunks = [];

    // 移除文档标题（第一个 # 标题）
    const contentWithoutTitle = content.replace(/^#\s+.+$/m, '').trim();

    // 按 ## 分割章节
    const sections = contentWithoutTitle.split(/^##\s+/m).filter(s => s.trim());

    if (sections.length === 0) {
      // 如果没有 ## 标题，整个文档作为一个 chunk
      chunks.push(this.createChunk(content, documentTitle, '全文', 0, 1, metadata, filePath));
      return chunks;
    }

    sections.forEach((section, index) => {
      const lines = section.trim().split('\n');
      const sectionTitle = lines[0].trim(); // 第一行是章节标题
      const sectionContent = lines.slice(1).join('\n').trim(); // 剩余是内容

      if (!sectionContent) {
        return; // 跳过空章节
      }

      // 完整内容 = 标题 + 内容
      const fullContent = `## ${sectionTitle}\n\n${sectionContent}`;

      chunks.push(
        this.createChunk(
          fullContent,
          documentTitle,
          sectionTitle,
          index,
          sections.length,
          metadata,
          filePath
        )
      );
    });

    return chunks;
  }

  /**
   * 创建单个 chunk 对象
   */
  createChunk(content, documentTitle, sectionTitle, chunkIndex, totalChunks, metadata, filePath) {
    // 从内容中提取关键词（品种、主题）
    const breeds = this.extractBreeds(content);
    const topics = this.extractTopics(sectionTitle);

    return {
      content: content,
      summary: `${documentTitle} - ${sectionTitle}`, // 简单摘要
      metadata: {
        documentId: this.generateDocumentId(filePath),
        documentTitle: documentTitle,
        section: sectionTitle,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        category: metadata.category,
        breeds: breeds,
        topics: topics,
        source: 'knowledge_base',
        sourceFile: filePath,
        timestamp: new Date()
      }
    };
  }

  /**
   * 从文件路径提取 metadata
   * 例如：knowledge_base/饮食营养/金毛食物过敏.txt
   * → category: 饮食营养
   */
  extractMetadataFromPath(filePath) {
    const relativePath = path.relative(this.knowledgeBasePath, filePath);
    const parts = relativePath.split(path.sep);

    return {
      category: parts[0] || 'unknown', // 第一级目录是分类
      filename: parts[parts.length - 1]
    };
  }

  /**
   * 从内容中提取品种名
   */
  extractBreeds(content) {
    const breeds = [];
    const breedKeywords = ['金毛', '泰迪', '哈士奇', '拉布拉多', '柯基', '边牧', '萨摩耶', '比熊', '博美', '柴犬'];

    breedKeywords.forEach(breed => {
      if (content.includes(breed)) {
        breeds.push(breed);
      }
    });

    return [...new Set(breeds)]; // 去重
  }

  /**
   * 从章节标题提取主题标签
   */
  extractTopics(sectionTitle) {
    const topics = [];
    const topicKeywords = {
      '饮食': ['吃', '喂', '食物', '狗粮', '营养'],
      '健康': ['健康', '生病', '疫苗', '驱虫', '医疗'],
      '训练': ['训练', '教', '学习', '指令', '服从'],
      '行为': ['行为', '叫', '咬', '扑', '护食'],
      '护理': ['护理', '洗澡', '梳毛', '清洁', '剪指甲']
    };

    Object.keys(topicKeywords).forEach(topic => {
      const keywords = topicKeywords[topic];
      if (keywords.some(keyword => sectionTitle.includes(keyword))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  /**
   * 生成文档 ID
   */
  generateDocumentId(filePath) {
    const relativePath = path.relative(this.knowledgeBasePath, filePath);
    // 将路径转换为 ID（替换路径分隔符）
    return relativePath.replace(/[\\\/]/g, '_').replace(/\.[^.]+$/, '');
  }

  /**
   * 扫描知识库目录，获取所有文档文件
   * @returns {Promise<Array>} - 文件路径列表
   */
  async scanDocuments() {
    const files = [];

    async function scanDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.md'))) {
          files.push(fullPath);
        }
      }
    }

    await scanDir(this.knowledgeBasePath);
    return files;
  }
}

module.exports = KnowledgeDocumentProcessor;
