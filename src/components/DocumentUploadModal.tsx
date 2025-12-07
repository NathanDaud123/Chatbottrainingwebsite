import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, Loader } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

// Declare PDF.js types
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (doc: any) => void;
  accessToken: string;
}

export function DocumentUploadModal({ isOpen, onClose, onSuccess, accessToken }: DocumentUploadModalProps) {
  const [documentName, setDocumentName] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'manual'>('file');
  const [pdfLoaded, setPdfLoaded] = useState(false);

  useEffect(() => {
    // Load PDF.js from CDN
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          setPdfLoaded(true);
        }
      };
      document.head.appendChild(script);
    } else {
      setPdfLoaded(true);
    }
  }, []);

  if (!isOpen) return null;

  const extractPDFText = async (file: File): Promise<string> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  };

  const extractTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    try {
      let content = '';
      
      if (file.type === 'application/pdf') {
        content = await extractPDFText(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        content = await extractTextFile(file);
      } else {
        alert('Format file tidak didukung. Gunakan PDF atau TXT.');
        setExtracting(false);
        return;
      }

      setDocumentName(file.name);
      setDocumentContent(content);
      alert(`✅ Berhasil extract ${content.length} karakter dari ${file.name}`);
    } catch (error) {
      console.log('Error extracting file:', error);
      alert('❌ Gagal extract file. Coba upload manual atau file lain.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!documentName.trim() || !documentContent.trim()) {
      alert('Nama dokumen dan isi tidak boleh kosong!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/documents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: documentName,
            content: documentContent,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        onSuccess(data.document);
        setDocumentName('');
        setDocumentContent('');
        onClose();
      } else {
        alert('Gagal menyimpan dokumen');
      }
    } catch (error) {
      console.log('Error uploading document:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-purple-500/20 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-purple-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-white">Tambah Dokumen RAG</h2>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white p-2 rounded-lg hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-slate-700 rounded-lg">
            <button
              onClick={() => setUploadMode('file')}
              className={`flex-1 px-4 py-2 rounded-lg transition-all ${
                uploadMode === 'file'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                  : 'text-purple-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                Upload File
              </div>
            </button>
            <button
              onClick={() => setUploadMode('manual')}
              className={`flex-1 px-4 py-2 rounded-lg transition-all ${
                uploadMode === 'manual'
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg'
                  : 'text-purple-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                Input Manual
              </div>
            </button>
          </div>

          {uploadMode === 'file' ? (
            <>
              {/* File Upload Mode */}
              <div className="border-2 border-dashed border-purple-500/50 rounded-lg p-8 text-center bg-slate-700/30">
                {extracting ? (
                  <div className="py-8">
                    <Loader className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
                    <p className="text-purple-200">Mengekstrak isi dokumen...</p>
                    <p className="text-purple-400">Harap tunggu, sedang membaca file</p>
                  </div>
                ) : documentContent ? (
                  <div className="space-y-4">
                    <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                      <p className="text-green-300 mb-2">✅ File berhasil diextract!</p>
                      <p className="text-white">{documentName}</p>
                      <p className="text-purple-300">{documentContent.length} karakter</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-slate-800 rounded-lg p-4 border border-purple-500/30 text-left">
                      <p className="text-purple-400 mb-2">Preview:</p>
                      <p className="text-white whitespace-pre-wrap">
                        {documentContent.substring(0, 500)}...
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDocumentContent('');
                        setDocumentName('');
                      }}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Upload file lain
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <p className="text-white mb-2">Upload Dokumen PDF atau TXT</p>
                    <p className="text-purple-400 mb-4">
                      Isi dokumen akan otomatis diextract
                    </p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".pdf,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <span className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-6 py-3 rounded-lg cursor-pointer hover:from-purple-700 hover:to-cyan-600 inline-block">
                        Pilih File
                      </span>
                    </label>
                    <p className="text-purple-400 mt-4">
                      Format: PDF, TXT
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Manual Input Mode */}
              <div>
                <label htmlFor="docContent" className="block text-purple-200 mb-2">
                  Isi Dokumen
                </label>
                <p className="text-purple-400 mb-2">
                  Copy-paste isi dokumen SOP/panduan di sini.
                </p>
                <textarea
                  id="docContent"
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  placeholder={'Contoh:\n\nNILAI INTI PERUSAHAAN - CINTA\n\nC - Credibility (Kredibilitas)\nKami selalu menjaga kepercayaan dengan...\n\nI - Integrity (Integritas)\nKami berkomitmen untuk...'}
                  rows={12}
                  className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none text-white placeholder-slate-400"
                />
                <p className="text-purple-400 mt-2">
                  {documentContent.length} karakter
                </p>
              </div>
            </>
          )}

          <div>
            <label htmlFor="docName" className="block text-purple-200 mb-2">
              Nama Dokumen {uploadMode === 'file' && documentContent && '(Opsional - Terisi Otomatis)'}
            </label>
            <input
              id="docName"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Contoh: SOP Cuti Pegawai"
              className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || extracting || !documentName.trim() || !documentContent.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30"
            >
              {loading ? 'Menyimpan...' : 'Simpan Dokumen'}
            </button>
            <button
              onClick={onClose}
              disabled={loading || extracting}
              className="px-6 py-3 bg-slate-700 text-purple-300 rounded-lg hover:bg-slate-600 disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}