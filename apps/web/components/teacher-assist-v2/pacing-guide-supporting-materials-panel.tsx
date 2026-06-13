"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiFieldErrors,
  archiveV2PacingGuideSupportingMaterial,
  createV2PacingGuideSupportingLink,
  createV2PacingGuideSupportingNote,
  fetchV2PacingGuideSupportingMaterials,
  uploadV2PacingGuideSupportingFile,
} from "@/lib/teacher-assist-v2-api";
import { resolveTeacherAssistFileUrl } from "@/lib/auth-service";
import type { PacingGuideSupportingMaterial } from "@/lib/teacher-assist-v2-types";

const FILE_RESOURCE_TYPES = [
  { value: "curriculum_file", label: "Curriculum file" },
  { value: "worksheet", label: "Worksheet" },
  { value: "slide_deck", label: "Slide deck" },
  { value: "assessment_resource", label: "Assessment resource" },
  { value: "vocabulary_resource", label: "Vocabulary resource" },
  { value: "teacher_guide", label: "Teacher guide" },
  { value: "other", label: "Other supporting document" },
];

const LINK_RESOURCE_TYPES = [
  { value: "reference_link", label: "Reference link" },
  { value: "curriculum_reference", label: "Curriculum reference" },
  { value: "textbook_reference", label: "Textbook reference" },
  { value: "website", label: "Website" },
  { value: "video", label: "Video" },
  { value: "assessment_resource", label: "Assessment resource" },
  { value: "teacher_guide", label: "Teacher guide" },
  { value: "other", label: "Other" },
];

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type SectionAlert = { tone: "success" | "error"; message: string } | null;

export function PacingGuideSupportingMaterialsPanel({
  pacingGuideId,
  periodId,
  periodDayId,
  educationObjectiveId,
  guideLevelOnly = false,
  weekLevelOnly = false,
  compact = false,
  scopeLabel,
}: {
  pacingGuideId: string;
  periodId?: string | null;
  periodDayId?: string | null;
  educationObjectiveId?: string | null;
  guideLevelOnly?: boolean;
  weekLevelOnly?: boolean;
  compact?: boolean;
  scopeLabel: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<PacingGuideSupportingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [fileResourceType, setFileResourceType] = useState("curriculum_file");
  const [fileTitle, setFileTitle] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkResourceType, setLinkResourceType] = useState("reference_link");
  const [linkDescription, setLinkDescription] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [uploadAlert, setUploadAlert] = useState<SectionAlert>(null);
  const [linkAlert, setLinkAlert] = useState<SectionAlert>(null);
  const [noteAlert, setNoteAlert] = useState<SectionAlert>(null);
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const linkage = {
    period_id: periodId ?? undefined,
    period_day_id: periodDayId ?? undefined,
    education_objective_id: educationObjectiveId ?? undefined,
  };

  const refreshMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchV2PacingGuideSupportingMaterials(pacingGuideId, {
        period_id: periodId ?? undefined,
        period_day_id: periodDayId ?? undefined,
        education_objective_id: educationObjectiveId ?? undefined,
        guide_level_only: guideLevelOnly,
        week_level_only: weekLevelOnly,
      });
      setMaterials(rows);
    } catch (error) {
      setUploadAlert({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not load supporting materials.",
      });
    } finally {
      setLoading(false);
    }
  }, [pacingGuideId, periodId, periodDayId, educationObjectiveId, guideLevelOnly, weekLevelOnly]);

  useEffect(() => {
    void refreshMaterials();
  }, [refreshMaterials]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadAlert(null);
    try {
      for (const file of files) {
        await uploadV2PacingGuideSupportingFile(pacingGuideId, file, {
          title: fileTitle.trim() || file.name,
          resource_type: fileResourceType,
          ...linkage,
        });
      }
      setFileTitle("");
      setUploadAlert({ tone: "success", message: "File uploaded." });
      await refreshMaterials();
    } catch (error) {
      if (error instanceof ApiFieldErrors) {
        setUploadAlert({
          tone: "error",
          message: Object.values(error.fieldErrors).join(" "),
        });
      } else {
        setUploadAlert({
          tone: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const submitLink = async () => {
    setLinkAlert(null);
    if (!linkTitle.trim()) {
      setLinkAlert({ tone: "error", message: "Title is required." });
      return;
    }
    if (!linkUrl.trim()) {
      setLinkUrlError("URL is required.");
      setLinkAlert({ tone: "error", message: "URL is required." });
      return;
    }
    if (!isValidUrl(linkUrl)) {
      setLinkUrlError("Enter a valid http or https URL.");
      setLinkAlert({ tone: "error", message: "Enter a valid http or https URL." });
      return;
    }
    setLinkUrlError(null);
    try {
      await createV2PacingGuideSupportingLink(pacingGuideId, {
        title: linkTitle.trim(),
        external_url: linkUrl.trim(),
        resource_type: linkResourceType,
        description: linkDescription.trim() || null,
        ...linkage,
      });
      setLinkTitle("");
      setLinkUrl("");
      setLinkDescription("");
      setLinkAlert({ tone: "success", message: "Reference link added." });
      await refreshMaterials();
    } catch (error) {
      if (error instanceof ApiFieldErrors) {
        const message = Object.values(error.fieldErrors).join(" ");
        if (error.fieldErrors.external_url) setLinkUrlError(error.fieldErrors.external_url);
        setLinkAlert({ tone: "error", message });
      } else {
        setLinkAlert({
          tone: "error",
          message: error instanceof Error ? error.message : "Could not add link.",
        });
      }
    }
  };

  const submitNote = async () => {
    setNoteAlert(null);
    if (!noteBody.trim()) {
      setNoteAlert({ tone: "error", message: "Note body is required." });
      return;
    }
    try {
      await createV2PacingGuideSupportingNote(pacingGuideId, {
        title: noteTitle.trim() || null,
        note_body: noteBody.trim(),
        ...linkage,
      });
      setNoteTitle("");
      setNoteBody("");
      setNoteAlert({ tone: "success", message: "District note added." });
      await refreshMaterials();
    } catch (error) {
      if (error instanceof ApiFieldErrors) {
        setNoteAlert({ tone: "error", message: Object.values(error.fieldErrors).join(" ") });
      } else {
        setNoteAlert({
          tone: "error",
          message: error instanceof Error ? error.message : "Could not add note.",
        });
      }
    }
  };

  const removeMaterial = async (materialId: string) => {
    try {
      await archiveV2PacingGuideSupportingMaterial(materialId);
      await refreshMaterials();
    } catch (error) {
      setUploadAlert({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not remove material.",
      });
    }
  };

  return (
    <section
      className={`space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 ${compact ? "mt-3" : "mt-4"}`}
    >
      <div>
        <h3 className={`font-semibold text-slate-900 ${compact ? "text-xs" : "text-sm"}`}>Supporting materials</h3>
        <p className="mt-1 text-xs text-slate-600">{scopeLabel}</p>
        {!compact ? (
          <p className="mt-1 text-xs text-amber-800">
            Only upload materials your district or school is authorized to use.
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-xs text-slate-500">Loading materials...</p> : null}

      {!loading && materials.length > 0 ? (
        <ul className="space-y-2">
          {materials.map((material) => (
            <li key={material.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{material.title}</p>
                  <p className="text-xs text-slate-500">
                    {material.material_kind} · {material.resource_type.replaceAll("_", " ")}
                  </p>
                  {material.description ? <p className="mt-1 text-xs text-slate-600">{material.description}</p> : null}
                  {material.note_body ? <p className="mt-1 text-xs text-slate-700">{material.note_body}</p> : null}
                  {material.external_url ? (
                    <a
                      href={material.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-sky-700"
                    >
                      Open link
                    </a>
                  ) : null}
                  {material.download_url ? (
                    <a
                      href={resolveTeacherAssistFileUrl(material.download_url) ?? material.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-sky-700"
                    >
                      Download file
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ta-button-secondary h-7 px-2 text-xs"
                  onClick={() => void removeMaterial(material.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload file</p>
        {uploadAlert ? (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              uploadAlert.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {uploadAlert.message}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700">Resource type</span>
            <select
              className="ta-input h-9"
              value={fileResourceType}
              onChange={(event) => setFileResourceType(event.target.value)}
            >
              {FILE_RESOURCE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700">Title (optional)</span>
            <input
              className="ta-input h-9"
              value={fileTitle}
              onChange={(event) => setFileTitle(event.target.value)}
              placeholder="Defaults to filename"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0) {
              void uploadFiles(files);
            }
          }}
          className={`flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center text-xs transition ${
            dragActive
              ? "border-sky-400 bg-sky-50"
              : "border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/40"
          }`}
        >
          <span className="font-semibold text-slate-900">
            {uploading ? "Uploading..." : "Drag and drop curriculum files here"}
          </span>
          <span className="mt-1 text-slate-600">PDF, DOCX, PPTX, TXT, or images</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            if (files.length > 0) {
              void uploadFiles(files);
            }
            event.target.value = "";
          }}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference link</p>
        {linkAlert ? (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              linkAlert.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {linkAlert.message}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700">Title</span>
            <input className="ta-input h-9" value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700">Resource type</span>
            <select
              className="ta-input h-9"
              value={linkResourceType}
              onChange={(event) => setLinkResourceType(event.target.value)}
            >
              {LINK_RESOURCE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700">URL</span>
          <input
            className={`ta-input h-9 ${linkUrlError ? "border-rose-400" : ""}`}
            value={linkUrl}
            onChange={(event) => {
              setLinkUrl(event.target.value);
              if (linkUrlError) setLinkUrlError(null);
            }}
            placeholder="https://"
          />
          {linkUrlError ? <span className="text-rose-700">{linkUrlError}</span> : null}
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700">Description (optional)</span>
          <textarea
            className="ta-input min-h-[72px]"
            value={linkDescription}
            onChange={(event) => setLinkDescription(event.target.value)}
          />
        </label>
        <button type="button" className="ta-button-secondary h-8 px-3 text-xs" onClick={() => void submitLink()}>
          Add link
        </button>
      </div>

      {!compact ? (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">District note</p>
        {noteAlert ? (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              noteAlert.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {noteAlert.message}
          </div>
        ) : null}
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700">Note title (optional)</span>
          <input className="ta-input h-9" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-slate-700">Note body</span>
          <textarea
            className="ta-input min-h-[96px]"
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
          />
        </label>
        <button type="button" className="ta-button-secondary h-8 px-3 text-xs" onClick={() => void submitNote()}>
          Add note
        </button>
      </div>
      ) : null}
    </section>
  );
}
