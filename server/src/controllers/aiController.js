const https = require('https');
const http = require('http');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const SYSTEM_PROMPT = `你是 DogWorld AI 助手，一位专业、友好的狗狗知识顾问。你的职责是：
1. 回答所有关于狗狗的问题，包括健康、训练、饮食、品种、行为、护理等方面。
2. 如果用户问了非狗狗相关的问题，你可以礼貌地回答，但会尽量引导话题回到狗狗相关领域。
3. 回答要专业、准确，必要时提醒用户咨询兽医。
4. 使用中文回答，语气亲切自然，适当使用 emoji 增加趣味性。
5. 如果用户上传了图片，请尝试分析图片中的狗狗相关内容。`;

/**
 * POST /api/ai/chat
 * Body: { messages: [{ role, content }] }
 * Streams the response back using SSE (Server-Sent Events)
 */
exports.chatStream = async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ code: 400, message: 'messages is required' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ code: 500, message: 'DeepSeek API key not configured' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const payload = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  });

  const url = new URL('/v1/chat/completions', DEEPSEEK_BASE_URL);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const apiReq = httpModule.request(options, (apiRes) => {
    if (apiRes.statusCode !== 200) {
      let body = '';
      apiRes.on('data', (chunk) => { body += chunk; });
      apiRes.on('end', () => {
        res.write(`data: ${JSON.stringify({ error: `DeepSeek API error: ${apiRes.statusCode} ${body}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      return;
    }

    let buffer = '';

    apiRes.on('data', (chunk) => {
      buffer += chunk.toString();

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {
          // skip malformed JSON
        }
      }
    });

    apiRes.on('end', () => {
      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data !== '[DONE]') {
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
              }
            } catch { /* skip */ }
          }
        }
      }
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

    apiRes.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  apiReq.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  // Handle client disconnect
  req.on('close', () => {
    apiReq.destroy();
  });

  apiReq.write(payload);
  apiReq.end();
};
