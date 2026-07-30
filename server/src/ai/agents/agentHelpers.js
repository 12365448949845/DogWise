function contentToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content.map(item => {
    if (typeof item === 'string') return item;
    return item?.text || item?.content || '';
  }).filter(Boolean).join('');
}

async function streamModel(llm, messages, context, onStream) {
  const stream = await llm.stream(messages, { signal: context.signal });
  let fullContent = '';

  for await (const chunk of stream) {
    const text = contentToText(chunk.content);
    if (!text) continue;
    fullContent += text;
    onStream({ type: 'text', content: text });
  }

  return fullContent;
}

function emitModelResponse(response, onStream) {
  const text = contentToText(response?.content);
  if (text) onStream({ type: 'text', content: text });
  return text;
}

function messageText(message) {
  if (typeof message?.content === 'string') return message.content;
  return message?.content?.find(item => item?.type === 'text')?.text || '';
}

module.exports = {
  contentToText,
  emitModelResponse,
  messageText,
  streamModel
};
