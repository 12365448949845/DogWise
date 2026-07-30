const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');
const toolRegistry = require('../tools');
const { SYSTEM_PROMPT } = require('../prompts/system');
const { emitModelResponse, messageText, streamModel } = require('./agentHelpers');

class DogWorldAgent {
  constructor(apiKey, baseURL) {
    if (!apiKey) throw new Error('API Key is required for DogWorldAgent');

    this.llm = new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      modelName: 'qwen-plus',
      temperature: 0.4,
      streaming: true
    });
  }

  async chat(messages, context, onStream) {
    const currentMessage = messages[messages.length - 1];
    const langchainMessages = [
      new SystemMessage(this.buildSystemPrompt(context)),
      ...this.convertMessages(messages)
    ];
    const tools = this.selectTools(messageText(currentMessage));

    if (tools.length === 0) {
      return streamModel(this.llm, langchainMessages, context, onStream);
    }

    const response = await this.llm.invoke(langchainMessages, {
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

    return streamModel(this.llm, messagesWithTools, context, onStream);
  }

  buildSystemPrompt(context) {
    let prompt = SYSTEM_PROMPT;

    if (context.knowledgeContext) {
      prompt += `\n\n## Knowledge context\n\n${context.knowledgeContext}`;
      prompt += '\n\nUse this context as the primary factual basis. Do not claim that it says something it does not say.';
    }

    if (context.webSearchContext) {
      prompt += `\n\n## Current web context\n\n${context.webSearchContext}`;
      prompt += '\n\nUse web results only when their title, snippet and URL support the claim. Mention uncertainty when the snippet is insufficient.';
    }

    prompt += '\n\nThe final user message is the current task. Earlier messages are authoritative conversation context and may be used to resolve references and follow-up questions.';
    return prompt;
  }

  selectTools(query) {
    const tools = [];
    const memoryIntent = /(之前|上次|以前|记得|你还记得|我家狗.*(喜欢|不喜欢|过敏|习惯))/;
    const recipeIntent = /(食谱|菜谱|做饭|自制餐|怎么做|搭配|推荐.*(餐|菜|食物))/;

    if (memoryIntent.test(query)) {
      const tool = toolRegistry.getTool('semantic_memory_search');
      if (tool) tools.push(tool.getSchema());
    }
    if (recipeIntent.test(query)) {
      const tool = toolRegistry.getTool('dog_recipe_recommend');
      if (tool) tools.push(tool.getSchema());
    }

    return tools;
  }

  convertMessages(messages) {
    return messages.filter(message => message?.role && message?.content).map(message => {
      if (message.role === 'assistant') return new AIMessage(String(message.content));
      return new HumanMessage(String(message.content));
    });
  }

  async executeToolCalls(toolCalls, context) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await toolRegistry.executeTool(toolCall.name, toolCall.args, context);
        results.push({ tool_call_id: toolCall.id, result });
      } catch (error) {
        console.error(`[DogWorldAgent] Tool ${toolCall.name} failed:`, error.message);
        results.push({
          tool_call_id: toolCall.id,
          result: { success: false, error: 'Tool execution failed' }
        });
      }
    }

    return results;
  }
}

module.exports = DogWorldAgent;
