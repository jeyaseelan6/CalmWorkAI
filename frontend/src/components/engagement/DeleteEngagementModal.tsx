"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";

interface DeleteEngagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  customerName: string;
  engagementName?: string;
}

export default function DeleteEngagementModal({
  isOpen,
  onClose,
  engagementId,
  customerName,
  engagementName
}: DeleteEngagementModalProps) {
  const router = useRouter();
  const { deleteEngagement } = useEngagement();
  const { isManager } = useAuth();

  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      setErrorMsg("Authorization Error: Only Engineering Managers can delete customer workspaces.");
      return;
    }

    setDeleting(true);
    setErrorMsg(null);

    const res = await deleteEngagement(engagementId);

    setDeleting(false);

    if (res.success) {
      onClose();
      router.push("/");
    } else {
      setErrorMsg(res.error || "Failed to delete workspace.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-rose-200/80 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Delete Workspace</h2>
              <p className="text-xs text-slate-500">
                Permanent deletion of workspace and all related assets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleDelete} className="mt-4 space-y-4">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Warning: This action cannot be undone</span>
            </div>
            <p className="leading-relaxed">
              You are about to permanently delete <strong className="font-semibold underline">{customerName}</strong>
              {engagementName ? ` (${engagementName})` : ""}.
            </p>
            <div className="pt-1 text-[11px] text-rose-700">
              <span className="font-semibold block mb-1">The following related data will be permanently wiped:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Authoritative Outcome statements & Success criteria</li>
                <li>Work plans, milestones, and all work tasks</li>
                <li>Uploaded document artifacts and technical specifications</li>
                <li>Complete timeline audit history and briefing notes</li>
                <li>Pending and reviewed Manager approvals</li>
                <li>KNOW agent semantic search vector store index</li>
              </ul>
            </div>
          </div>

          {!isManager && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <Lock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Restricted: Only users with the <strong>Manager</strong> role have permission to delete workspaces.</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleting || !isManager}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50 transition cursor-pointer"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting Everything...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Permanently Delete Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
