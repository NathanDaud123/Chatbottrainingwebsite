import { useState, useEffect } from 'react';
import { MessageSquare, User as UserIcon, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { MarkdownText } from './MarkdownText';

interface ChatLogsTabProps {
  accessToken: string;
}

interface ChatHistoryByUser {
  [userId: string]: Array<{
    userId: string;
    userName: string;
    role: 'user' | 'bot';
    text: string;
    timestamp: number;
    sources?: string;
  }>;
}

export function ChatLogsTab({ accessToken }: ChatLogsTabProps) {
  const [histories, setHistories] = useState<ChatHistoryByUser>({});
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllChatHistories();
  }, []);

  const fetchAllChatHistories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/all-chat-histories`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHistories(data.histories || {});
        console.log(`Loaded chat histories for ${Object.keys(data.histories || {}).length} users`);
      } else {
        console.error('Failed to fetch chat histories');
      }
    } catch (error) {
      console.error('Error fetching chat histories:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-300">Memuat riwayat chat...</p>
        </div>
      </div>
    );
  }

  const userIds = Object.keys(histories);

  if (userIds.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-16 h-16 text-purple-400 mx-auto mb-4" />
        <h3 className="text-white mb-2">Belum Ada Riwayat Chat</h3>
        <p className="text-purple-300">
          Belum ada pegawai yang menggunakan chatbot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white mb-1">Riwayat Chat Pegawai</h2>
          <p className="text-purple-300">
            Total {userIds.length} pegawai menggunakan chatbot
          </p>
        </div>
        <button
          onClick={fetchAllChatHistories}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white border border-purple-500/20"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {userIds.map((userId) => {
          const userMessages = histories[userId];
          const userName = userMessages[0]?.userName || 'Unknown User';
          const messageCount = userMessages.length;
          const lastMessage = userMessages[userMessages.length - 1];
          const isExpanded = expandedUsers.has(userId);

          return (
            <div
              key={userId}
              className="bg-slate-800 border border-purple-500/20 rounded-lg overflow-hidden"
            >
              {/* User Header */}
              <button
                onClick={() => toggleUserExpand(userId)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-r from-purple-600 to-cyan-500 p-2 rounded-lg">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-white">{userName}</h3>
                    <p className="text-purple-300">
                      {messageCount} pesan • Terakhir chat:{' '}
                      {new Date(lastMessage.timestamp).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">
                    {isExpanded ? 'Tutup' : 'Lihat Chat'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-purple-400" />
                  )}
                </div>
              </button>

              {/* Chat Messages */}
              {isExpanded && (
                <div className="border-t border-purple-500/20 p-6 bg-slate-900/50">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {userMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-slate-800 border border-purple-500/20 text-white'
                          }`}
                        >
                          <MarkdownText text={msg.text} />
                          {msg.sources && (
                            <p className="text-xs mt-2 text-cyan-300 italic border-t border-cyan-500/20 pt-2">
                              {msg.sources}
                            </p>
                          )}
                          <p
                            className={`text-xs mt-1 flex items-center gap-1 ${
                              msg.role === 'user'
                                ? 'text-purple-200'
                                : 'text-purple-400'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {new Date(msg.timestamp).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
