'use client';

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, FileText, AlertTriangle, CheckCircle, XCircle, Download, ExternalLink, ChevronRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AnalysisResult, DocumentReview } from '../types';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Backend URL (FastAPI)
      const response = await axios.post('http://localhost:8000/analyze', { idea });
      setResult(response.data);
    } catch (error) {
      console.error("Analysis Failed:", error);
      alert("분석 중 오류가 발생했습니다. 서버 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    const element = reportRef.current;
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        backgroundColor: '#0f172a', // Dark theme background
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('MIRI_Legal_Report.pdf');
    } catch (err) {
      console.error("PDF Export Failed:", err);
      alert("PDF 저장 중 오류가 발생했습니다.");
    }
  };

  const getVerdictKorean = (verdict: string) => {
    switch (verdict) {
      case 'Safe': return '안전';
      case 'Danger': return '위험';
      case 'Caution': return '주의';
      case 'Review Required': return '검토 필요';
      default: return verdict;
    }
  };

  const getStatusKorean = (status: string) => {
    switch (status) {
      case 'Prohibited': return '금지';
      case 'Permitted': return '허용';
      case 'Conditional': return '조건부';
      case 'Neutral': return '중립';
      case 'Ambiguous': return '모호함';
      default: return status;
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 font-sans bg-gradient-to-br from-slate-50 to-blue-50/50">
      <div className="max-w-4xl mx-auto space-y-12">

        {/* Header */}
        <header className="text-center space-y-4 pt-10">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight"
          >
            MIRI 법률 AI
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-lg md:text-xl font-medium"
          >
            규제 샌드박스를 위한 인공지능 법률 검토 시스템
          </motion.p>
        </header>

        {/* Input Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel rounded-2xl p-1"
        >
          <form onSubmit={handleSubmit} className="relative group">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="사업 아이디어를 자유롭게 서술하세요... (예: 거주자 우선 주차장 공유 플랫폼)"
              className="w-full h-40 bg-white/50 text-lg p-6 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder-slate-400 text-slate-800"
            />
            <div className="absolute bottom-4 right-4">
              <button
                type="submit"
                disabled={loading || !idea.trim()}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/10
                  ${loading ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95'}
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    검토 시작
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
              ref={reportRef} // For PDF Export
            >

              {/* Verdict Card */}
              <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-blue-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FileText className="w-48 h-48" />
                </div>

                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold flex items-center gap-3 text-slate-800">
                      <span className="bg-blue-50 text-blue-600 p-2 rounded-lg">⚖️ 검토 결과</span>
                      <span className={`px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider
                        ${result.verdict.verdict === 'Safe' ? 'bg-green-100 text-green-700' :
                          result.verdict.verdict === 'Danger' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'}
                      `}>
                        {getVerdictKorean(result.verdict.verdict)}
                      </span>
                    </h2>

                    {/* PDF Button (Visible on screen, hidden in PDF if logic adjusted, but usually user wants it hidden) */}
                    <button
                      onClick={handleDownloadPDF}
                      data-html2canvas-ignore // Ignore this button in PDF
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors bg-white/50 px-4 py-2 rounded-lg hover:bg-white"
                    >
                      <Download className="w-4 h-4" />
                      PDF 저장
                    </button>
                  </div>

                  <p className="text-xl leading-relaxed text-slate-700 font-medium whitespace-pre-wrap">
                    {result.verdict.summary}
                  </p>

                  <div className="space-y-3 pt-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">주요 법적 쟁점</h3>
                    <ul className="space-y-2">
                      {result.verdict.key_issues.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-slate-600">
                          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Evidence Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.evidence.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`glass-panel p-6 rounded-xl border-l-[3px] 
                      ${item.status === 'Prohibited' ? 'border-l-red-500 bg-red-50' :
                        item.status === 'Permitted' ? 'border-l-green-500 bg-green-50' :
                          'border-l-slate-400 bg-slate-50'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-lg text-slate-800 line-clamp-1" title={item.law_name}>
                        {item.law_name}
                      </h4>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ml-2 shrink-0
                          ${item.status === 'Prohibited' ? 'bg-red-100 text-red-700' :
                          item.status === 'Permitted' ? 'bg-green-100 text-green-700' :
                            'bg-slate-200 text-slate-600'}
                        `}>
                        {getStatusKorean(item.status)}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="flex gap-2">
                        <span className="font-semibold text-slate-500 min-w-[3rem]">조항:</span>
                        <span className="text-slate-800">{item.key_clause || "관련 조항 없음"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold text-slate-500 min-w-[3rem]">요약:</span>
                        <span className="leading-relaxed text-slate-700">{item.summary}</span>
                      </div>
                    </div>

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 transition-colors font-semibold"
                      >
                        원문 보기 <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* References List */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  참고 문헌
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.references.map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-white/50 hover:bg-white hover:shadow-md transition-all group border border-slate-200/50"
                    >
                      <span className="text-sm text-slate-700 truncate w-11/12">{ref.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
