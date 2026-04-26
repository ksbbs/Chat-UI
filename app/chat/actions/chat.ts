'use server';
import { db } from '@/app/db';
import { auth } from "@/auth";
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { ChatType, ChatFolderType, MCPToolResponse } from '@/types/llm';
import WebSearchService from '@/app/services/WebSearchService';
import { chats, messages, appSettings, mcpServers, mcpTools, searchEngineConfig, chatFolders } from '@/app/db/schema';
import { WebSearchResponse } from '@/types/search';

export const addChatInServer = async (
  chatInfo: {
    title: string;
    defaultModel?: string;
    defaultProvider?: string;
    searchEnabled?: boolean;
    historyType?: 'all' | 'none' | 'count';
    historyCount?: number;
    isStar?: boolean;
    isWithBot?: boolean;
    botId?: number;
    avatar?: string;
    avatarType?: 'emoji' | 'url' | 'none';
    prompt?: string;
  }
) => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }
  const safeTitle = chatInfo.title.length > 255 ? chatInfo.title.slice(0, 255) : chatInfo.title;
  const result = await db.insert(chats)
    .values({
      ...chatInfo,
      title: safeTitle,
      userId: session.user.id
    })
    .returning();
  if (result[0]) {
    return {
      status: 'success',
      data: result[0],
    }
  } else {
    return {
      status: 'fail',
    }
  }
}

export const getChatInfoInServer = async (chatId: string): Promise<{ status: string; data: ChatType | null }> => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'success',
      data: null
    }
  }
  const result = await db.select()
    .from(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, session.user.id),
      ));
  if (result.length > 0) {
    const data = result[0];
    return {
      status: 'success',
      data: {
        id: data.id,
        title: data.title ?? undefined,
        defaultModel: data.defaultModel ?? undefined,
        defaultProvider: data.defaultProvider ?? undefined,
        searchEnabled: data.searchEnabled ?? undefined,
        historyType: data.historyType ?? undefined,
        historyCount: data.historyCount ?? undefined,
        isStar: data.isStar ?? undefined,
        isWithBot: data.isWithBot ?? undefined,
        botId: data.botId ?? undefined,
        avatarType: data.avatarType ?? undefined,
        prompt: data.prompt ?? undefined,
        createdAt: data.createdAt!,
        starAt: data.starAt ?? undefined,
        folderId: data.folderId ?? undefined,
      }
    }
  } else {
    return {
      status: 'fail',
      data: null
    }
  }
}

export const getChatListInServer = async () => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'success',
      data: []
    }
  }
  const result = await db.select()
    .from(chats)
    .where(
      and(
        eq(chats.userId, session.user.id)
      ))
    .orderBy(desc(chats.createdAt));
  return {
    status: 'success',
    data: result
  }
}

export const updateChatInServer = async (chatId: string, newChatInfo: {
  title?: string;
  defaultModel?: string;
  defaultProvider?: string;
  historyType?: 'all' | 'none' | 'count';
  historyCount?: number;
  isStar?: boolean;
  isWithBot?: boolean;
  botId?: number;
  avatar?: string;
  avatarType?: 'emoji' | 'url' | 'none';
  prompt?: string;
  starAt?: Date;
  folderId?: number | null;
}) => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }
  const safeChatInfo = { ...newChatInfo };
  if (safeChatInfo.title && safeChatInfo.title.length > 255) {
    safeChatInfo.title = safeChatInfo.title.slice(0, 255);
  }
  const result = await db.update(chats)
    .set(safeChatInfo)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, session.user.id)
      ));
  return {
    status: 'success',
  }
}

export const updateChatTitleInServer = async (chatId: string, newTitle: string) => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }
  try {
    const safeTitle = newTitle.length > 255 ? newTitle.slice(0, 255) : newTitle;
    await db.update(chats)
      .set({
        title: safeTitle,
      })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, session.user.id)
        ));
    return {
      status: 'success',
    }
  }
  catch {
    return {
      status: 'fail',
    }
  }
}

export const deleteChatInServer = async (chatId: string) => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }
  const result = await db.delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, session.user.id)
      ));
  await db.delete(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(messages.userId, session.user.id)
      ));

  return {
    status: 'success',
  }

}

export const deleteAllUserChatInServer = async () => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }
  const result = await db.delete(chats)
    .where(
      eq(chats.userId, session.user.id)
    );
  await db.delete(messages)
    .where(
      eq(messages.userId, session.user.id)
    );
  return {
    status: 'success',
  }
}

export const fetchAppSettings = async (key: string) => {
  const result = await db.query.appSettings
    .findFirst({
      where: eq(appSettings.key, key)
    });
  return result?.value;
}

export const fetchSettingsByKeys = async (keys: Array<string>) => {
  const results = await db.query.appSettings
    .findMany({
      where: (appSettings) => inArray(appSettings.key, keys)
    });

  // Initialize the result object with all requested keys set to null
  const settingsObject = keys.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as Record<string, string | null>);

  // Update the values for keys that exist in the database
  results.forEach(setting => {
    settingsObject[setting.key] = setting.value;
  });

  return settingsObject;
}

export const getMcpServersAndAvailableTools = async () => {
  try {
    const tools = await db
      .select({
        name: mcpTools.name,
        description: mcpTools.description,
        serverId: mcpTools.serverId,
        inputSchema: mcpTools.inputSchema,
      })
      .from(mcpTools)
      .leftJoin(mcpServers, eq(mcpTools.serverId, mcpServers.id))
      .orderBy(
        asc(mcpTools.serverId),
      )
      .where(
        eq(mcpServers.isActive, true)
      );
    const servers = await db.query.mcpServers.findMany({
      where: eq(mcpServers.isActive, true),
      orderBy: [mcpServers.createdAt],
    });
    return {
      tools,
      mcpServers: servers
    };
  } catch (error) {
    return {
      tools: [],
      mcpServers: []
    };
  }
}

export const syncMcpTools = async (messageId: number, mcpToolsResponse: MCPToolResponse[]) => {
  try {
    await db.update(messages)
      .set({
        mcpTools: mcpToolsResponse,
        updatedAt: new Date()
      })
      .where(eq(messages.id, messageId));

    return {
      status: 'success',
      message: '工具信息已保存'
    };
  } catch (error) {
    console.error('同步 MCP 工具响应失败:', error);
    return {
      status: 'fail',
      message: '同步工具失败'
    };
  }
}

export const forkChat = async (
  sourceChatId: string,
  messageIndex: number
): Promise<{ status: string; data?: { chatId: string }; message?: string }> => {
  const session = await auth();
  if (!session?.user.id) {
    return {
      status: 'fail',
      message: 'please login first.'
    }
  }

  try {
    // Get the source chat
    const sourceChatResult = await db.select()
      .from(chats)
      .where(
        and(
          eq(chats.id, sourceChatId),
          eq(chats.userId, session.user.id),
        ));

    if (sourceChatResult.length === 0) {
      return { status: 'fail', message: 'Chat not found.' };
    }

    const sourceChat = sourceChatResult[0];

    // Create a new chat with "(fork)" suffix
    const forkTitle = (sourceChat.title || 'New Chat').length > 245
      ? (sourceChat.title || 'New Chat').slice(0, 245) + ' (fork)'
      : (sourceChat.title || 'New Chat') + ' (fork)';

    const newChatResult = await db.insert(chats)
      .values({
        title: forkTitle,
        userId: session.user.id,
        defaultModel: sourceChat.defaultModel,
        defaultProvider: sourceChat.defaultProvider,
        searchEnabled: sourceChat.searchEnabled,
        historyType: sourceChat.historyType,
        historyCount: sourceChat.historyCount,
        isWithBot: sourceChat.isWithBot,
        botId: sourceChat.botId,
        avatar: sourceChat.avatar,
        avatarType: sourceChat.avatarType,
        prompt: sourceChat.prompt,
      })
      .returning();

    if (!newChatResult[0]) {
      return { status: 'fail', message: 'Failed to create forked chat.' };
    }

    const newChatId = newChatResult[0].id;

    // Get messages from the source chat up to the given index
    const sourceMessages = await db.select()
      .from(messages)
      .where(
        and(
          eq(messages.chatId, sourceChatId),
          eq(messages.userId, session.user.id),
        ))
      .orderBy(asc(messages.createdAt));

    // Copy messages 0..messageIndex (inclusive)
    const messagesToCopy = sourceMessages.slice(0, messageIndex + 1);

    if (messagesToCopy.length > 0) {
      const messageValues = messagesToCopy.map((msg) => ({
        userId: session.user.id!,
        chatId: newChatId,
        role: msg.role,
        content: msg.content,
        reasoninContent: msg.reasoninContent,
        model: msg.model,
        providerId: msg.providerId,
        type: msg.type,
        searchEnabled: msg.searchEnabled,
        webSearch: msg.webSearch,
        searchStatus: msg.searchStatus,
        mcpTools: msg.mcpTools,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        totalTokens: msg.totalTokens,
        errorType: msg.errorType,
        errorMessage: msg.errorMessage,
      }));

      await db.insert(messages).values(messageValues);
    }

    return {
      status: 'success',
      data: { chatId: newChatId },
    };
  } catch (error) {
    console.error('Fork chat error:', error);
    return { status: 'fail', message: 'Failed to fork chat.' };
  }
}

export const getSearchResult = async (keyword: string): Promise<{
  status: string;
  message: string;
  data: WebSearchResponse | null;
}> => {
  const session = await auth();
  if (!session?.user) {
    throw new Error('not allowed');
  }

  const searchConfig = await db.query.searchEngineConfig.findFirst({
    where: eq(searchEngineConfig.isActive, true)
  });
  if (searchConfig) {
    try {
      const webSearch = await WebSearchService.search({
        id: searchConfig.id,
        name: searchConfig.name,
        apiKey: searchConfig.apiKey as string
      }, keyword, searchConfig.maxResults);
      return {
        status: 'success',
        message: 'success',
        data: webSearch
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      }
    }
  } else {
    return {
      status: 'error',
      message: '管理员未配置搜索',
      data: null
    }
  }
}

// ===================== Folder Server Actions =====================

export const createFolder = async (name: string) => {
  const session = await auth();
  if (!session?.user.id) {
    return { status: 'fail', message: 'please login first.' };
  }
  try {
    const result = await db.insert(chatFolders)
      .values({
        userId: session.user.id,
        name,
      })
      .returning();
    if (result[0]) {
      return { status: 'success', data: result[0] as ChatFolderType };
    }
    return { status: 'fail', message: 'Failed to create folder.' };
  } catch (error) {
    console.error('Create folder error:', error);
    return { status: 'fail', message: 'Failed to create folder.' };
  }
};

export const deleteFolder = async (folderId: number) => {
  const session = await auth();
  if (!session?.user.id) {
    return { status: 'fail', message: 'please login first.' };
  }
  try {
    // Move all chats in this folder back to no folder
    await db.update(chats)
      .set({ folderId: null })
      .where(
        and(
          eq(chats.folderId, folderId),
          eq(chats.userId, session.user.id)
        )
      );
    // Delete the folder
    await db.delete(chatFolders)
      .where(
        and(
          eq(chatFolders.id, folderId),
          eq(chatFolders.userId, session.user.id)
        )
      );
    return { status: 'success' };
  } catch (error) {
    console.error('Delete folder error:', error);
    return { status: 'fail', message: 'Failed to delete folder.' };
  }
};

export const renameFolder = async (folderId: number, name: string) => {
  const session = await auth();
  if (!session?.user.id) {
    return { status: 'fail', message: 'please login first.' };
  }
  try {
    await db.update(chatFolders)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(chatFolders.id, folderId),
          eq(chatFolders.userId, session.user.id)
        )
      );
    return { status: 'success' };
  } catch (error) {
    console.error('Rename folder error:', error);
    return { status: 'fail', message: 'Failed to rename folder.' };
  }
};

export const moveChatToFolder = async (chatId: string, folderId: number | null) => {
  const session = await auth();
  if (!session?.user.id) {
    return { status: 'fail', message: 'please login first.' };
  }
  try {
    await db.update(chats)
      .set({ folderId })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, session.user.id)
        )
      );
    return { status: 'success' };
  } catch (error) {
    console.error('Move chat to folder error:', error);
    return { status: 'fail', message: 'Failed to move chat to folder.' };
  }
};

export const getFolders = async () => {
  const session = await auth();
  if (!session?.user.id) {
    return { status: 'success', data: [] };
  }
  try {
    const result = await db.select()
      .from(chatFolders)
      .where(eq(chatFolders.userId, session.user.id))
      .orderBy(asc(chatFolders.sortOrder), asc(chatFolders.createdAt));
    return { status: 'success', data: result as ChatFolderType[] };
  } catch (error) {
    console.error('Get folders error:', error);
    return { status: 'success', data: [] };
  }
};