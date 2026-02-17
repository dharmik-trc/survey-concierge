"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { apiService } from "@/lib/api";

const SUGGESTIONS = [
  "Summarize the main findings",
  "What are the top trends?",
  "Which questions had highest completion?",
  "Identify notable outliers",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AnalyticsChatPanelProps {
  surveyId: string;
  variant?: "compact" | "full";
}

export default function AnalyticsChatPanel({ surveyId, variant = "compact" }: AnalyticsChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{
    provider: string;
    available: boolean;
    error?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiService.getLlmStatus().then(setLlmStatus).catch(() => setLlmStatus(null));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const toSend = (text || input).trim();
    if (!toSend || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: toSend }]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await apiService.analyticsChat(surveyId, toSend, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get response";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const heightClass = variant === "full" ? "min-h-[72vh] max-h-[calc(100vh-280px)]" : "h-[520px]";

  return (
    <div
      className={`flex flex-col ${heightClass} bg-white rounded-xl border border-gray-200 overflow-hidden`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-[15px]">AI Report Analyzer</h3>
            <p className="text-xs text-gray-500">Ask questions about survey data</p>
          </div>
        </div>
        {llmStatus && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              llmStatus.available
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : "bg-amber-50 text-amber-700 border border-amber-200/60"
            }`}
          >
            {llmStatus.available ? "● Ready" : "○ Unavailable"}
          </span>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 bg-white"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.length === 0 && (
          <div className="space-y-5">
            <div className="text-center py-6">
              <p className="text-gray-600 text-sm mb-4">
                Start a conversation about your survey insights
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(s)}
                    className="px-4 py-2.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-200/80 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {!llmStatus?.available && (
              <div className="mx-auto max-w-sm p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl">
                <p className="text-amber-800 text-xs">
                  <span className="font-medium">Ollama required:</span> Run{" "}
                  <code className="bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px]">ollama serve</code> and{" "}
                  <code className="bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px]">ollama pull llama3.2</code>
                </p>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-3 mb-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md shadow-sm"
                  : "bg-white text-gray-800 border border-gray-200/80 shadow-sm rounded-bl-md"
              }`}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em>{children}</em>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="ml-1">{children}</li>,
                  code: ({ className, children }) =>
                    className ? (
                      <pre className="bg-black/10 rounded p-2 overflow-x-auto text-sm my-2 [&>code]:bg-transparent [&>code]:p-0">
                        <code>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-black/10 rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>
                    ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                      {children}
                    </a>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-white border border-gray-200/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 bg-white shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about survey data..."
            rows={1}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-[15px] placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none min-h-[48px] max-h-32"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="shrink-0 w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
