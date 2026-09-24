// AI 上下文采集（服务端：依赖 prisma 与 schema 扫描，勿在客户端组件导入）
// 可见范围与 trace 声明的纯模块见 [ai-context.ts](ai-context.ts)。

import { prisma } from "@/lib/prisma"
import { normalizeReferencedTables } from "@/lib/ai-context"
import { buildSchemaContext, scanSchema } from "@/lib/schema-service"
import {
  buildDataProfileText,
  scanAllDataProfiles,
  scanDataProfile,
} from "@/lib/data-profile-service"

export interface AIContextInput {
  conversationId?: unknown
  conversationHistory?: unknown
  referencedTables?: unknown
  businessContext?: unknown
}

export interface AIContext {
  schemaContext: string
  dataProfileText: string
  businessContext: string
  history: { role: "user" | "assistant"; content: string }[]
  referencedTables: string[]
}

/** 采集一次请求的全部上下文（AI 路由共用，避免各写一遍） */
export async function collectAIContext(connectionId: string, input: AIContextInput): Promise<AIContext> {
  const cached = await prisma.schemaSnapshot.findFirst({
    where: { connectionId, status: "active" },
    orderBy: { version: "desc" },
  })
  const schema = cached
    ? (cached.schemaJson as unknown as Awaited<ReturnType<typeof scanSchema>>)
    : await scanSchema(connectionId)

  const referencedTables = normalizeReferencedTables(input.referencedTables)

  let dataProfileText = ""
  try {
    if (referencedTables.length > 0) {
      const profiles = await Promise.all(
        referencedTables.map((name) => scanDataProfile(connectionId, name).catch(() => null)),
      )
      dataProfileText = buildDataProfileText(
        profiles.filter((profile): profile is NonNullable<typeof profile> => profile !== null),
      )
    } else {
      dataProfileText = buildDataProfileText(await scanAllDataProfiles(connectionId, 6))
    }
  } catch {
    dataProfileText = ""
  }

  let history: AIContext["history"] = []
  if (Array.isArray(input.conversationHistory) && input.conversationHistory.length > 0) {
    history = input.conversationHistory as AIContext["history"]
  } else if (typeof input.conversationId === "string" && input.conversationId) {
    const messages = await prisma.aIMessage.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: "asc" },
      take: 10,
    })
    history = messages.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }))
  }

  return {
    schemaContext: buildSchemaContext(schema),
    dataProfileText,
    businessContext:
      typeof input.businessContext === "string" && input.businessContext.trim()
        ? input.businessContext.trim()
        : "",
    history,
    referencedTables,
  }
}

/** trace 用摘要（不含内容） */
export function summarizeContext(context: AIContext) {
  return {
    schemaBytes: context.schemaContext.length,
    profileBytes: context.dataProfileText.length,
    businessBytes: context.businessContext.length,
    historyTurns: context.history.length,
    referencedTables: context.referencedTables,
  }
}
