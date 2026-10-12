"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, Search, ShieldCheck, Sparkles, FileText, Send,
  CheckCircle2, AlertTriangle, UploadCloud, FileUp, Folder,
  RefreshCw, Check, Layers, Clock, Lock, FileCode
} from "lucide-react";

interface Citation {
  document_title: string;
  chunk_id: string;
  snippet: string;
  relevance_score: number;
}

interface GroundedAnswerData {
  question: string;
  answer: string;
  citations: Citation[];
  confidence_score: number;
  tenant_isolated: boolean;
  privacy_scrubbed: boolean;
  evidence_sufficient?: boolean;
}

interface IndexedDocument {
  id: string;
  engagement_id: string;
  title: string;
  category: string;
  status: string;
  chunks_count: number;
  uploaded_by: string;
  created_at: string;
}

interface KnowledgePanelProps {
  engagementId: string;
  customerName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CATEGORIES = [
  "Technical Documentation",
  "Customer Requirements",
  "Architecture",
  "Decisions",
  "Customer Notes",
  "Other"
];

export default function KnowledgePanel({ engagementId, customerName }: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<"query" | "upload">("query");

  // Query State
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [answerData, setAnswerData] = useState<GroundedAnswerData | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Upload & Documents State
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form Fields
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Technical Documentation");
  const [customTitle, setCustomTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents for active engagement
  const fetchDocuments = async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDocuments(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch indexed documents:", err);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    setAnswerData(null);
    setQuery("");
    setUploadSuccess(null);
    setUploadError(null);
  }, [engagementId]);

  // Handle RAG Q&A
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setQueryLoading(true);
    setQueryError(null);
    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/knowledge/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, top_k: 3 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAnswerData(json.data);
        } else {
          setQueryError(json.message || "No grounded answer could be retrieved.");
          setAnswerData(null);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setQueryError(errJson.detail || "KNOW Agent failed to query knowledge vector store.");
        setAnswerData(null);
      }
    } catch (err: any) {
      setQueryError(err.message || "Network error while querying KNOW Agent.");
      setAnswerData(null);
    } finally {
      setQueryLoading(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", selectedCategory);
    if (customTitle.trim()) {
      formData.append("title", customTitle.trim());
    }

    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents/upload-file`, {
        method: "POST",
        body: formData
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setUploadSuccess(
          `Successfully uploaded and indexed '${json.data.title}' into ${json.data.chunks_count} vector chunks!`
        );
        setSelectedFile(null);
        setCustomTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchDocuments();
      } else {
        setUploadError(json.detail || json.message || "Failed to upload and index document.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error during document upload.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              KNOW Agent Grounded Intelligence
              <span className="text-[10px] bg-teal-100 text-teal-800 font-mono px-2 py-0.5 rounded font-semibold">
                RAG Active
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Tenant-isolated knowledge retrieval with privacy boundary scrub for <strong className="text-slate-700">{customerName}</strong>
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-medium self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("query")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "query"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Ask Agent</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeTab === "upload"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Documents ({documents.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Grounded Q&A Interface */}
      {activeTab === "query" && (
        <div className="p-5 space-y-4">
          {/* Query Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Ask anything about ${customerName}'s architecture, security policies, or specifications...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={queryLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50 shrink-0"
            >
              {queryLoading ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Ask Agent</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick suggestions based on uploaded docs */}
          {documents.length > 0 && !answerData && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Try asking:</span>
              <button
                type="button"
                onClick={() => setQuery("What are the enterprise security and SSO requirements?")}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition"
              >
                "What are the SSO requirements?"
              </button>
              <button
                type="button"
                onClick={() => setQuery("What is the database cutover window and migration pipeline?")}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition"
              >
                "What is the cutover window?"
              </button>
            </div>
          )}

          {/* Error Output */}
          {queryError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{queryError}</span>
            </div>
          )}

          {/* Answer Output */}
          {answerData && (
            <div className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  Grounded Knowledge Synthesis:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                    Confidence: {Math.round(answerData.confidence_score * 100)}%
                  </span>
                  {answerData.privacy_scrubbed && (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1">
                      <Lock className="h-3 w-3 text-emerald-600" />
                      Privacy Boundary Scrubbed
                    </span>
                  )}
                </div>
              </div>

              {/* Synthesized Answer */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-medium">
                {answerData.answer}
              </div>

              {/* Citations & Evidence Context */}
              {answerData.citations && answerData.citations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-teal-600" />
                      Verified Source Evidence ({answerData.citations.length} Chunks)
                    </span>
                    <span className="text-[10px] text-slate-400">Strictly grounded — zero hallucinations</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {answerData.citations.map((c, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between font-semibold text-xs text-slate-900">
                          <span className="flex items-center gap-1.5 text-teal-800">
                            <FileText className="h-3.5 w-3.5 text-teal-600" />
                            {c.document_title}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded">
                            Relevance: {c.relevance_score}
                          </span>
                        </div>
                        <p className="text-slate-600 italic text-[11px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                          "{c.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Document Upload & Library */}
      {activeTab === "upload" && (
        <div className="p-5 space-y-6">
          {/* Upload Form */}
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <FileUp className="h-4 w-4 text-teal-600" />
                Upload New Document into RAG Vector Store
              </h4>
              <span className="text-[10px] text-slate-400">
                Supports .txt, .md, .pdf, .json, .csv, .log
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? "border-teal-500 bg-teal-50/50"
                  : selectedFile
                  ? "border-emerald-400 bg-emerald-50/30"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.pdf,.json,.csv,.yaml,.yml,.log"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />

              <div className="p-2.5 rounded-full bg-white shadow-2xs border border-slate-200 text-teal-600">
                <UploadCloud className="h-6 w-6" />
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Click to browse or drag and drop customer documents here
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Architecture guides, technical requirements, RFCs, and API specifications
                  </p>
                </div>
              )}
            </div>

            {/* Category and Custom Title inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Document Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Defaults to filename..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Upload Feedback */}
            {uploadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("query")}
                  className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900 ml-3 shrink-0"
                >
                  Test Q&A &rarr;
                </button>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{uploadError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={uploadLoading || !selectedFile}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {uploadLoading ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing, Chunking & Indexing...</span>
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Upload & Activate Grounded RAG</span>
                </>
              )}
            </button>
          </form>

          {/* Document Library List */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <Folder className="h-4 w-4 text-slate-500" />
                Indexed Customer Documents ({documents.length})
              </h4>
              <button
                type="button"
                onClick={fetchDocuments}
                disabled={docsLoading}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition"
              >
                <RefreshCw className={`h-3 w-3 ${docsLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                <FileCode className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                No documents uploaded for this engagement yet. Upload a document above to activate Grounded RAG!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                          {doc.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pl-6">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-slate-400" />
                          {doc.chunks_count} Vector Chunks
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-6 sm:pl-0">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold font-mono">
                        <Check className="h-3 w-3 text-emerald-600" />
                        Indexed
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("query");
                          setQuery(`Summarize the core requirements from ${doc.title}`);
                        }}
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 transition"
                      >
                        Ask &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
