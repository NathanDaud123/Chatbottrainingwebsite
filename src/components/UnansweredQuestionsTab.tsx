import React, { useState, useEffect } from 'react';
import { HelpCircle, Check, Trash2 } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface UnansweredQuestion {
  id: string;
  question: string;
  userId: string;
  userName: string;
  askedAt: number;
  status: string;
}

interface UnansweredQuestionsTabProps {
  accessToken: string;
}

export function UnansweredQuestionsTab({ accessToken }: UnansweredQuestionsTabProps) {
  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUnansweredQuestions();
  }, []);

  const loadUnansweredQuestions = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/unanswered-questions`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Unanswered questions from server:', data);
        setUnansweredQuestions((data.questions || []).filter((q: UnansweredQuestion | null) => q !== null));
      }
    } catch (error) {
      console.log('Error loading unanswered questions:', error);
    }
  };

  const handleApproveAnswer = async (id: string) => {
    const answer = answers[id];
    if (!answer || !answer.trim()) {
      alert('Silakan masukkan jawaban terlebih dahulu!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/unanswered-questions/${id}/answer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ answer }),
        }
      );

      if (response.ok) {
        // Remove from unanswered list
        setUnansweredQuestions(unansweredQuestions.filter(q => q.id !== id));
        // Clear answer input
        const newAnswers = { ...answers };
        delete newAnswers[id];
        setAnswers(newAnswers);
        alert('✅ Jawaban berhasil disimpan dan AI sudah belajar!');
      } else {
        alert('❌ Gagal menyimpan jawaban');
      }
    } catch (error) {
      console.log('Error approving answer:', error);
      alert('❌ Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectQuestion = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pertanyaan ini?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/unanswered-questions/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        setUnansweredQuestions(unansweredQuestions.filter(q => q.id !== id));
      }
    } catch (error) {
      console.log('Error rejecting question:', error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white mb-2">Pertanyaan Belum Dijawab</h1>
        <p className="text-purple-300">
          Pertanyaan dari pegawai yang AI belum bisa jawab. Jawab pertanyaan ini untuk melatih AI agar lebih pintar.
        </p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-purple-500/20 overflow-hidden">
        {unansweredQuestions.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <p className="text-purple-300">Belum ada pertanyaan yang belum dijawab</p>
            <p className="text-purple-400 mt-2">
              AI sudah bisa menjawab semua pertanyaan pegawai! 🎉
            </p>
          </div>
        ) : (
          <div className="divide-y divide-purple-500/20">
            {unansweredQuestions.map((question) => (
              <div key={question.id} className="p-6 hover:bg-slate-700/50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-orange-600/20 p-1.5 rounded border border-orange-500/30">
                        <HelpCircle className="w-4 h-4 text-orange-400" />
                      </div>
                      <span className="text-orange-300">Butuh Jawaban dari HR</span>
                    </div>
                    <p className="text-purple-300 mb-1">
                      Ditanya oleh: <span className="text-white">{question.userName}</span>
                    </p>
                    <p className="text-purple-400">
                      {new Date(question.askedAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRejectQuestion(question.id)}
                    className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20"
                    title="Hapus pertanyaan"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-700 rounded-lg p-4 border border-purple-500/20">
                    <p className="text-purple-300 mb-2">Pertanyaan:</p>
                    <p className="text-white">{question.question}</p>
                  </div>

                  <div>
                    <label className="block text-purple-200 mb-2">
                      Jawaban Anda (akan digunakan untuk melatih AI):
                    </label>
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      placeholder="Masukkan jawaban yang detail dan akurat untuk pertanyaan ini..."
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-white placeholder-slate-400"
                    />
                  </div>

                  <button
                    onClick={() => handleApproveAnswer(question.id)}
                    disabled={loading || !answers[question.id]?.trim()}
                    className="bg-gradient-to-r from-green-600 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/30 flex items-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Approve & Train AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
