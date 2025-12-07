import React, { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, BookOpen, FileText, LogOut, Plus, X, Trash2, ChevronLeft, ChevronRight, Users, Upload, HelpCircle, Check, History } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { UnansweredQuestionsTab } from './UnansweredQuestionsTab';
import { DocumentUploadModal } from './DocumentUploadModal';
import { ChatLogsTab } from './ChatLogsTab';

interface HRDashboardProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'analytics' | 'logs' | 'documents' | 'training' | 'unanswered' | 'chat-histories';

export function HRDashboard({ user, onLogout }: HRDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([]);
  const [trainingQA, setTrainingQA] = useState<TrainingQA[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Fetch chat logs
      const logsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/chat-logs`,
        {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        console.log('Chat logs from server:', logsData);
        setChatLogs((logsData.logs || []).filter((log: ChatMessage | null) => log !== null));
      } else {
        console.log('Failed to fetch chat logs:', logsResponse.status);
      }

      // Fetch training Q&A
      const qaResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/training-qa`,
        {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );
      
      if (qaResponse.ok) {
        const qaData = await qaResponse.json();
        console.log('Training QA from server:', qaData);
        setTrainingQA((qaData.qaList || []).filter((qa: TrainingQA | null) => qa !== null));
      }

      // Fetch documents
      const docsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/documents`,
        {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );
      
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        console.log('Documents from server:', docsData);
        setDocuments((docsData.documents || []).filter((doc: Document | null) => doc !== null));
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTraining = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/training-qa`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify({
            question: newQuestion,
            answer: newAnswer,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrainingQA([...trainingQA, data.qa]);
        setNewQuestion('');
        setNewAnswer('');
      }
    } catch (error) {
      console.log('Error adding training data:', error);
    }
  };

  const handleDeleteTraining = async (id: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/training-qa/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );

      if (response.ok) {
        setTrainingQA(trainingQA.filter(qa => qa.id !== id));
      }
    } catch (error) {
      console.log('Error deleting training data:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    try {
      for (const file of Array.from(files)) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.accessToken}`,
            },
            body: JSON.stringify({
              name: file.name,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setDocuments([...documents, data.document]);
        }
      }
    } catch (error) {
      console.log('Error uploading documents:', error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/documents/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
          },
        }
      );

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== id));
      }
    } catch (error) {
      console.log('Error deleting document:', error);
    }
  };

  const getUniqueUsers = () => {
    const uniqueUserIds = new Set(chatLogs.filter(log => log).map(log => log.userId));
    return uniqueUserIds.size;
  };

  const getTotalQuestions = () => {
    return chatLogs.filter(log => log).length;
  };

  const getAverageQuestionsPerUser = () => {
    const uniqueUsers = getUniqueUsers();
    if (uniqueUsers === 0) return 0;
    return (getTotalQuestions() / uniqueUsers).toFixed(1);
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <div className={`${sidebarMinimized ? 'w-20' : 'w-64'} bg-slate-800 border-r border-purple-500/20 flex flex-col transition-all duration-300`}>
        <div className="p-6 border-b border-purple-500/20">
          {!sidebarMinimized && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-r from-purple-600 to-cyan-500 p-2 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white">HR Dashboard</h2>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 rounded-lg p-3 border border-purple-500/20">
                <p className="text-white">{user.name}</p>
                <p className="text-purple-300">Administrator</p>
              </div>
            </>
          )}
          {sidebarMinimized && (
            <div className="flex justify-center">
              <div className="bg-gradient-to-r from-purple-600 to-cyan-500 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-purple-300 hover:bg-slate-700'
            }`}
            title={sidebarMinimized ? 'Analytics' : ''}
          >
            <BarChart3 className="w-5 h-5" />
            {!sidebarMinimized && 'Analytics'}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-purple-300 hover:bg-slate-700'
            }`}
            title={sidebarMinimized ? 'Chat Logs' : ''}
          >
            <MessageSquare className="w-5 h-5" />
            {!sidebarMinimized && 'Chat Logs'}
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'documents'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-purple-300 hover:bg-slate-700'
            }`}
            title={sidebarMinimized ? 'Dokumen RAG' : ''}
          >
            <FileText className="w-5 h-5" />
            {!sidebarMinimized && 'Dokumen RAG'}
          </button>

          <button
            onClick={() => setActiveTab('training')}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'training'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-purple-300 hover:bg-slate-700'
            }`}
            title={sidebarMinimized ? 'Training AI' : ''}
          >
            <BookOpen className="w-5 h-5" />
            {!sidebarMinimized && 'Training AI'}
          </button>

          <button
            onClick={() => setActiveTab('unanswered')}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'unanswered'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/30'
                : 'text-purple-300 hover:bg-slate-700'
            }`}
            title={sidebarMinimized ? 'Pertanyaan Belum Terjawab' : ''}
          >
            <HelpCircle className="w-5 h-5" />
            {!sidebarMinimized && 'Pertanyaan Belum Terjawab'}
          </button>
        </nav>

        <div className="p-4 border-t border-purple-500/20 space-y-2">
          <button
            onClick={() => setSidebarMinimized(!sidebarMinimized)}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 text-cyan-300 hover:bg-slate-700 rounded-lg transition-colors`}
            title={sidebarMinimized ? 'Expand Sidebar' : 'Minimize Sidebar'}
          >
            {sidebarMinimized ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarMinimized && 'Minimize'}
          </button>
          
          <button
            onClick={onLogout}
            className={`w-full flex items-center ${sidebarMinimized ? 'justify-center' : 'gap-3'} px-4 py-3 text-purple-300 hover:bg-slate-700 rounded-lg transition-colors`}
            title={sidebarMinimized ? 'Keluar' : ''}
          >
            <LogOut className="w-5 h-5" />
            {!sidebarMinimized && 'Keluar'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {activeTab === 'analytics' && (
            <div>
              <h1 className="text-white mb-6">Analytics & Statistik</h1>
              
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-600/20 p-3 rounded-lg border border-blue-500/30">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-purple-300 mb-1">Total Pegawai Aktif</p>
                  <p className="text-white">{getUniqueUsers()}</p>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-600/20 p-3 rounded-lg border border-green-500/30">
                      <MessageSquare className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <p className="text-purple-300 mb-1">Total Pertanyaan</p>
                  <p className="text-white">{getTotalQuestions()}</p>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-600/20 p-3 rounded-lg border border-purple-500/30">
                      <BarChart3 className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                  <p className="text-purple-300 mb-1">Rata-rata per Pegawai</p>
                  <p className="text-white">{getAverageQuestionsPerUser()}</p>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20">
                <h2 className="text-white mb-4">Aktivitas Terbaru</h2>
                {chatLogs.length === 0 ? (
                  <p className="text-purple-300 text-center py-8">
                    Belum ada aktivitas chat
                  </p>
                ) : (
                  <div className="space-y-3">
                    {chatLogs.filter(log => log).slice(-10).reverse().map((log) => (
                      <div key={log.id} className="border-l-4 border-cyan-500 pl-4 py-2 bg-slate-700/50 rounded-r">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white">{log.userName}</p>
                            <p className="text-purple-300">{log.message}</p>
                          </div>
                          <p className="text-purple-400">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <ChatLogsTab accessToken={user.accessToken} />
          )}

          {activeTab === 'documents' && (
            <div>
              <h1 className="text-white mb-6">Dokumen RAG</h1>
              
              <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20 mb-6">
                <h2 className="text-white mb-4">Upload Dokumen</h2>
                <p className="text-purple-300 mb-4">
                  Upload dokumen SOP, panduan, atau file lainnya untuk meningkatkan pengetahuan chatbot (RAG).
                </p>
                <button
                  onClick={() => setShowDocumentModal(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-900/50 to-cyan-900/50 border-2 border-dashed border-purple-500 rounded-lg hover:from-purple-900/70 hover:to-cyan-900/70 transition-all"
                >
                  <Plus className="w-6 h-6 text-cyan-400" />
                  <span className="text-purple-200">Tambah Dokumen Baru</span>
                </button>
              </div>

              <DocumentUploadModal
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                onSuccess={(doc) => setDocuments([...documents, doc])}
                accessToken={user.accessToken}
              />

              <div className="bg-slate-800 rounded-xl border border-purple-500/20 overflow-hidden">
                <div className="p-6 border-b border-purple-500/20">
                  <h2 className="text-white">Dokumen Tersimpan</h2>
                  <p className="text-purple-300">
                    Total: {documents.length} dokumen
                  </p>
                </div>
                
                {documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-300">Belum ada dokumen yang diupload</p>
                  </div>
                ) : (
                  <div className="divide-y divide-purple-500/20">
                    {documents.filter(doc => doc).map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 flex items-center justify-between hover:bg-slate-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
                            <FileText className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white">{doc.name}</p>
                            <p className="text-purple-400">
                              {new Date(doc.uploadedAt).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'training' && (
            <div>
              <h1 className="text-white mb-6">Training AI dengan Q&A</h1>
              
              <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/20 mb-6">
                <h2 className="text-white mb-4">Tambah Training Data</h2>
                <p className="text-purple-300 mb-4">
                  Masukkan pasangan pertanyaan dan jawaban untuk melatih chatbot agar memberikan jawaban yang lebih akurat.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="question" className="block text-purple-200 mb-2">
                      Pertanyaan
                    </label>
                    <input
                      id="question"
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Contoh: Bagaimana cara mengajukan cuti?"
                      className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="answer" className="block text-purple-200 mb-2">
                      Jawaban
                    </label>
                    <textarea
                      id="answer"
                      value={newAnswer}
                      onChange={(e) => setNewAnswer(e.target.value)}
                      placeholder="Masukkan jawaban yang detail dan akurat..."
                      rows={4}
                      className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <button
                    onClick={handleAddTraining}
                    disabled={!newQuestion.trim() || !newAnswer.trim()}
                    className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30"
                  >
                    Tambah Training Data
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-purple-500/20 overflow-hidden">
                <div className="p-6 border-b border-purple-500/20">
                  <h2 className="text-white">Training Data Tersimpan</h2>
                  <p className="text-purple-300">
                    Total: {trainingQA.length} pasangan Q&A
                  </p>
                </div>
                
                {trainingQA.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-300">Belum ada training data</p>
                  </div>
                ) : (
                  <div className="divide-y divide-purple-500/20">
                    {trainingQA.filter(qa => qa).map((qa) => (
                      <div key={qa.id} className="p-6 hover:bg-slate-700/50">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-purple-400">
                            {new Date(qa.createdAt).toLocaleDateString('id-ID')}
                          </p>
                          <button
                            onClick={() => handleDeleteTraining(qa.id)}
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="bg-slate-700 rounded-lg p-3 border border-purple-500/20">
                            <p className="text-purple-300 mb-1">Pertanyaan:</p>
                            <p className="text-white">{qa.question}</p>
                          </div>
                          <div className="bg-gradient-to-r from-purple-900/30 to-cyan-900/30 rounded-lg p-3 border border-cyan-500/20">
                            <p className="text-cyan-300 mb-1">Jawaban:</p>
                            <p className="text-white">{qa.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'unanswered' && (
            <UnansweredQuestionsTab accessToken={user.accessToken} />
          )}
        </div>
      </div>
    </div>
  );
}