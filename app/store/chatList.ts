import { create } from 'zustand';
import { updateChatTitleInServer, updateChatInServer, createFolder as createFolderInServer, deleteFolder as deleteFolderInServer, renameFolder as renameFolderInServer, moveChatToFolder as moveChatToFolderInServer, getFolders as getFoldersInServer } from '@/app/chat/actions/chat';
import { addBotToChatInServer } from '@/app/chat/actions/bot';
import { ChatType, ChatFolderType, Message } from '@/types/llm';
import { getMessagesInServer } from '@/app/chat/actions/message';
import { addChatInServer } from '@/app/chat/actions/chat';
import { addMessageInServer } from '@/app/chat/actions/message';

interface ExportMessage {
  role: string;
  content: string;
  providerId?: string;
  model?: string;
  createdAt?: string;
}

interface ExportChat {
  id: string;
  title: string;
  messages: ExportMessage[];
}

interface ExportData {
  version: number;
  exportedAt: string;
  chats: ExportChat[];
}

interface IChatListStore {
  chatList: ChatType[];
  folders: ChatFolderType[];
  searchKeyword: string;
  filteredChatList: () => ChatType[];
  setSearchKeyword: (keyword: string) => void;
  setNewTitle: (chatId: string, newTitle: string) => void;
  setChatList: (chatList: ChatType[]) => void;
  updateChat: (chatId: string, chat: {
    title?: string;
    defaultModel?: string;
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
  }) => void;
  addBot: (botId: number) => void;
  exportSingleChat: (chatId: string) => Promise<void>;
  exportAllChats: () => Promise<void>;
  importChats: (file: File) => Promise<{ success: boolean; count: number }>;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<ChatFolderType | null>;
  deleteFolder: (folderId: number) => Promise<void>;
  renameFolder: (folderId: number, name: string) => Promise<void>;
  moveChatToFolder: (chatId: string, folderId: number | null) => Promise<void>;
}

const downloadJson = (data: object, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const useChatListStore = create<IChatListStore>((set, get) => ({
  chatList: [],
  folders: [],
  searchKeyword: '',
  filteredChatList: () => {
    const { chatList, searchKeyword } = get();
    if (!searchKeyword.trim()) return chatList;
    const keyword = searchKeyword.toLowerCase().trim();
    return chatList.filter(chat =>
      chat.title?.toLowerCase().includes(keyword)
    );
  },
  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword });
  },
  setNewTitle: (chatId: string, newTitle: string) => {
    set((state) => {
      updateChatTitleInServer(chatId, newTitle);
      // 同步更新聊天列表
      const chatList = state.chatList.map(chat => {
        if (chat.id === chatId) {
          return { ...chat, title: newTitle };
        }
        return chat;
      });
      return { chatList };
    });
  },
  updateChat: (chatId: string, newChatInfo) => {
    set((state) => {
      updateChatInServer(chatId, newChatInfo);
      const chatList = state.chatList.map(chat => {
        if (chat.id === chatId) {
          return { ...chat, ...newChatInfo };
        }
        return chat;
      });
      return { chatList };
    });
  },
  setChatList: (chatList: ChatType[]) => {
    set((state) => {
      return { chatList: chatList };
    });
  },

  addBot: async (botId: number) => {
    const result = await addBotToChatInServer(botId);
    set((state) => ({
      chatList: [result.data as ChatType, ...state.chatList],
    }));
  },

  exportSingleChat: async (chatId: string) => {
    const chat = get().chatList.find(c => c.id === chatId);
    if (!chat) return;

    const result = await getMessagesInServer(chatId);
    const msgs: Message[] = result.status === 'success' ? (result.data as Message[]) : [];

    const exportMessages: ExportMessage[] = msgs
      .filter(m => m.type === 'text' && m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        ...(m.role === 'assistant' ? { providerId: m.providerId, model: m.model } : {}),
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
      }));

    const exportData: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chats: [{
        id: chat.id,
        title: chat.title || '',
        messages: exportMessages,
      }],
    };

    const safeTitle = (chat.title || 'chat').replace(/[^a-zA-Z0-9一-鿿]/g, '_').slice(0, 50);
    downloadJson(exportData, `${safeTitle}.json`);
  },

  exportAllChats: async () => {
    const chatList = get().chatList;
    const exportChats: ExportChat[] = [];

    for (const chat of chatList) {
      const result = await getMessagesInServer(chat.id);
      const msgs: Message[] = result.status === 'success' ? (result.data as Message[]) : [];

      const exportMessages: ExportMessage[] = msgs
        .filter(m => m.type === 'text' && m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          ...(m.role === 'assistant' ? { providerId: m.providerId, model: m.model } : {}),
          createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
        }));

      exportChats.push({
        id: chat.id,
        title: chat.title || '',
        messages: exportMessages,
      });
    }

    const exportData: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chats: exportChats,
    };

    downloadJson(exportData, `hivechat_export_${new Date().toISOString().slice(0, 10)}.json`);
  },

  importChats: async (file: File): Promise<{ success: boolean; count: number }> => {
    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);

      if (data.version !== 1 || !Array.isArray(data.chats)) {
        return { success: false, count: 0 };
      }

      let importedCount = 0;
      for (const chat of data.chats) {
        const chatResult = await addChatInServer({
          title: chat.title || 'Imported Chat',
        });

        if (chatResult.status === 'success' && chatResult.data) {
          const newChatId = (chatResult.data as ChatType).id;
          for (const msg of chat.messages) {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            await addMessageInServer({
              chatId: newChatId,
              role: msg.role,
              content: content,
              providerId: msg.providerId || 'unknown',
              model: msg.model || 'unknown',
              type: 'text',
            });
          }
          importedCount++;
        }
      }

      // Refresh chat list after import
      const { getChatListInServer } = await import('@/app/chat/actions/chat');
      const listResult = await getChatListInServer();
      if (listResult.status === 'success') {
        get().setChatList(listResult.data as ChatType[]);
      }

      return { success: true, count: importedCount };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, count: 0 };
    }
  },

  loadFolders: async () => {
    const result = await getFoldersInServer();
    if (result.status === 'success') {
      set({ folders: result.data as ChatFolderType[] });
    }
  },

  createFolder: async (name: string) => {
    const result = await createFolderInServer(name);
    if (result.status === 'success' && result.data) {
      set((state) => ({ folders: [...state.folders, result.data as ChatFolderType] }));
      return result.data as ChatFolderType;
    }
    return null;
  },

  deleteFolder: async (folderId: number) => {
    const result = await deleteFolderInServer(folderId);
    if (result.status === 'success') {
      set((state) => ({
        folders: state.folders.filter(f => f.id !== folderId),
        chatList: state.chatList.map(chat =>
          chat.folderId === folderId ? { ...chat, folderId: null } : chat
        ),
      }));
    }
  },

  renameFolder: async (folderId: number, name: string) => {
    const result = await renameFolderInServer(folderId, name);
    if (result.status === 'success') {
      set((state) => ({
        folders: state.folders.map(f =>
          f.id === folderId ? { ...f, name } : f
        ),
      }));
    }
  },

  moveChatToFolder: async (chatId: string, folderId: number | null) => {
    const result = await moveChatToFolderInServer(chatId, folderId);
    if (result.status === 'success') {
      set((state) => ({
        chatList: state.chatList.map(chat =>
          chat.id === chatId ? { ...chat, folderId } : chat
        ),
      }));
    }
  },

}))

export default useChatListStore
