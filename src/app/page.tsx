'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, AlertTriangle, Download, ExternalLink, Scale, BookOpen, Info, CheckSquare, Square, GitBranch, ArrowRight, Clock, ShieldAlert, Bot, User } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { AnalysisResult } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isSystem?: boolean;
}

export default function Home() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  // Persistent Chat & Session State
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substr(2, 9)}`);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // What-If toggles
  const [selectedWhatIfs, setSelectedWhatIfs] = useState<string[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timer Effect
  useEffect(() => {
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
  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (logs.length < 3 || isNearBottom) {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [logs]);

  // Auto-scroll chat window
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const runAnalysis = async (currentIdea: string, whatIfs: string[]) => {
    setLoading(true);
    // DO NOT CLEAR RESULT. We only clear logs to show new thinking process.
    setLogs([]);
    setExecutionTime(null);
    const startTime = performance.now();

    // Add User Message to Chat History
    const userMsgId = Date.now().toString();
    if (currentIdea.trim()) {
      setChatHistory(prev => [...prev, { id: userMsgId, role: 'user', content: currentIdea }]);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: currentIdea, what_ifs: whatIfs, thread_id: sessionId }),
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
            } else if (data.type === 'chat_message') {
              // Add Assistant Chat Message
              setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.message }]);
            } else if (data.type === 'result') {
              // Update Roadmap Result
              setResult(data.data);
              const endTime = performance.now();
              setExecutionTime((endTime - startTime) / 1000);

              setChatHistory(prev => [...prev, {
                id: Date.now().toString() + "_sys",
                role: 'assistant',
                content: "분석이 완료되어 뒷편의 메인 로드맵이 갱신되었습니다.",
                isSystem: true
              }]);

              // Scroll to result slightly later
              setTimeout(() => {
                reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 500);
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
      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `🚨 오류 발생: ${error.message || "서버 응답 없음"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;
    const submittedIdea = idea;
    setIdea(''); // Clear input box immediately
    // Note: We deliberately don't clear selectedWhatIfs so constraints stack
    runAnalysis(submittedIdea, selectedWhatIfs);
  };

  const handleWhatIfToggle = (variableName: string) => {
    const isCurrentlySelected = selectedWhatIfs.includes(variableName);
    const newWhatIfs = isCurrentlySelected
      ? selectedWhatIfs.filter(w => w !== variableName)
      : [...selectedWhatIfs, variableName];

    setSelectedWhatIfs(newWhatIfs);
    runAnalysis(idea, newWhatIfs);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: '#ffffff',
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

      pdf.save('MIRI_Roadmap_Report.pdf');
    } catch (err) {
      console.error("PDF Export Failed:", err);
      alert("PDF 저장 중 오류가 발생했습니다.");
    }
  };

  const getRiskColor = (score: string) => {
    if (score === 'Red') return 'bg-red-50 text-red-700 border-red-200';
    if (score === 'Yellow') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (score === 'Green') return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getRiskText = (score: string) => {
    if (score === 'Red') return '위험 (Red)';
    if (score === 'Yellow') return '조건부/주의 (Yellow)';
    if (score === 'Green') return '안전 (Green)';
    return score;
  };

  // Helper to render inline citations like [1], [2] as clickable jump links
  const renderTextWithCitations = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[\d+\])/g);

    const scrollToRef = (refId: string) => {
      const el = document.getElementById(refId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-yellow-100');
        setTimeout(() => el.classList.remove('bg-yellow-100'), 2000);
      }
    };

    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const refIndex = match[1];
        return (
          <button
            key={index}
            onClick={() => scrollToRef(`reference-${refIndex}`)}
            className="text-[10px] font-bold text-blue-600 ml-0.5 mr-0.5 select-none hover:underline cursor-pointer bg-blue-50 px-1 rounded-sm align-super leading-none"
            title={`${refIndex}번 법적 근거 확인`}
            data-html2canvas-ignore
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="h-screen font-sans bg-[#fdfdfd] flex overflow-hidden">
      {/* 
        ========================================
        LEFT PANEL: CHAT & HEADER 
        ========================================
      */}
      <aside className="w-full md:w-[400px] lg:w-[450px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-[2px_0_20px_rgba(0,0,0,0.02)] z-10 relative h-full">

        {/* Header */}
        <header className="p-5 md:p-6 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              MIRI AI 법률 자문
            </h1>
          </div>
          <p className="text-slate-500 text-xs md:text-sm ml-1 leading-relaxed">
            사업 아이디어를 입력하면 법률 진단 및 로드맵을 그려줍니다.
          </p>
        </header>

        {/* Chat History Area (Scrollable flex-1) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 pb-4">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 space-y-3">
              <Bot className="w-12 h-12 text-slate-200 mb-2" />
              <p className="text-sm font-medium">채팅을 시작해 보세요!</p>
              <p className="text-xs">오른쪽 메인 화면에 진행 상황과 전체 로드맵이 그려집니다.</p>
            </div>
          ) : (
            <AnimatePresence>
              {chatHistory.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white shadow-sm flex items-center justify-center mr-2 shrink-0 mt-auto mb-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-4 py-3 shadow-md backdrop-blur-md ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                      : 'bg-white/95 border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.role === 'assistant' ? renderTextWithCitations(msg.content) : msg.content}
                    </p>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center ml-2 shrink-0 mt-auto mb-1">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </AnimatePresence>
          )}
        </div>

        {/* Input Area (Bottom of Left Panel) */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
            <div className="overflow-hidden bg-slate-50 border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 rounded-xl shadow-inner transition-all duration-200 p-2">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!loading && idea.trim()) {
                      handleSubmit(e);
                    }
                  }
                }}
                placeholder={
                  chatHistory.length === 0
                    ? "어떤 사업을 구상 중이신가요?\n(예: 강아지 간식 제조 공장 창업)"
                    : "추가로 궁금한 점이나 조건을 입력하세요."
                }
                className="w-full max-h-32 min-h-[60px] p-2 text-sm leading-relaxed resize-none outline-none custom-scrollbar bg-transparent"
                rows={idea.split('\n').length > 1 ? Math.min(idea.split('\n').length, 4) : 1}
              />
              <div className="flex justify-between items-center mt-1 px-1">
                <span className="text-[10px] text-slate-400 font-medium">Shift + Enter 로 줄바꿈</span>
                <button
                  type="submit"
                  disabled={loading || !idea.trim()}
                  className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm shrink-0 h-9 w-9"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {chatHistory.length === 0 && (
              <p className="text-[9px] text-slate-400 mt-1 max-w-full text-center leading-tight">
                [면책 조항] 본 결과는 법적 효력이 무효하므로 실제 진행시 변호사의 자문을 구하십시오. © MIRI
              </p>
            )}
          </form>
        </div>
      </aside>

      {/* 
        ========================================
        RIGHT PANEL: ROADMAP & RESULTS 
        ========================================
      */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 relative">
        <div className="max-w-4xl mx-auto p-4 md:p-8 lg:p-12 space-y-8 pb-32">

          {/* Welcome Placeholder / Logs */}
          {!result && chatHistory.length === 0 && !loading && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40 select-none">
              <Scale className="w-24 h-24 mb-6 text-slate-300" />
              <h2 className="text-3xl font-bold text-slate-400 mb-2">당신의 비즈니스를 위한 견고한 토대</h2>
              <p className="text-slate-500">좌측 채팅창에 텍스트를 입력하여 로드맵 분석을 시작하세요.</p>
            </div>
          )}

          {/* Live Logs Section */}
          <AnimatePresence>
            {(loading || (logs.length > 0 && !result)) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mt-4"
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    AGENT WORKFLOW LOG
                  </span>
                  {loading && <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{timer.toFixed(1)}s 경과</span>}
                </div>
                <div
                  ref={logsContainerRef}
                  className="h-32 md:h-48 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-2 text-slate-600"
                >
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2 items-start hover:bg-slate-50 p-1 rounded transition-colors">
                      <span className="text-slate-300 select-none mt-0.5">›</span>
                      <span className="leading-relaxed">{log}</span>
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
                className="space-y-8"
                ref={reportRef}
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-4 gap-4 bg-white/50 p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">결과: 규제 통과 로드맵</h2>
                    <p className="text-slate-500 text-sm mt-2 flex items-center gap-1">
                      <Info className="w-4 h-4" /> 생성된 문서는 우측상단 PDF로 다운로드 가능합니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <span className={`px-3 py-1.5 rounded-md text-sm font-bold border ${getRiskColor(result?.risk_evaluation?.score || '')}`}>
                      {getRiskText(result?.risk_evaluation?.score || '분석 중')}
                    </span>
                    <button onClick={handleDownloadPDF} data-html2canvas-ignore className="btn-secondary text-sm px-4 py-1.5 h-auto flex items-center gap-2">
                      <Download className="w-4 h-4" /> PDF 추출
                    </button>
                  </div>
                </div>

                {/* [NEW] What-If Interactive Toggles */}
                {result.what_ifs && result.what_ifs.length > 0 && (
                  <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm" data-html2canvas-ignore>
                    <div className="flex items-center gap-2 mb-4">
                      <GitBranch className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-slate-800">What-If 시나리오 탐색기</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-5 pl-7 border-l-2 border-blue-200">
                      현재 사업 모델에서 잠재적으로 발생할 수 있는 추가 변수들입니다.
                      해당되는 항목을 체크하면 좌측 채팅 에이전트가 반영하여 로드맵을 지능적으로 업데이트합니다.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-7">
                      {result.what_ifs.map((trigger, idx) => {
                        const isActive = selectedWhatIfs.includes(trigger.variable_name);
                        return (
                          <div
                            key={idx}
                            onClick={() => handleWhatIfToggle(trigger.variable_name)}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isActive ? 'bg-blue-600 border-blue-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-sm'
                              }`}
                          >
                            <div className="mt-0.5">
                              {isActive ? <CheckSquare className="w-5 h-5 opacity-90" /> : <Square className="w-5 h-5 opacity-40 text-slate-400" />}
                            </div>
                            <div>
                              <div className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-900'}`}>{trigger.variable_name}</div>
                              <div className={`text-xs mt-1.5 leading-relaxed ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{trigger.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 1. Risk Evaluation Summary */}
                {result.risk_evaluation && (
                  <section className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 pl-2 border-l-4 border-slate-800">
                      리스크 상세 요약
                    </h3>
                    <div className="paper-panel p-6 bg-white shadow-sm rounded-2xl border border-slate-100">
                      <p className="text-[15px] border-l-4 border-slate-200 pl-5 py-2 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap bg-slate-50/50 rounded-r-lg">
                        {renderTextWithCitations(result.risk_evaluation.rationale)}
                      </p>

                      {result.risk_evaluation.key_hurdles && result.risk_evaluation.key_hurdles.length > 0 && (
                        <div className="mt-8 space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-orange-500" />
                            극복해야 할 주요 허들
                          </h4>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {result.risk_evaluation.key_hurdles.map((hurdle, idx) => (
                              <li key={idx} className="flex items-start gap-3 bg-orange-50/50 border border-orange-100/50 p-4 rounded-xl text-sm text-slate-700 shadow-sm">
                                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                <span className="flex-1 leading-relaxed font-medium text-slate-800">{hurdle}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 2. Decision Tree Roadmap */}
                {result.roadmap && result.roadmap.length > 0 && (
                  <section className="space-y-6 pt-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 pl-2 border-l-4 border-blue-600">
                      실행 로드맵 (Decision Tree)
                    </h3>
                    <div className="space-y-6 relative pl-4 md:pl-8">
                      {/* Vertical Connecting Line */}
                      <div className="absolute left-[30px] md:left-[50px] top-8 bottom-8 w-1 bg-slate-100 z-0 rounded-full"></div>

                      {result.roadmap.map((step, idx) => (
                        <div key={idx} className="relative z-10 flex flex-col md:flex-row gap-6">
                          {/* Step Marker */}
                          <div className="flex flex-col items-center pt-1 shrink-0">
                            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md border-4 border-slate-50">
                              {step.phase}
                            </div>
                          </div>

                          {/* Step Content */}
                          <div className="flex-1 bg-white p-6 shadow-md rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors">
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-4">
                              <h4 className="font-bold text-xl text-slate-900 tracking-tight">
                                {step.title}
                              </h4>
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg w-fit shrink-0">
                                <Clock className="w-3.5 h-3.5" /> 소요 예상: {step.estimated_time}
                              </span>
                            </div>

                            <p className="text-[15px] text-slate-600 mb-6 leading-relaxed">
                              {renderTextWithCitations(step.description)}
                            </p>

                            {/* Action Items List */}
                            {step.action_items && step.action_items.length > 0 && (
                              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                      <th className="px-5 py-3 w-1/4 min-w-[120px]">주관 부처</th>
                                      <th className="px-5 py-3 border-l border-slate-200">핵심 절차 및 인허가 요건</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {step.action_items.map((action, aIdx) => (
                                      <tr key={aIdx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-5 py-4 font-bold text-slate-700 align-top">
                                          <span className="bg-slate-100 px-2.5 py-1 rounded text-xs">{action.submission_agency}</span>
                                        </td>
                                        <td className="px-5 py-4 align-top border-l border-slate-100">
                                          <div className="font-bold text-slate-900 mb-2 text-base group-hover:text-blue-700 transition-colors">{action.step_name}</div>

                                          {action.required_documents.length > 0 && (
                                            <div className="mb-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">필요 제출 서류 목록</div>
                                              <ul className="list-disc list-inside text-slate-700 text-xs leading-relaxed space-y-1">
                                                {action.required_documents.map((doc, dIdx) => (
                                                  <li key={dIdx} className="marker:text-blue-500">{doc}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          <div className="text-xs text-slate-600 bg-blue-50/50 p-3 border border-blue-100/50 rounded-lg leading-relaxed flex items-start gap-2">
                                            <span className="text-base leading-none">💡</span>
                                            <div>{renderTextWithCitations(action.context)}</div>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Cross-Domain Mapping */}
                {result.cross_domains && result.cross_domains.length > 0 && (
                  <section className="space-y-6 pt-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 pl-2 border-l-4 border-indigo-600">
                      도메인 교차 분석 (Cross-Domain Insights)
                    </h3>
                    <div className="grid grid-cols-1 gap-5">
                      {result.cross_domains.map((cd, idx) => (
                        <div key={idx} className="bg-white p-6 shadow-sm rounded-2xl border border-slate-200">
                          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6 relative">
                            <div className="flex-1 w-full text-center lg:text-left bg-slate-50 px-5 py-4 rounded-xl border border-slate-200">
                              <span className="text-xs font-bold text-slate-400 block mb-1">현행 규제 모델 (AS-IS)</span>
                              <span className="font-bold text-slate-800 text-lg">{cd.source_domain}</span>
                            </div>

                            <div className="bg-white p-2 rounded-full border border-slate-100 shadow-sm z-10 my-2 lg:my-0">
                              <ArrowRight className="w-5 h-5 text-indigo-400 rotate-90 lg:rotate-0" />
                            </div>

                            <div className="flex-1 w-full text-center lg:text-left bg-indigo-50 px-5 py-4 rounded-xl border border-indigo-100 shadow-inner">
                              <span className="text-xs font-bold text-indigo-400 block mb-1">목표 신사업 모델 (TO-BE)</span>
                              <span className="font-bold text-indigo-900 text-lg">{cd.target_domain}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm mt-4 lg:px-2">
                            <div className="bg-slate-50 p-4 rounded-xl">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                주관 부처 변경
                              </span>
                              <p className="text-slate-800 font-medium">{cd.agency_mapping}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl">
                              <span className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                적용 법령 변경
                              </span>
                              <p className="text-slate-800 font-medium">{cd.law_mapping}</p>
                            </div>
                            <div className="md:col-span-2 bg-gradient-to-r from-indigo-50/50 to-white border border-indigo-100/50 p-5 rounded-xl mt-2 shadow-sm">
                              <span className="block text-xs font-bold text-indigo-600 mb-2 tracking-wide">핵심 규제 차이점 집중 포인트</span>
                              <p className="text-slate-700 leading-relaxed font-medium">{cd.key_differences}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* References */}
                {result.references && result.references.length > 0 && (
                  <section className="pt-10 pb-6 border-t-2 border-dashed border-slate-200">
                    <h5 className="font-bold mb-5 flex items-center gap-2 text-slate-800 text-lg">
                      <BookOpen className="w-5 h-5 text-blue-600" /> 공식 법령 및 참고 판례 증빙
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.references.map((ref, idx) => (
                        <div
                          key={idx}
                          id={`reference-${idx + 1}`}
                          className="bg-white hover:bg-slate-50 p-4 rounded-xl border border-slate-200 transition-colors shadow-sm group"
                        >
                          <div className="font-bold text-slate-800 mb-2 flex items-start gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs shrink-0 mt-0.5">[{idx + 1}]</span>
                            <span className="title leading-snug group-hover:text-blue-700 transition-colors">{ref.title}</span>
                          </div>
                          {ref.url && (
                            <div className="pl-9 pb-1">
                              <a
                                href={ref.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 hover:border-blue-300 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                국가법령정보센터 원문 보기 <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

    </div>
  );
}
