const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const fs = require('fs/promises');
const path = require('path');
const { SYSTEM_PROMPT } = require('../prompts/system');
const toolRegistry = require('../tools');
const { emitModelResponse, messageText, streamModel } = require('./agentHelpers');

const ALLOWED_IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp']
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

class MultiModalAgent {
  constructor(apiKey, baseURL) {
    if (!apiKey) throw new Error('API Key is required for MultiModalAgent');

    const configuration = {
      baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    };

    this.visionLLM = new ChatOpenAI({
      apiKey,
      configuration,
      modelName: 'qwen-vl-max',
      temperature: 0.4,
      streaming: true
    });
    this.textLLM = new ChatOpenAI({
      apiKey,
      configuration,
      modelName: 'qwen-plus',
      temperature: 0.4,
      streaming: true
    });
  }

  async chat(messages, context, onStream) {
    const currentMessage = messages[messages.length - 1];
    const hasMultimedia = this.detectMultimedia(currentMessage);
    const llm = hasMultimedia ? this.visionLLM : this.textLLM;
    const langchainMessages = [
      new SystemMessage(this.buildSystemPrompt(context, hasMultimedia)),
      ...await this.convertMessages(messages, hasMultimedia)
    ];
    const tools = this.selectTools(messageText(currentMessage), hasMultimedia);

    if (tools.length === 0) {
      return streamModel(llm, langchainMessages, context, onStream);
    }

    const response = await llm.invoke(langchainMessages, {
      tools,
      tool_choice: 'auto',
      signal: context.signal
    });

    if (!response.tool_calls?.length) {
      return emitModelResponse(response, onStream);
    }

    const toolResults = await this.executeToolCalls(response.tool_calls, context);
    const messagesWithTools = [
      ...langchainMessages,
      response,
      ...toolResults.map(result => new ToolMessage({
        content: JSON.stringify(result.result),
        tool_call_id: result.tool_call_id
      }))
    ];

    return streamModel(llm, messagesWithTools, context, onStream);
  }

  buildSystemPrompt(context, hasMultimedia) {
    let prompt = SYSTEM_PROMPT;

    if (hasMultimedia) {
      prompt += '\n\nAnalyze only what is visibly supported by the uploaded media. State when image quality or angle prevents a reliable conclusion. An image cannot establish a medical diagnosis.';
    }
    if (context.knowledgeContext) {
      prompt += `\n\n## Knowledge context\n\n${context.knowledgeContext}`;
    }
    if (context.webSearchContext) {
      prompt += `\n\n## Current web context\n\n${context.webSearchContext}`;
    }

    prompt += '\n\nUse earlier messages to understand follow-up questions. The latest user message remains the current task.';
    return prompt;
  }

  selectTools(query, hasMultimedia) {
    if (!hasMultimedia || !/(食谱|菜谱|做饭|自制餐|搭配|推荐.*(餐|菜|食物))/.test(query)) {
      return [];
    }
    const tool = toolRegistry.getTool('dog_recipe_recommend');
    return tool ? [tool.getSchema()] : [];
  }

  detectMultimedia(message) {
    return Array.isArray(message?.content) && message.content.some(item =>
      item?.type === 'image_url' || item?.type === 'video_url'
    );
  }

  async convertMessages(messages, hasMultimedia) {
    const converted = [];

    for (let index = 0; index < messages.length; index++) {
      const message = messages[index];
      if (!message?.role || !message?.content) continue;

      if (message.role === 'assistant') {
        converted.push(new AIMessage(String(message.content)));
        continue;
      }

      const isCurrentMultimedia = hasMultimedia && index === messages.length - 1 && Array.isArray(message.content);
      if (!isCurrentMultimedia) {
        converted.push(new HumanMessage(String(message.content)));
        continue;
      }

      const content = [];
      for (const item of message.content) {
        if (item.type === 'text') {
          content.push({ type: 'text', text: item.text });
        } else if (item.type === 'image_url') {
          const imageUrl = item.image_url.url;
          const url = this.isLocalUrl(imageUrl) ? await this.convertLocalImageToBase64(imageUrl) : imageUrl;
          if (url) content.push({ type: 'image_url', image_url: { url } });
        } else if (item.type === 'video_url') {
          content.push({ type: 'video_url', video_url: { url: item.video_url.url } });
        }
      }
      converted.push(new HumanMessage({ content }));
    }

    return converted;
  }

  isLocalUrl(value) {
    try {
      const url = new URL(value);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  async convertLocalImageToBase64(localUrl) {
    const url = new URL(localUrl);
    const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/');
    if (!pathname.startsWith('/uploads/')) {
      throw new Error('Local media must be inside the uploads directory');
    }

    const relativeName = pathname.slice('/uploads/'.length);
    if (!relativeName || path.basename(relativeName) !== relativeName) {
      throw new Error('Invalid local media path');
    }

    const uploadRoot = path.resolve(__dirname, '../../../uploads');
    const filePath = path.resolve(uploadRoot, relativeName);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new Error('Invalid local media path');
    }

    const extension = path.extname(filePath).toLowerCase();
    const mimeType = ALLOWED_IMAGE_TYPES.get(extension);
    if (!mimeType) throw new Error('Unsupported local image type');

    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) {
      throw new Error('Local image is invalid or too large');
    }

    const imageBuffer = await fs.readFile(filePath);
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  }

  async executeToolCalls(toolCalls, context) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const tool = toolRegistry.getTool(toolCall.name);
        if (!tool) throw new Error('Tool not found');
        const result = await tool.execute(toolCall.args, context);
        results.push({ tool_call_id: toolCall.id, result });
      } catch (error) {
        console.error(`[MultiModalAgent] Tool ${toolCall.name} failed:`, error.message);
        results.push({
          tool_call_id: toolCall.id,
          result: { success: false, error: 'Tool execution failed' }
        });
      }
    }

    return results;
  }
}

module.exports = MultiModalAgent;
