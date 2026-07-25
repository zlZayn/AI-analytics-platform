import OpenAI from "openai"
import {
  AI_RESPONSE_JSON_SCHEMA,
  buildSystemPrompt,
  parseInsightItems,
  type InsightItem,
} from "./ai-contract"

const AI_CONFIG = {
  apiBase: process.env.AI_API_BASE || "",
  apiKey: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "",
}

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AICompletionProvider {
  complete(input: {
    messages: AIMessage[]
    responseSchema: typeof AI_RESPONSE_JSON_SCHEMA
  }): Promise<string>
}

export interface AIServiceResult {
  items: InsightItem[]
}

let defaultProvider: AICompletionProvider | null = null

export async function generateSQL(
  message: string,
  schemaContext: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  provider: AICompletionProvider = getDefaultProvider(),
): Promise<AIServiceResult> {
  const messages: AIMessage[] = [
    { role: "system", content: buildSystemPrompt(schemaContext) },
    ...conversationHistory,
    { role: "user", content: message },
  ]
  const content = await provider.complete({ messages, responseSchema: AI_RESPONSE_JSON_SCHEMA })
  return { items: parseInsightItems(content) }
}

function getDefaultProvider(): AICompletionProvider {
  if (!AI_CONFIG.apiBase) {
    throw new Error("AI 服务未配置：缺少 API Base。请在 .env 文件中设置 AI_API_BASE。")
  }
  if (!AI_CONFIG.apiKey) {
    throw new Error("AI 服务未配置：缺少 API Key。请在 .env 文件中设置 AI_API_KEY。")
  }
  if (!AI_CONFIG.model) {
    throw new Error("AI 服务未配置：缺少模型。请在 .env 文件中设置 AI_MODEL。")
  }
  if (!defaultProvider) defaultProvider = createOpenAIProvider()
  return defaultProvider
}

function createOpenAIProvider(): AICompletionProvider {
  const client = new OpenAI({ baseURL: AI_CONFIG.apiBase, apiKey: AI_CONFIG.apiKey })
  return {
    async complete({ messages, responseSchema }) {
      const response = await client.chat.completions.create({
        model: AI_CONFIG.model,
        messages,
        temperature: 0.2,
        max_tokens: 4000,
        response_format: {
          type: "json_schema",
          json_schema: responseSchema,
        },
      })
      return response.choices[0]?.message.content ?? ""
    },
  }
}

export type { InsightItem } from "./ai-contract"
