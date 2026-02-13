'use client';

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, FileText, AlertTriangle, CheckCircle, XCircle, Download, ExternalLink, ChevronRight, Scale, BookOpen, User, Info } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { AnalysisResult, DocumentReview } from '../types';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/analyze`, {
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

    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff', // Clean white background for PDF
        filter: (node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(dataUrl);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('MIRI_Review_Report.pdf');

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
    <main className="min-h-screen p-4 md:p-8 font-sans bg-[#fdfdfd] pb-20">
      <div className="max-w-3xl mx-auto space-y-8 md:space-y-10">

        {/* Header - Mobile Friendly */}
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              MIRI Legal Review
            </h1>
          </div>
          <p className="text-slate-500 text-sm md:text-base ml-1 leading-relaxed">
            규제 샌드박스 신청 가능성 및 법령 위반 여부를 검토하는 자동화 시스템입니다.
          </p>
        </header>

        {/* Input Section - Responsive */}
        <section>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">사업 아이디어 / 시나리오 상세</label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="검토하고 싶은 구체적인 사업 내용이나 시나리오를 입력해주세요.&#13;&#10;(예: 주택가 빈 주차면 공유 서비스의 합법성 검토)"
                className="modern-input w-full h-40 md:h-48 p-4 md:p-5 text-sm md:text-[16px] leading-relaxed resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !idea.trim()}
                className="btn-primary w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    검토 진행 중...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    검토 요청
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Live Logs Section */}
        <AnimatePresence>
          {(loading || (logs.length > 0 && !result)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 bg-slate-50 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processing Log</span>
                {loading && <span className="text-xs font-mono text-slate-400">{timer.toFixed(1)}s</span>}
              </div>
              <div className="h-32 md:h-40 overflow-y-auto custom-scrollbar font-mono text-xs space-y-2 text-slate-600">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-300 select-none">›</span>
                    <span>{log}</span>
                  </div>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 pt-6"
              ref={reportRef}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-4 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">검토 결과 보고서</h2>
                  <p className="text-slate-500 text-sm mt-1">Generated by MIRI System</p>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  {/* Visual Only Tag */}
                  <span className={`px-3 py-1 rounded-md text-sm font-bold border
                        ${result.verdict.verdict === 'Safe' ? 'bg-green-50 text-green-700 border-green-200' :
                      result.verdict.verdict === 'Danger' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'}
                      `}>
                    {getVerdictKorean(result.verdict.verdict)}
                  </span>
                  <button
                    onClick={handleDownloadPDF}
                    data-html2canvas-ignore
                    className="btn-secondary text-xs px-3 py-1 h-8"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>

              {/* 1. Summary */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  종합 요약
                </h3>
                <div className="paper-panel p-5 md:p-6 bg-slate-50/50">
                  <p className="text-slate-800 leading-7 font-medium whitespace-pre-wrap text-sm md:text-base">
                    {result.verdict.summary}
                  </p>

                  {result.verdict.key_issues && result.verdict.key_issues.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-bold text-slate-500 uppercase">주요 법적 쟁점</h4>
                      <ul className="space-y-2">
                        {result.verdict.key_issues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <span className="flex-1">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Scenario Analysis */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-t border-slate-100 pt-6">
                  분석된 시나리오 구조
                </h3>
                <div className="paper-panel p-5 md:p-6">
                  <h4 className="font-bold text-slate-800 mb-4">{result.scenario.name}</h4>
                  <ul className="space-y-0 divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                    {result.scenario.actions.map((action: any, idx: number) => (
                      <li key={idx} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-4 bg-white text-sm">
                        <div className="flex items-center gap-2 md:w-auto">
                          <span className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full text-xs font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="font-semibold text-slate-900 md:hidden">{action.actor}</div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-2 ml-8 md:ml-0">
                          <div className="font-semibold text-slate-900 hidden md:block">{action.actor}</div>
                          <div className="text-slate-600 md:col-span-2">{action.action}</div>
                        </div>
                        {action.object && (
                          <span className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100 self-start ml-8 md:ml-0 md:self-auto">
                            {action.object}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* 3. Detailed Legal Evidence */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-t border-slate-100 pt-6">
                  관련 법령 상세 검토
                </h3>

                <div className="space-y-4">
                  {Object.entries(result.evidence.reduce((acc, item) => {
                    const key = item.law_name || '기타 자료';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, DocumentReview[]>)).map(([lawName, items], groupIdx) => (
                    <div key={groupIdx} className="paper-panel p-5 md:p-6">
                      <h4 className="font-bold text-base text-slate-900 mb-4 pb-2 border-b border-slate-100">
                        {lawName}
                      </h4>
                      <div className="space-y-6">
                        {items.map((item, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0
                                    ${item.status === 'Prohibited' ? 'bg-red-500' :
                                  item.status === 'Permitted' ? 'bg-green-500' :
                                    item.status === 'Conditional' ? 'bg-yellow-500' : 'bg-slate-300'}
                                `} />
                              <span className="font-semibold text-slate-800 text-sm">
                                {item.key_clause}
                              </span>
                              <span className="text-xs text-slate-400">
                                ({item.status})
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed pl-4 border-l-2 border-slate-100 ml-1">
                              {item.summary}
                            </p>
                            {item.url && (
                              <div className="pl-4 ml-1">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-600 hover:underline flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" /> 원문 보기
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* References */}
              {result.references.length > 0 && (
                <section className="pt-8 text-xs text-slate-400 border-t border-slate-200">
                  <h5 className="font-bold mb-2 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> 참고 문헌
                  </h5>
                  <ul className="space-y-1 list-disc list-inside">
                    {result.references.map((ref, idx) => (
                      <li key={idx}>
                        {ref.title}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* Safety Disclaimer Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-200 text-center space-y-2">
          <div className="flex justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500 font-medium">
            [면책 조항] 본 서비스는 베타 테스트 버전이며, 인공지능이 생성한 분석 결과는 법적 효력이 없습니다.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl mx-auto">
            제공되는 정보는 참고용으로만 활용되어야 하며, 실제 사업 진행 시에는 반드시 변호사 등 법률 전문가의 자문을 구하셔야 합니다.
            서비스 이용에 따른 최종적인 의사결정과 법적 책임은 사용자 본인에게 있습니다.
          </p>
          <p className="text-[10px] text-slate-300 pt-4">
            © 2026 MIRI System. All rights reserved.
          </p>
        </footer>

      </div>
    </main>
  );
}
