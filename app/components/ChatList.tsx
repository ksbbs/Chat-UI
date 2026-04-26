import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from "next/image";
import Link from 'next/link';
import clsx from 'clsx';
import { Modal, Input, Skeleton, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { ChatType, ChatFolderType } from '@/types/llm';
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, ExportOutlined, ImportOutlined, FolderOutlined, FolderAddOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { message } from 'antd';
import ChatItem from './ChatItem';
import MessageIcon from "@/app/images/message.svg";
import TopIcon from "@/app/images/top.svg";
import CancelTopIcon from "@/app/images/cancelTop.svg";
import DeleteIcon from "@/app/images/delete.svg";
import ThumbtackIcon from "@/app/images/thumbtack.svg";
import PlusIcon from "@/app/images/plus.svg";
import Spark from "@/app/images/spark.svg";
import useChatListStore from '@/app/store/chatList';
import MenuSection from '@/app/components/SidebarMenuSection';
import { getChatListInServer, deleteChatInServer, updateChatInServer } from '@/app/chat/actions/chat';
import { useTranslations } from 'next-intl';
import useChatStore from '@/app/store/chat';
import { useSession } from 'next-auth/react';

const ChatList = () => {
  const t = useTranslations('Chat');
  const pathname = usePathname();
  const router = useRouter();
  const currentChatId = pathname.split("/").pop() || '';
  const [highlightedChat, setHighlightedChat] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [renameChatId, setRenameChatId] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [chatListStatus, setChatListStatus] = useState('init');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null);
  const [isRenameFolderModalOpen, setIsRenameFolderModalOpen] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const {
    chatList, folders, setChatList, updateChat, setNewTitle,
    searchKeyword, setSearchKeyword, filteredChatList,
    exportSingleChat, exportAllChats, importChats,
    loadFolders, createFolder, deleteFolder, renameFolder, moveChatToFolder
  } = useChatListStore();
  const { chat, setChat } = useChatStore();
  const { status } = useSession();

  const displayChatList = filteredChatList();

  // Separate chats into folder-based and recent (no folder)
  const { recentChatsWithoutBot, folderChats, isOver8, botChats } = useMemo(() => {
    const nonBotChats = displayChatList.filter(chat => !chat.isWithBot);

    // Recent chats = those without a folder
    const recent = nonBotChats.filter(chat => !chat.folderId);
    const top8 = recent.slice(0, 8);
    const isOver = recent.length > 8;

    // Build folder-based chat map
    const folderChatMap: Record<number, ChatType[]> = {};
    for (const f of folders) {
      folderChatMap[f.id] = nonBotChats.filter(chat => chat.folderId === f.id);
    }

    const sortedBotChats = displayChatList
      .filter(chat => chat.isWithBot)
      .sort((a, b) => {
        if (a?.isStar && a.starAt && b?.isStar && b.starAt) {
          return new Date(b.starAt).getTime() - new Date(a.starAt).getTime();
        }
        if (a?.isStar && !b?.isStar) {
          return -1;
        }
        if (!a?.isStar && b?.isStar) {
          return 1;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return {
      recentChatsWithoutBot: top8,
      folderChats: folderChatMap,
      isOver8: isOver,
      botChats: sortedBotChats
    };
  }, [displayChatList, folders]);

  useEffect(() => {
    const fetchAllChats = async () => {
      try {
        const result = await getChatListInServer();
        if (result.status === 'success') {
          setChatList(result.data as ChatType[]);
        } else {
          setChatList([]);
        }
      } catch (error) {
        console.error("Failed to fetch chats:", error);
        message.error(t('fetchFailed'));
      } finally {
        setChatListStatus('done');
      }
    };
    fetchAllChats();
    loadFolders();
  }, [status, setChatList, loadFolders, t]);

  const handleOpenChange = (isOpen: boolean, chatId: string) => {
    setHighlightedChat(isOpen ? chatId : '');
  };

  const deleteChat = async (chat_id: string) => {
    try {
      const result = await deleteChatInServer(chat_id);
      if (result.status === 'success') {
        message.success(t('deleteSuccess'));
        const chatListresult = await getChatListInServer();
        setChatList(chatListresult.data as ChatType[]);

        if (currentChatId === chat_id) {
          if (chatListresult.data && chatListresult.data?.length > 0) {
            router.push(`/chat/${chatListresult.data[0]['id']}`)
          } else {
            router.push(`/chat/`)
          }
        }
      } else {
        message.error(t('deleteFail'));
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      message.error(t('deleteFail'));
    }
  };

  const toggleStar = async (chat_id: string, is_star: boolean) => {
    try {
      await updateChatInServer(chat_id, { isStar: is_star, starAt: new Date() })
      if (currentChatId === chat_id && chat) {
        setChat({ ...chat, isStar: !Boolean(chat.isStar), starAt: new Date() });
      }
      updateChat(chat_id, { isStar: is_star, starAt: new Date() });
    } catch (error) {
      console.error("Failed to toggle star:", error);
      message.error(t('updateFailed'));
    }
  }

  const handleChatAction = (action: string, chatId: string) => {
    if (action === 'delete') {
      deleteChat(chatId);
    } else if (action === 'edit') {
      const chat = chatList.find(c => c.id === chatId);
      setNewChatName(chat?.title || '');
      setRenameChatId(chatId);
      setIsEditModalOpen(true);
    } else if (action === 'top') {
      const chat = chatList.find(c => c.id === chatId);
      toggleStar(chatId, !chat?.isStar);
    } else if (action === 'export') {
      exportSingleChat(chatId);
    } else if (action.startsWith('folder-')) {
      if (action === 'folder-none') {
        handleMoveToFolder(chatId, null);
      } else {
        const folderId = parseInt(action.replace('folder-', ''), 10);
        handleMoveToFolder(chatId, folderId);
      }
    }
  };

  // Handle moving a chat to a folder
  const handleMoveToFolder = (chatId: string, folderId: number | null) => {
    moveChatToFolder(chatId, folderId);
  };

  // Handle creating a new folder
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim()).then((folder) => {
        if (folder) {
          message.success(t('newFolder'));
        }
      });
      setNewFolderName('');
      setIsFolderModalOpen(false);
    }
  };

  // Handle folder context menu actions
  const handleFolderAction = (action: string, folderId: number) => {
    if (action === 'renameFolder') {
      const folder = folders.find(f => f.id === folderId);
      setRenameFolderName(folder?.name || '');
      setRenameFolderId(folderId);
      setIsRenameFolderModalOpen(true);
    } else if (action === 'deleteFolder') {
      deleteFolder(folderId).then(() => {
        message.success(t('deleteSuccess'));
      });
    }
  };

  const handleSaveFolderRename = () => {
    if (renameFolderName.trim() && renameFolderId) {
      renameFolder(renameFolderId, renameFolderName.trim());
      setIsRenameFolderModalOpen(false);
    }
  };

  const handleSaveTitle = () => {
    if (newChatName.trim()) {
      setNewTitle(renameChatId, newChatName);
      setIsEditModalOpen(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importChats(file);
    if (result.success && result.count > 0) {
      message.success(t('importSuccess'));
    } else {
      message.error(t('importFailed'));
    }
    // Reset the file input so the same file can be selected again
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  };

  // Build folder menu items for moving a chat (not used directly, but getStandardMenuItems uses folders)

  // Folder context menu items
  const getFolderContextMenuItems = (folderId: number): MenuProps['items'] => {
    return [
      {
        label: t('rename'),
        icon: <EditOutlined />,
        key: 'renameFolder',
      },
      {
        type: 'divider' as const,
      },
      {
        label: t('deleteFolder'),
        icon: <DeleteOutlined />,
        key: 'deleteFolder',
      },
    ];
  };

  // 常规聊天的菜单项 - with folder move option
  const getStandardMenuItems = (isStar: boolean, chatId: string): MenuProps['items'] => {
    const folderMoveItems = folders.length > 0 ? [
      {
        label: t('moveToFolder'),
        icon: <FolderOutlined />,
        key: 'moveToFolder',
        children: [
          ...folders.map(folder => ({
            label: folder.name,
            key: `folder-${folder.id}`,
          })),
          { label: t('noFolder'), key: 'folder-none' },
        ],
      },
      { type: 'divider' as const },
    ] : [];

    return [
      {
        label: t('rename'),
        icon: <EditOutlined />,
        key: 'edit',
      },
      ...folderMoveItems,
      {
        type: 'divider' as const,
      },
      {
        label: t('exportChat'),
        icon: <ExportOutlined />,
        key: 'export',
      },
      {
        type: 'divider' as const,
      },
      {
        label: t('delete'),
        key: 'delete',
        icon: <DeleteOutlined />,
      },
    ];
  };

  // 机器人聊天的菜单项
  const getBotActionItems = (isTop: boolean): MenuProps['items'] => {
    return [
      {
        label: isTop ? t('unPin') : t('pin'),
        icon: isTop ? <CancelTopIcon width={18} height={18} /> : <TopIcon width={20} height={20} />,
        key: 'top',
      },
      {
        type: 'divider' as const,
      },
      {
        label: t('exportChat'),
        icon: <ExportOutlined />,
        key: 'export',
      },
      {
        type: 'divider' as const,
      },
      {
        label: t('delete'),
        key: 'delete',
        icon: <DeleteIcon width={20} height={20} />,
      },
    ];
  };

  // Handle menu click that includes folder move
  const handleStandardMenuClick = (e: { key: string; domEvent?: Event }, chatId: string) => {
    const key = e.key;
    if (key === 'delete') {
      deleteChat(chatId);
    } else if (key === 'edit') {
      const chat = chatList.find(c => c.id === chatId);
      setNewChatName(chat?.title || '');
      setRenameChatId(chatId);
      setIsEditModalOpen(true);
    } else if (key === 'export') {
      exportSingleChat(chatId);
    } else if (key.startsWith('folder-')) {
      if (key === 'folder-none') {
        handleMoveToFolder(chatId, null);
      } else {
        const folderId = parseInt(key.replace('folder-', ''), 10);
        handleMoveToFolder(chatId, folderId);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col box-border pt-2 pl-0 pr-4">
        <Link href='/chat'>
          <div className="w-full border rounded-xl text-center p-2 text-sm new-chat-button whitespace-nowrap">
            <PlusOutlined className='mr-2' style={{ color: '#0057ff' }} />{t('newChat')}
          </div>
        </Link>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder={t('searchPlaceholder')}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          className="mt-2"
          style={{ borderRadius: '12px' }}
        />
      </div>

      <div className="flex flex-col flex-grow rounded-xl h-0 mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {/* Folder sections */}
        {folders.map((folder) => (
          <MenuSection
            key={folder.id}
            title={folder.name}
            icon={<FolderOutlined style={{ fontSize: '16px' }} />}
            defaultExpanded={true}
          >
            <div className="flex items-center justify-between mr-4 ml-4">
              <span className="text-xs text-gray-400">
                {folderChats[folder.id]?.length || 0} {t('piece')}
              </span>
              <Dropdown
                menu={{
                  items: getFolderContextMenuItems(folder.id),
                  onClick: (e) => handleFolderAction(e.key, folder.id),
                }}
                trigger={['click']}
              >
                <span className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                  <EditOutlined />
                </span>
              </Dropdown>
            </div>
            <ul className="pr-4">
              {(folderChats[folder.id] || []).map((chat) => (
                <Link key={chat.id} href={`/chat/${chat.id}`}>
                  <ChatItem
                    chat={chat}
                    isActive={chat.id === currentChatId}
                    isHighlighted={highlightedChat === chat.id}
                    onOpenChange={handleOpenChange}
                    onAction={handleChatAction}
                    menuItems={getStandardMenuItems(Boolean(chat.isStar), chat.id)}
                    className="ml-5 pl-3"
                  >
                    <div className="whitespace-nowrap w-0 grow overflow-hidden text-ellipsis">
                      {chat.title}
                    </div>
                  </ChatItem>
                </Link>
              ))}
              {(folderChats[folder.id] || []).length === 0 && (
                <div className='flex flex-col'>
                  <span className='my-2 text-xs text-gray-400 ml-8'>{t('historyNotice')}</span>
                </div>
              )}
            </ul>
          </MenuSection>
        ))}

        {/* Create folder button */}
        <div className="px-4 mb-2">
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <FolderAddOutlined />
            <span>{t('newFolder')}</span>
          </button>
        </div>

        {/* 最近聊天部分 */}
        <MenuSection
          title={t('recentChat')}
          icon={<MessageIcon width='20' height='20' />}
          defaultExpanded={true}>

          {chatListStatus !== 'done' ? (
            <div className='pl-8 py-4 pr-6'>
              <Skeleton title={false} paragraph={{ rows: 6, width: ['60%', '70%', '70%', '60%', '70%', '70%'] }} active />
            </div>
          ) : (
            <>
              {recentChatsWithoutBot.length === 0 && (
                <div className='flex flex-col'>
                  <span className='my-2 text-xs text-gray-400 ml-8'>{t('historyNotice')}</span>
                </div>
              )}

              <ul className="pr-4">
                {recentChatsWithoutBot.map((chat) => (
                  <Link key={chat.id} href={`/chat/${chat.id}`}>
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === currentChatId}
                      isHighlighted={highlightedChat === chat.id}
                      onOpenChange={handleOpenChange}
                      onAction={handleChatAction}
                      menuItems={getStandardMenuItems(Boolean(chat.isStar), chat.id)}
                      className="ml-5 pl-3"
                    >
                      <div className="whitespace-nowrap w-0 grow overflow-hidden text-ellipsis">
                        {chat.title}
                      </div>
                    </ChatItem>
                  </Link>
                ))}

                {isOver8 && (
                  <Link href='/chat/thread/list'>
                    <li
                      style={{ fontSize: '13px' }}
                      className={clsx(
                        { "bg-white hover:bg-white font-medium text-gray-800": '/chat/thread/list' === pathname },
                        "pr-2 ml-5 pl-3 py-1.5 rounded-xl text-gray-500 relative group mt-1 hover:bg-gray-200"
                      )}>
                      <div className="flex items-center justify-between w-full grow">
                        <div className="whitespace-nowrap w-0 grow overflow-hidden text-ellipsis">
                          {t('viewAll')}...
                        </div>
                      </div>
                    </li>
                  </Link>
                )}
              </ul>
            </>
          )}
        </MenuSection>

        <MenuSection
          title={t('myBots')}
          icon={<Spark width={20} height={20} alt='spark' />}
          defaultExpanded={false}
        >
          <ul className="pr-4">
            <Link href={`/chat/bot/discover`}>
              <li
                style={{ fontSize: '13px' }}
                className={clsx(
                  { 'bg-white font-medium text-gray-800': pathname === '/bot/discover' },
                  "pr-2 ml-0 pl-2 py-2 rounded-xl text-gray-500 relative group mt-1 hover:bg-gray-200"
                )}>
                <div className="flex items-center justify-between w-full grow">
                  <div style={{ width: '20px', height: '20px' }} className="flex items-center justify-center">
                    <PlusIcon width={18} height={18} alt='add' />
                  </div>
                  <div className="ml-1 whitespace-nowrap w-0 grow overflow-hidden text-ellipsis">
                    {t('discoverBots')}
                  </div>
                </div>
              </li>
            </Link>

            {botChats.map((chat) => (
              <Link key={chat.id} href={`/chat/${chat.id}`}>
                <ChatItem
                  chat={chat}
                  isActive={chat.id === currentChatId}
                  isHighlighted={highlightedChat === chat.id}
                  onOpenChange={handleOpenChange}
                  onAction={handleChatAction}
                  menuItems={getBotActionItems(Boolean(chat.isStar))}
                  className="ml-0 pl-2"
                >
                  <div style={{ width: '22px', height: '22px' }} className="flex items-center justify-center bg-slate-200 rounded-full">
                    {chat.avatarType === 'emoji' && (
                      <span className='text-base'>{chat.avatar}</span>
                    )}
                    {chat.avatarType === 'url' && (
                      <Image
                        src={chat.avatar as string}
                        unoptimized
                        className='rounded-full'
                        width={20}
                        height={20}
                        alt='chat bot'
                      />
                    )}
                  </div>
                  <div className="ml-1 flex flex-row whitespace-nowrap w-0 grow">
                    <span className='text-ellipsis overflow-hidden'>{chat.title}</span>
                    {chat?.isStar && <ThumbtackIcon className='ml-2' width={16} height={16} alt='thumbtack' />}
                  </div>
                </ChatItem>
              </Link>
            ))}
          </ul>
        </MenuSection>
      </div>

      {/* Export All / Import buttons at the bottom of sidebar */}
      <div className="flex flex-row gap-2 mr-4 mt-2">
        <button
          onClick={() => exportAllChats()}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ExportOutlined />
          <span>{t('exportAllChats')}</span>
        </button>
        <button
          onClick={() => importFileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ImportOutlined />
          <span>{t('importChat')}</span>
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Create folder modal */}
      <Modal
        title={t('newFolder')}
        open={isFolderModalOpen}
        onOk={handleCreateFolder}
        onCancel={() => setIsFolderModalOpen(false)}
        cancelText={t('cancel')}
        okText={t('confirm')}
      >
        <Input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder={t('folderName')}
          style={{ marginTop: '1em', marginBottom: '1em' }}
        />
      </Modal>

      {/* Rename folder modal */}
      <Modal
        title={t('rename')}
        open={isRenameFolderModalOpen}
        onOk={handleSaveFolderRename}
        onCancel={() => setIsRenameFolderModalOpen(false)}
        cancelText={t('cancel')}
        okText={t('save')}
      >
        <Input
          value={renameFolderName}
          onChange={(e) => setRenameFolderName(e.target.value)}
          placeholder={t('folderName')}
          style={{ marginTop: '1em', marginBottom: '1em' }}
        />
      </Modal>

      {/* 编辑聊天名称的弹窗 */}
      <Modal
        title={t('editChatName')}
        open={isEditModalOpen}
        onOk={handleSaveTitle}
        onCancel={() => setIsEditModalOpen(false)}
        cancelText={t('cancel')}
        okText={t('save')}
      >
        <Input
          value={newChatName}
          onChange={(e) => setNewChatName(e.target.value)}
          placeholder={t('chatNameplaceholder')}
          style={{ marginTop: '1em', marginBottom: '1em' }}
        />
      </Modal>
    </>
  );
};

export default ChatList;