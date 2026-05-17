"use client";

import { useState } from "react";
import { X, Loader2, Link2, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface Props {
  onClose: () => void;
  onComplete: (recipeId: string) => void;
}

type Stage = "idle" | "downloading" | "extracting" | "parsing" | "saving" | "done" | "error";

const STAGE_MESSAGES: Record<Stage, string> = {
  idle: "",
  downloading: "Downloading reel…",
  extracting: "Transcribing audio & reading overlays…",
  parsing: "Extracting recipe with AI…",
  saving: "Saving to your library…",
  done: "Done!",
  error: "Something went wrong",
};

const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0,
  downloading: 20,
  extracting: 50,
  parsing: 75,
  saving: 90,
  done: 100,
  error: 0,
};

export function IngestModal({ onClose, onComplete }: Props) {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [caption, setCaption] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");

  const isLoading = stage !== "idle" && stage !== "done" && stage !== "error";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setErrorCode(null);
    setStage("downloading");

    try {
      // Simulate stage progression while waiting for the API
      const stageTimer = setTimeout(() => setStage("extracting"), 8000);
      const stageTimer2 = setTimeout(() => setStage("parsing"), 18000);

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearTimeout(stageTimer);
      clearTimeout(stageTimer2);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorCode(body.code ?? null);
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setStage("saving");
      const data = await res.json();
      setStage("done");
      setTimeout(() => onComplete(data.recipeId), 600);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caption.trim()) return;
    setError(null);
    setStage("parsing");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, creatorHandle }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setStage("saving");
      const data = await res.json();
      setStage("done");
      setTimeout(() => onComplete(data.recipeId), 600);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const isDownloadError =
    errorCode && ["PRIVATE", "DELETED", "RATE_LIMITED"].includes(errorCode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-md bg-[var(--card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border)] shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">
            {showManual ? "Paste caption manually" : "Add a reel"}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            <Progress value={STAGE_PROGRESS[stage]} />
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="w-4 h-4 animate-spin flex-none" />
              {STAGE_MESSAGES[stage]}
            </div>
          </div>
        )}

        {/* Done */}
        {stage === "done" && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 py-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Recipe saved! Redirecting…</span>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-[var(--destructive)]">
              <AlertCircle className="w-5 h-5 flex-none mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  {isDownloadError
                    ? errorCode === "PRIVATE"
                      ? "This account is private"
                      : errorCode === "DELETED"
                      ? "This reel no longer exists"
                      : "Download temporarily unavailable"
                    : "Ingestion failed"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{error}</p>
              </div>
            </div>

            {isDownloadError && !showManual && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStage("idle");
                  setShowManual(true);
                }}
                className="w-full gap-2"
              >
                <FileText className="w-4 h-4" />
                Enter caption manually instead
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setStage("idle"); setError(null); }}
              className="w-full"
            >
              Try again
            </Button>
          </div>
        )}

        {/* URL form */}
        {stage === "idle" && !showManual && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Link2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                <label className="text-sm font-medium">Instagram Reel URL</label>
              </div>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/…"
                type="url"
                autoFocus
                required
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                Paste any Instagram reel link. Takes ~30 seconds.
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={!url.trim()}>
              Extract Recipe
            </Button>

            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Private account? Paste caption manually →
            </button>
          </form>
        )}

        {/* Manual form */}
        {stage === "idle" && showManual && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Paste the full caption from the reel, including ingredient list if there is one…"
                rows={6}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Creator handle <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
              </label>
              <Input
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                placeholder="@username"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowManual(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={!caption.trim()}>
                Parse Recipe
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
