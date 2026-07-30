const KnowledgeVectorManager = require('./KnowledgeVectorManager');

const MAX_CHUNK_CHARS = 1200;

async function syncKnowledgeArticle(article) {
  const plainArticle = article?.toObject?.() || article;
  if (!plainArticle?._id) return;

  const manager = new KnowledgeVectorManager();
  const documentId = `mongo:${plainArticle._id}`;
  await manager.deleteByDocument(documentId);

  if (plainArticle.status && plainArticle.status !== 'published') return;

  const chunks = articleToChunks(plainArticle);
  if (chunks.length > 0) await manager.saveBatchKnowledge(chunks);
}

async function deleteKnowledgeArticleVector(articleId) {
  if (!articleId) return;
  await new KnowledgeVectorManager().deleteByDocument(`mongo:${articleId}`);
}

function articleToChunks(article) {
  const content = String(article.content || '').trim();
  if (!content) return [];

  const sections = splitMarkdownSections(content);
  const pieces = [];
  for (const section of sections) {
    pieces.push(...splitLongSection(section.content, MAX_CHUNK_CHARS).map(contentPart => ({
      section: section.title,
      content: contentPart
    })));
  }

  return pieces.map((piece, index) => ({
    content: piece.content,
    summary: [article.title, piece.section, article.summary].filter(Boolean).join(' - '),
    metadata: {
      documentId: `mongo:${article._id}`,
      documentTitle: article.title,
      section: piece.section,
      chunkIndex: index,
      totalChunks: pieces.length,
      category: article.category,
      breeds: [],
      topics: article.tags || [],
      source: 'mongodb',
      sourceFile: null,
      timestamp: article.updatedAt || new Date()
    }
  }));
}

function splitMarkdownSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let title = '全文';
  let buffer = [];

  const flush = () => {
    const sectionContent = buffer.join('\n').trim();
    if (sectionContent) sections.push({ title, content: sectionContent });
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flush();
      title = heading[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections.length > 0 ? sections : [{ title: '全文', content }];
}

function splitLongSection(content, maxChars) {
  if (content.length <= maxChars) return [content];

  const paragraphs = content.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) chunks.push(current);
      current = '';
      for (let index = 0; index < paragraph.length; index += maxChars) {
        chunks.push(paragraph.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

module.exports = {
  articleToChunks,
  deleteKnowledgeArticleVector,
  splitMarkdownSections,
  syncKnowledgeArticle
};
