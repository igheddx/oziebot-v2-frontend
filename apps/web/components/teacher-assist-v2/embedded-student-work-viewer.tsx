"use client";

import { useEffect, useState } from "react";

import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";

type EmbeddedStudentWorkViewerProps = {
  previewUrl: string | null | undefined;
  mimeType: string | null | undefined;
  title?: string;
  className?: string;
};

export function EmbeddedStudentWorkViewer({
  previewUrl,
  mimeType,
  title = "Student work",
  className = "mt-3 h-[32rem] w-full rounded-lg border border-slate-200",
}: EmbeddedStudentWorkViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedUrl = resolveTeacherAssistFileUrl(previewUrl);
  const isImage = (mimeType ?? "").startsWith("image/");

  useEffect(() => {
    if (!resolvedUrl || isImage) {
      setObjectUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);

    void fetch(resolvedUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load student work preview.");
        }
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((nextError: Error) => {
        if (!active) return;
        setError(nextError.message);
        setObjectUrl(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [resolvedUrl, isImage]);

  if (!resolvedUrl) {
    return <p className="mt-3 text-sm text-slate-600">Preview unavailable.</p>;
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolvedUrl} alt={title} className={`${className} max-h-[32rem] object-contain`} />
    );
  }

  if (loading) {
    return <p className="mt-3 text-sm text-slate-600">Loading preview…</p>;
  }

  if (error || !objectUrl) {
    return <p className="mt-3 text-sm text-rose-700">{error ?? "Preview unavailable."}</p>;
  }

  return (
    <iframe
      title={title}
      src={objectUrl}
      className={className}
    />
  );
}
