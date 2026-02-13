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
  const [logs, setLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null); // Final time
  const [timer, setTimer] = useState(0); // Running timer
  const reportRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Timer Effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setTimer(0);
      interval = setInterval(() => {
        setTimer((prev) => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll logs
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setResult(null);
    setLogs([]);
    setExecutionTime(null);
    const startTime = performance.now();

    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'log') {
              setLogs(prev => [...prev, data.message]);
            } else if (data.type === 'result') {
              setResult(data.data);
              const endTime = performance.now();
              setExecutionTime((endTime - startTime) / 1000);
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            console.warn("Stream parse error", e);
          }
        }
      }
    } catch (error: any) {
      console.error("Analysis Failed:", error);
      alert(`분석 중 오류가 발생했습니다: ${error.message || "서버 응답 없음"}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    const element = reportRef.current;
    try {
      // Temporarily remove sticky/fixed elements or complex gradients if needed
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff', // Force white background
        logging: false,
        onclone: (document) => {
          // Optional: Modify specific styles for PDF capture in the cloned document
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('MIRI_Legal_Report.pdf');
    } catch (err) {
      console.error("PDF Export Failed:", err);
      alert("PDF 저장 중 오류가 발생했습니다. (Chrome/Edge 브라우저 권장)");
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

        {/* Live Logs Section (Updated Theme) */}
        <AnimatePresence>
          {(loading || (logs.length > 0 && !result)) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-panel bg-slate-50 shadow-inner p-6 rounded-xl border border-slate-200 overflow-hidden"
            >
              <h3 className="text-slate-600 text-sm font-bold mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${loading ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                  분석 진행 상황
                </div>
                {loading && <span className="font-mono text-xs text-slate-500 animate-pulse">진행 시간: {timer.toFixed(1)}s</span>}
              </h3>

              <div className="font-mono text-sm space-y-1.5 h-64 overflow-y-auto text-slate-700 custom-scrollbar p-3 bg-white rounded-lg border border-slate-200">
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2 break-all"
                  >
                    <span className="text-slate-400 select-none shrink-0">›</span>
                    <span>{log}</span>
                  </motion.div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <div className="flex items-center justify-between flex-wrap gap-4">
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

                    <div className="flex items-center gap-3">
                      {executionTime && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600 text-sm font-semibold">
                          <span>⏱️ 처리 시간:</span>
                          <span className="text-blue-600">{executionTime.toFixed(2)}초</span>
                        </div>
                      )}

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
                  </div>

                  <p className="text-xl leading-relaxed text-slate-700 font-medium whitespace-pre-wrap">
                    {result.verdict.summary || "검토 결과에 대한 상세 내용이 생성되지 않았습니다."}
                  </p>

                  {result.verdict.citation && (
                    <div className="mt-6 p-5 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> 판단 근거 (법령)
                      </h4>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                        {result.verdict.citation}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">주요 법적 쟁점</h3>
                    <ul className="space-y-2">
                      {result.verdict.key_issues && result.verdict.key_issues.length > 0 ? (
                        result.verdict.key_issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-slate-700 font-medium">
                            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <span>{issue}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-400 italic">식별된 주요 쟁점이 없습니다.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Evidence List (No Cards) */}
              <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/60 bg-slate-50/50">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <Search className="w-5 h-5 text-blue-600" />
                    상세 분석 보고서
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {result.evidence.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-6 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border
                            ${item.status === 'Prohibited' ? 'bg-red-50 text-red-700 border-red-100' :
                            item.status === 'Permitted' ? 'bg-green-50 text-green-700 border-green-100' :
                              'bg-slate-50 text-slate-600 border-slate-200'}
                          `}>
                          {getStatusKorean(item.status)}
                        </span>
                        <h4 className="font-bold text-lg text-slate-800">
                          {item.law_name} <span className="text-slate-500 font-medium text-base ml-1">{item.key_clause}</span>
                        </h4>
                      </div>

                      <p className="text-slate-700 leading-relaxed mb-3">
                        {item.summary}
                      </p>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline decoration-blue-200 underline-offset-4"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          법령 원문 확인하기
                        </a>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* References List */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  참고 문헌
                </h3>
                <ul className="space-y-2 list-disc list-inside text-sm text-slate-700 mt-2">
                  {result.references.map((ref, idx) => (
                    <li key={idx} className="break-all">
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                      >
                        {ref.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
