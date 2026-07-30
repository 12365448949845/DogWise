const StructuredInfoExtractTool = require('../tools/memory/StructuredInfoExtractTool');
const SemanticMemoryFilter = require('../memory/SemanticMemoryFilter');
const SemanticChunker = require('../memory/SemanticChunker');
const VectorMemoryManager = require('../memory/VectorMemoryManager');
const User = require('../../models/User');

async function processMemoryAsync(conversationId, messages, userId) {
  try {
    if (containsProfileSignal(messages)) {
      await extractAndMergeStructuredInfo(messages, userId);
    }
    await processSemanticMemory(conversationId, messages, userId);
  } catch (error) {
    console.error('[MemoryProcessing] Processing failed:', error.message);
  }
}

async function extractAndMergeStructuredInfo(messages, userId) {
  try {
    const structuredTool = new StructuredInfoExtractTool();
    const extracted = await structuredTool.execute({ messages }, { userId });
    if (!extracted || Object.keys(extracted).length === 0) return;

    const user = await User.findById(userId).select('dogProfile');
    if (!user) return;

    const current = user.dogProfile?.toObject?.() || user.dogProfile || {};
    user.dogProfile = mergeDogProfiles(current, extracted);
    await user.save();
    console.log('[MemoryProcessing] Merged structured dog profile');
  } catch (error) {
    console.error('[MemoryProcessing] Structured extraction failed:', error.message);
  }
}

async function processSemanticMemory(conversationId, messages, userId) {
  try {
    const semanticMessages = new SemanticMemoryFilter().filter(messages);
    if (semanticMessages.length === 0) return;

    const chunks = await new SemanticChunker().chunk(semanticMessages, {
      conversationId,
      userId
    });
    if (chunks.length === 0) return;

    await new VectorMemoryManager().saveBatchMemories(chunks);
    console.log(`[MemoryProcessing] Upserted ${chunks.length} semantic memories`);
  } catch (error) {
    console.error('[MemoryProcessing] Semantic memory failed:', error.message);
  }
}

function containsProfileSignal(messages) {
  const userText = (messages || [])
    .filter(message => message.role === 'user')
    .map(message => message.content || '')
    .join('\n');
  return /(名字|叫做|品种|年龄|岁|个月|性别|公狗|母狗|体重|公斤|kg|过敏|疫苗|确诊|病史)/i.test(userText);
}

function mergeDogProfiles(current = {}, incoming = {}) {
  const currentDogs = Array.isArray(current.dogs) ? current.dogs.map(toPlainObject) : [];
  const incomingDogs = Array.isArray(incoming.dogs) ? incoming.dogs.map(toPlainObject) : [];
  const dogs = [...currentDogs];

  for (const incomingDog of incomingDogs) {
    const index = findMatchingDog(dogs, incomingDog);
    if (index === -1) {
      dogs.push(cleanObject(incomingDog));
    } else {
      dogs[index] = mergeDog(dogs[index], incomingDog);
    }
  }

  return {
    dogs,
    preferences: {
      interestedTopics: mergeArrays(
        current.preferences?.interestedTopics,
        incoming.preferences?.interestedTopics
      ),
      dislikedTopics: mergeArrays(
        current.preferences?.dislikedTopics,
        incoming.preferences?.dislikedTopics
      )
    }
  };
}

function findMatchingDog(dogs, incomingDog) {
  if (incomingDog.name) {
    const byName = dogs.findIndex(dog => dog.name === incomingDog.name);
    if (byName !== -1) return byName;
  }
  return dogs.length === 1 && !incomingDog.name ? 0 : -1;
}

function mergeDog(currentDog, incomingDog) {
  const merged = { ...toPlainObject(currentDog) };
  for (const [key, value] of Object.entries(incomingDog)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      merged[key] = mergeArrays(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return cleanObject(merged);
}

function mergeArrays(first, second) {
  const values = [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]
    .filter(value => value !== null && value !== undefined && value !== '');
  return [...new Map(values.map(value => [JSON.stringify(value), value])).values()];
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(toPlainObject(value)).filter(([, item]) =>
    item !== null && item !== undefined && item !== ''
  ));
}

function toPlainObject(value) {
  return value?.toObject?.() || value || {};
}

module.exports = {
  processMemoryAsync,
  mergeDogProfiles,
  containsProfileSignal
};
