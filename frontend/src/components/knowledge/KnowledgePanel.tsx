"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen, Search, Sparkles, FileText,
  CheckCircle2, AlertTriangle, UploadCloud, FileUp, Folder,
  RefreshCw, Check, Clock, Lock, FileCode, Layers,
  Eye, Download, ZoomIn, ZoomOut, RotateCcw, X, Copy,
  ExternalLink, Image as ImageIcon, Filter, ChevronDown, Trash2
} from "lucide-react";
import { formatISTDateTime } from "@/utils/date";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";

interface IndexedDocument {
  id: string;
  engagement_id: string;
  title: string;
  category: string;
  status: string;
  chunks_count: number;
  file_type?: "pdf" | "image" | "text";
  uploaded_by: string;
  created_at: string;
}

interface DocumentDetail {
  id: string;
  engagement_id: string;
  title: string;
  filename: string;
  category: string;
  status: string;
  chunks_count: number;
  file_type: "pdf" | "image" | "text";
  has_binary_file: boolean;
  content: string;
  uploaded_by: string;
  created_at?: string;
}

interface KnowledgePanelProps {
  engagementId: string;
  customerName: string;
}

import { API_BASE } from "@/utils/api";

const CATEGORIES = [
  "Technical Documentation",
  "Customer Requirements",
  "Architecture",
  "Decisions",
  "Customer Notes",
  "Other"
];

export default function KnowledgePanel({ engagementId, customerName }: KnowledgePanelProps) {
  const { openSupervisorWithContext } = useEngagement();
  const { isManager } = useAuth();

  // Documents & Library State
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Deletion State (Manager Only)
  const [deletingDoc, setDeletingDoc] = useState<IndexedDocument | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Document Viewer Modal State
  const [viewingDoc, setViewingDoc] = useState<IndexedDocument | null>(null);
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [docDetailLoading, setDocDetailLoading] = useState(false);
  const [viewerMode, setViewerMode] = useState<"file" | "text">("file");
  const [imageZoom, setImageZoom] = useState(1);
  const [copiedText, setCopiedText] = useState(false);

  // Upload Form Fields
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("Technical Documentation");
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
    let isCancelled = false;
    const loadDocs = async () => {
      setDocsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents`);
        if (res.ok && !isCancelled) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDocuments(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch indexed documents:", err);
      } finally {
        if (!isCancelled) {
          setDocsLoading(false);
        }
      }
    };

    loadDocs();
    return () => {
      isCancelled = true;
    };
  }, [engagementId]);

  // Open Document Viewer
  const handleOpenViewer = async (doc: IndexedDocument) => {
    setViewingDoc(doc);
    setDocDetail(null);
    setDocDetailLoading(true);
    setViewerMode("file");
    setImageZoom(1);
    setCopiedText(false);

    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents/${doc.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDocDetail(json.data);
        }
      }
    } catch (err) {
      console.error("Error fetching document details:", err);
    } finally {
      setDocDetailLoading(false);
    }
  };

  // Close Document Viewer
  const handleCloseViewer = () => {
    setViewingDoc(null);
    setDocDetail(null);
    setImageZoom(1);
  };

  // Copy document text
  const handleCopyText = () => {
    if (docDetail?.content) {
      navigator.clipboard.writeText(docDetail.content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // Filtered documents list based on search and category filters
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Category filter
      if (selectedCategory !== "All" && doc.category !== selectedCategory) {
        return false;
      }
      // Keyword search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = doc.title.toLowerCase().includes(q);
        const categoryMatch = doc.category.toLowerCase().includes(q);
        return titleMatch || categoryMatch;
      }
      return true;
    });
  }, [documents, searchQuery, selectedCategory]);

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
    formData.append("category", uploadCategory);
    if (customTitle.trim()) {
      formData.append("title", customTitle.trim());
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents/upload-file`, {
        method: "POST",
        headers,
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
        setShowUploadForm(false);
        await fetchDocuments();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId, type: "EVIDENCE_UPLOADED" } }));
        }
      } else {
        setUploadError(json.detail || json.message || "Failed to upload and index document.");
      }
    } catch (err: unknown) {
      setUploadError((err as Error).message || "Network error during document upload.");
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle Document Deletion (Manager Only)
  const handleDeleteDocument = async (doc: IndexedDocument) => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/documents/${doc.id}`, {
        method: "DELETE",
        headers
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setDeletingDoc(null);
        setUploadSuccess(`Successfully deleted '${doc.title}' from Google Cloud Storage and Knowledge Base.`);
        await fetchDocuments();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calmwork-state-change", {
              detail: { engagementId, type: "DOCUMENT_DELETED" }
            })
          );
        }
      } else {
        setDeleteError(json.detail || json.message || "Failed to delete document.");
      }
    } catch (err: unknown) {
      setDeleteError((err as Error).message || "Network error deleting document.");
    } finally {
      setDeleteLoading(false);
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

  // Helper for file type badge
  const getFileBadge = (doc: IndexedDocument) => {
    const ftype = doc.file_type || (doc.title.toLowerCase().endsWith(".pdf") ? "pdf" : "text");
    if (ftype === "pdf") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
          <FileText className="h-3 w-3 text-rose-600" />
          PDF
        </span>
      );
    }
    if (ftype === "image") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
          <ImageIcon className="h-3 w-3 text-purple-600" />
          IMAGE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
        <FileCode className="h-3 w-3 text-slate-600" />
        DOC
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* DOCUMENT LIBRARY                                          */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Document Library Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 shadow-2xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Document Library
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded font-semibold border border-slate-200">
                  {documents.length} {documents.length === 1 ? "document" : "documents"}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Document repository, reading interfaces, and verified citations for <strong className="text-slate-700 font-semibold">{customerName}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons: Refresh + Upload Document */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchDocuments}
              disabled={docsLoading}
              title="Refresh documents"
              className="p-2 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`h-4 w-4 ${docsLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowUploadForm(!showUploadForm)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                showUploadForm
                  ? "bg-slate-200 text-slate-800"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>{showUploadForm ? "Hide Upload Form" : "Upload Document"}</span>
            </button>
          </div>
        </div>

        {/* Upload Feedback Banner */}
        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{uploadSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4">
          {/* Action Row: Search Bar + Category Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by keyword, title, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="knowledge-category-select" className="text-xs text-slate-500 font-medium flex items-center gap-1 shrink-0">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span>Category:</span>
              </label>
              <div className="relative">
                <select
                  id="knowledge-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs rounded-lg pl-3 pr-8 py-2 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer shadow-2xs"
                >
                  <option value="All">All Categories ({documents.length})</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Collapsible Upload Form */}
          {showUploadForm && (
            <form onSubmit={handleFileUpload} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase font-mono flex items-center gap-1.5">
                  <UploadCloud className="h-4 w-4 text-teal-600" />
                  Upload Technical Document or Architecture Diagram
                </h4>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition ${
                  isDragging
                    ? "border-teal-500 bg-teal-50/50"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-300 hover:border-slate-400 bg-white"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.svg,.webp,.txt,.md,.markdown,.json,.csv,.yaml,.yml"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600" />
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB &middot; Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="h-6 w-6 mx-auto text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">
                      Drag & drop PDF, architecture image, or document here, or click to browse
                    </p>
                    <p className="text-xs text-slate-400">
                      Supports PDF, PNG, JPG, SVG, WebP, Markdown, Text, JSON (Max 50MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Category & Title Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Document Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Display Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Cutover Architecture Spec"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !selectedFile}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 px-4 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {uploadLoading ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      <span>Processing & Indexing...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-3.5 w-3.5" />
                      <span>Upload & Index</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Document Count Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{filteredDocuments.length}</strong> of {documents.length} indexed documents
            </span>
            {searchQuery && (
              <span className="text-teal-700 font-medium">
                Filtered by: &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>

          {/* Document Cards Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-2">
              <FileCode className="h-8 w-8 mx-auto text-slate-400" />
              <p className="text-xs font-semibold text-slate-700">
                {documents.length === 0
                  ? "No documents uploaded for this engagement yet."
                  : "No documents matching your search filter."}
              </p>
              <p className="text-xs text-slate-400">
                {documents.length === 0
                  ? "Click 'Upload Document' above to add PDFs, architecture specs, or technical diagrams."
                  : "Try adjusting your keyword query or category filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredDocuments.map((doc) => {
                const ftype = doc.file_type || (doc.title.toLowerCase().endsWith(".pdf") ? "pdf" : "text");
                const isPdf = ftype === "pdf";
                const isImage = ftype === "image";

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {getFileBadge(doc)}
                        <h4
                          onClick={() => handleOpenViewer(doc)}
                          className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition cursor-pointer"
                        >
                          {doc.title}
                        </h4>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                          {doc.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Layers className="h-3 w-3 text-slate-400" />
                          {doc.chunks_count} Vector Chunks
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatISTDateTime(doc.created_at, { shortMonth: true })}
                        </span>
                        <span>&bull;</span>
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="h-3 w-3 text-emerald-600" />
                          Indexed
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenViewer(doc)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                          isPdf
                            ? "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200"
                            : isImage
                            ? "bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{isPdf ? "Read PDF" : isImage ? "View Image" : "Read Document"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          openSupervisorWithContext({
                            initialQuery: `What are the key technical requirements and architectural details in "${doc.title}"?`
                          });
                        }}
                        className="text-xs text-teal-700 hover:text-teal-900 font-semibold px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 transition flex items-center gap-1 cursor-pointer"
                        title="Analyze with CalmWork AI Orchestrated Assistant"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Ask CalmWork AI &rarr;</span>
                      </button>

                      {isManager && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingDoc(doc);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center justify-center cursor-pointer"
                          title="Delete Knowledge Resource (Manager Only)"
                          aria-label="Delete Knowledge Resource"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DOCUMENT VIEWER MODAL (PDF / IMAGE / TEXT READER)         */}
      {/* ========================================================= */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Viewer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileBadge(viewingDoc)}
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {viewingDoc.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span>{viewingDoc.category}</span>
                    <span>&bull;</span>
                    <span>{viewingDoc.chunks_count} Vector Chunks</span>
                  </div>
                </div>
              </div>

              {/* Viewer Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Mode switcher for PDFs */}
                {viewingDoc.file_type === "pdf" && (
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewerMode("file")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewerMode === "file" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                      }`}
                    >
                      PDF View
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewerMode("text")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewerMode === "text" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Extracted Text
                    </button>
                  </div>
                )}

                {/* External Open in Tab */}
                <a
                  href={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in new window"
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                {/* Download */}
                <a
                  href={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  title="Download file"
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </a>

                {/* Ask AI quick action */}
                <button
                  type="button"
                  onClick={() => {
                    const docTitle = viewingDoc.title;
                    handleCloseViewer();
                    openSupervisorWithContext({
                      initialQuery: `What are the core specifications and architectural requirements in "${docTitle}"?`
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 flex items-center gap-1 transition cursor-pointer"
                  title="Ask CalmWork AI Orchestrated Assistant"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  <span>Ask CalmWork AI</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={handleCloseViewer}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Viewer Content Body */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
              {docDetailLoading ? (
                <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Sparkles className="h-6 w-6 animate-spin text-teal-600" />
                  <span>Loading document content...</span>
                </div>
              ) : viewingDoc.file_type === "pdf" && viewerMode === "file" ? (
                /* PDF Interactive Viewer */
                <div className="w-full h-[660px] bg-white rounded-lg shadow-inner overflow-hidden border border-slate-200 relative">
                  <object
                    data={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file#toolbar=1`}
                    type="application/pdf"
                    className="w-full h-full border-0"
                  >
                    <iframe
                      src={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file#toolbar=1`}
                      className="w-full h-full border-0"
                      title={viewingDoc.title}
                    >
                      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-xs text-slate-600 bg-slate-50">
                        <FileText className="h-8 w-8 text-rose-500" />
                        <p className="font-semibold text-slate-800">Inline PDF preview is not available in your browser.</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewerMode("text")}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition cursor-pointer"
                          >
                            Switch to Extracted Text
                          </button>
                          <a
                            href={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition cursor-pointer"
                          >
                            Open in New Tab
                          </a>
                        </div>
                      </div>
                    </iframe>
                  </object>
                </div>

              ) : viewingDoc.file_type === "image" ? (
                /* Architecture Image Lightbox */
                <div className="space-y-3">
                  {/* Image Toolbar */}
                  <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-purple-600" />
                      Architecture Diagram Preview
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setImageZoom((prev) => Math.max(0.5, prev - 0.2))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Zoom out"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-xs text-slate-500 w-12 text-center">
                        {Math.round(imageZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.2))}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageZoom(1)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title="Reset zoom"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Zoomable Image Container */}
                  <div className="w-full h-[580px] bg-slate-900/5 rounded-lg border border-slate-200 overflow-auto flex items-center justify-center p-4">
                    <img
                      src={`${API_BASE}/engagements/${engagementId}/documents/${viewingDoc.id}/file`}
                      alt={viewingDoc.title}
                      style={{
                        transform: `scale(${imageZoom})`,
                        transition: "transform 0.15s ease-out"
                      }}
                      className="max-w-full max-h-full object-contain rounded shadow-md"
                    />
                  </div>
                </div>
              ) : (
                /* Text / Markdown / Extracted Clauses Document Reader */
                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Document Content & Clauses
                      </h4>
                      <p className="text-xs text-slate-400">
                        {docDetail?.content ? `${docDetail.content.length} characters` : "Content preview"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans selection:bg-blue-100">
                    {docDetail?.content || "No text content available for this document."}
                  </div>
                </div>
              )}
            </div>

            {/* Viewer Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Document ID: <strong className="font-mono text-slate-700">{viewingDoc.id}</strong>
              </span>
              <button
                type="button"
                onClick={handleCloseViewer}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL (MANAGER ONLY)                 */}
      {/* ========================================================= */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Knowledge Resource</h3>
                <p className="text-xs text-slate-500">Manager Authorization Required</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-2">
              <p>
                Are you sure you want to permanently delete:
              </p>
              <p className="font-bold text-slate-900 break-words">
                &ldquo;{deletingDoc.title}&rdquo;
              </p>
              <ul className="text-slate-500 list-disc list-inside space-y-0.5 text-[11px]">
                <li>Removes binary object from Google Cloud Storage</li>
                <li>Evicts {deletingDoc.chunks_count} indexed semantic vectors from KNOW Agent</li>
                <li>Permanently deletes database record &amp; logs audit trail</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeletingDoc(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => handleDeleteDocument(deletingDoc)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting from GCS...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Resource</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
