import { useState, useEffect, useRef } from 'react';
import { User, TrainingQA } from '../App';
import { Send, LogOut, MessageSquare } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { MarkdownText } from './MarkdownText';

interface EmployeeChatPageProps {
  user: User;
  onLogout: () => void;
}

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
  sources?: string;
}

export function EmployeeChatPage({ user, onLogout }: EmployeeChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [trainingData, setTrainingData] = useState<TrainingQA[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat history from server (database)
    loadChatHistory();
    
    // Fetch training data from server
    fetchTrainingData();
  }, [user.id]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/chat-history/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Convert database format to component format
        const chatMessages: ChatMessage[] = data.history.map((msg: any) => ({
          role: msg.role,
          text: msg.text,
          timestamp: msg.timestamp,
          sources: msg.sources,
        }));
        setMessages(chatMessages);
        console.log(`Loaded ${chatMessages.length} messages from database`);
      }
    } catch (error) {
      console.log('Error loading chat history:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchTrainingData = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/training-qa`,
        {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrainingData(data.qaList || []);
      }
    } catch (error) {
      console.log('Error fetching training data:', error);
    }
  };

  const findBestAnswer = (question: string): string => {
    // Simple keyword matching
    const lowerQuestion = question.toLowerCase();
    
    for (const qa of trainingData) {
      const lowerTrainingQ = qa.question.toLowerCase();
      
      // Check if training question is similar to user question
      const keywords = lowerTrainingQ.split(' ').filter(word => word.length > 3);
      const matches = keywords.filter(keyword => lowerQuestion.includes(keyword));
      
      if (matches.length > 0 && matches.length / keywords.length > 0.5) {
        return qa.answer;
      }
    }

    // Default responses
    const defaultResponses = [
      'Terima kasih atas pertanyaan Anda. Untuk informasi lebih detail mengenai hal ini, saya sarankan untuk mengecek dokumen SOP yang telah diupload oleh HR, atau Anda bisa menghubungi HR untuk penjelasan lebih lanjut.',
      'Pertanyaan yang bagus! Berdasarkan data yang saya miliki, saya belum memiliki informasi spesifik tentang hal ini. Silakan hubungi HR untuk mendapatkan jawaban yang lebih akurat.',
      'Saya akan mencoba membantu. Namun untuk informasi yang lebih lengkap, silakan merujuk ke dokumen panduan pegawai magang atau konsultasi dengan tim HR.',
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user' as const,
      text: input,
      timestamp: Date.now(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Call server chat endpoint with RAG
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify({ message: currentInput }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Server error response:', data);
        throw new Error(data.error || 'Failed to send message');
      }

      const botMessage: ChatMessage = {
        role: 'bot',
        text: data.response,
        timestamp: Date.now(),
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMessage]);
      
      // Check if AI couldn't answer - save as unanswered question
      if (data.response.includes('tidak memiliki informasi') || 
          data.response.includes('hubungi HR')) {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/unanswered-questions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.accessToken}`,
            },
            body: JSON.stringify({ question: currentInput }),
          }
        );
        console.log('Saved unanswered question for HR review');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'bot',
        text: 'Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi atau hubungi HR.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-800 border-b border-purple-500/20 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-purple-600 to-cyan-500 p-2 rounded-lg">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white text-sm sm:text-base">Chatbot Training Magang</h1>
            <p className="text-purple-300 text-xs sm:text-sm">Tanyakan tentang SOP</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm">{user.name}</p>
            <p className="text-purple-300 text-xs">Pegawai Magang</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white border border-purple-500/20 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gradient-to-r from-purple-600 to-cyan-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-white mb-2">Selamat datang di Chatbot Training!</h2>
            <p className="text-purple-300">
              Tanyakan apapun tentang SOP perusahaan, prosedur kerja, atau hal lain yang ingin Anda ketahui.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
                className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-purple-200' : 'text-purple-400'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading Animation */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-purple-500/20 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-slate-800 border-t border-purple-500/20 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ketik pertanyaan Anda..."
            className="flex-1 px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400 text-sm sm:text-base"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl hover:from-purple-700 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30"
          >
            <Send className="w-5 h-5" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </div>
      </div>
    </div>
  );
}