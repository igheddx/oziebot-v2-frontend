export function TeachingSlideVisual({ visualType }: { visualType?: string | null }) {
  if (!visualType || visualType === "none") return null;

  if (visualType === "concept_map") {
    return (
      <svg viewBox="0 0 320 220" className="mx-auto h-56 w-full max-w-md" aria-hidden>
        <circle cx="160" cy="110" r="42" fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
        <text x="160" y="115" textAnchor="middle" fontSize="13" fill="#1e3a8a">
          Main Idea
        </text>
        <line x1="160" y1="68" x2="160" y2="28" stroke="#64748b" strokeWidth="2" />
        <line x1="118" y1="132" x2="58" y2="172" stroke="#64748b" strokeWidth="2" />
        <line x1="202" y1="132" x2="262" y2="172" stroke="#64748b" strokeWidth="2" />
        <circle cx="160" cy="20" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <circle cx="48" cy="182" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <circle cx="272" cy="182" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
      </svg>
    );
  }

  if (visualType === "main_idea_web") {
    return (
      <svg viewBox="0 0 320 220" className="mx-auto h-48 w-full max-w-sm" aria-hidden>
        <circle cx="160" cy="110" r="42" fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
        <text x="160" y="115" textAnchor="middle" fontSize="13" fill="#1e3a8a">
          Main Idea
        </text>
        <line x1="160" y1="68" x2="160" y2="28" stroke="#64748b" strokeWidth="2" />
        <circle cx="160" cy="20" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <text x="160" y="24" textAnchor="middle" fontSize="10" fill="#155e75">
          Detail
        </text>
        <line x1="118" y1="132" x2="58" y2="172" stroke="#64748b" strokeWidth="2" />
        <circle cx="48" cy="182" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
        <line x1="202" y1="132" x2="262" y2="172" stroke="#64748b" strokeWidth="2" />
        <circle cx="272" cy="182" r="24" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
      </svg>
    );
  }

  if (visualType === "supporting_details_chart") {
    return (
      <svg viewBox="0 0 320 180" className="mx-auto h-40 w-full max-w-sm" aria-hidden>
        <rect x="20" y="20" width="280" height="140" rx="12" fill="#f8fafc" stroke="#cbd5e1" />
        <rect x="40" y="40" width="240" height="28" rx="6" fill="#dbeafe" />
        <rect x="40" y="78" width="240" height="22" rx="4" fill="#e2e8f0" />
        <rect x="40" y="106" width="240" height="22" rx="4" fill="#e2e8f0" />
        <rect x="40" y="134" width="240" height="22" rx="4" fill="#e2e8f0" />
      </svg>
    );
  }

  if (visualType === "graphic_organizer" || visualType === "chart" || visualType === "comparison_table") {
    return (
      <svg viewBox="0 0 320 190" className="mx-auto h-44 w-full max-w-md" aria-hidden>
        <rect x="20" y="20" width="280" height="150" rx="12" fill="#f8fafc" stroke="#cbd5e1" />
        <line x1="160" y1="20" x2="160" y2="170" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="20" y1="60" x2="300" y2="60" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="32" y="30" width="110" height="18" rx="4" fill="#dbeafe" />
        <rect x="178" y="30" width="110" height="18" rx="4" fill="#bfdbfe" />
        <rect x="32" y="78" width="110" height="18" rx="4" fill="#e2e8f0" />
        <rect x="178" y="78" width="110" height="18" rx="4" fill="#e2e8f0" />
        <rect x="32" y="110" width="110" height="18" rx="4" fill="#e2e8f0" />
        <rect x="178" y="110" width="110" height="18" rx="4" fill="#e2e8f0" />
      </svg>
    );
  }

  if (visualType === "text_evidence_icon") {
    return (
      <svg viewBox="0 0 160 160" className="mx-auto h-36 w-36" aria-hidden>
        <circle cx="70" cy="70" r="34" fill="none" stroke="#0f766e" strokeWidth="8" />
        <line x1="96" y1="96" x2="132" y2="132" stroke="#0f766e" strokeWidth="8" strokeLinecap="round" />
        <rect x="42" y="52" width="56" height="36" rx="4" fill="#ccfbf1" stroke="#0f766e" />
      </svg>
    );
  }

  if (visualType === "vocabulary_card") {
    return (
      <svg viewBox="0 0 280 120" className="mx-auto h-32 w-full max-w-sm" aria-hidden>
        <rect x="10" y="20" width="75" height="80" rx="8" fill="#fef3c7" stroke="#d97706" />
        <rect x="102" y="20" width="75" height="80" rx="8" fill="#fce7f3" stroke="#db2777" />
        <rect x="194" y="20" width="75" height="80" rx="8" fill="#dcfce7" stroke="#16a34a" />
      </svg>
    );
  }

  if (visualType === "timeline" || visualType === "process_flow") {
    return (
      <svg viewBox="0 0 340 140" className="mx-auto h-36 w-full max-w-md" aria-hidden>
        <line x1="40" y1="70" x2="300" y2="70" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
        {[60, 140, 220, 280].map((x, index) => (
          <g key={x}>
            <circle cx={x} cy="70" r="18" fill={index % 2 === 0 ? "#dbeafe" : "#dcfce7"} stroke="#0f172a" strokeWidth="2" />
            <rect x={x - 26} y={index % 2 === 0 ? 18 : 94} width="52" height="20" rx="5" fill="#f8fafc" stroke="#cbd5e1" />
          </g>
        ))}
      </svg>
    );
  }

  if (visualType === "diagram" || visualType === "image" || visualType === "icon_illustration") {
    return (
      <svg viewBox="0 0 320 220" className="mx-auto h-52 w-full max-w-md" aria-hidden>
        <rect x="24" y="24" width="272" height="172" rx="16" fill="#eff6ff" stroke="#93c5fd" strokeWidth="3" />
        <circle cx="92" cy="90" r="28" fill="#fde68a" />
        <path d="M60 168l58-52 36 30 44-54 62 76z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="3" />
      </svg>
    );
  }

  if (visualType === "paragraph_structure") {
    return (
      <svg viewBox="0 0 280 160" className="mx-auto h-36 w-full max-w-sm" aria-hidden>
        <rect x="20" y="20" width="240" height="24" rx="4" fill="#dbeafe" />
        <rect x="20" y="54" width="240" height="18" rx="3" fill="#e2e8f0" />
        <rect x="20" y="78" width="240" height="18" rx="3" fill="#e2e8f0" />
        <rect x="20" y="102" width="240" height="18" rx="3" fill="#e2e8f0" />
      </svg>
    );
  }

  if (visualType === "checklist") {
    return (
      <svg viewBox="0 0 220 120" className="mx-auto h-28 w-full max-w-xs" aria-hidden>
        <rect x="16" y="16" width="16" height="16" rx="3" fill="#dcfce7" stroke="#16a34a" />
        <rect x="16" y="46" width="16" height="16" rx="3" fill="#dcfce7" stroke="#16a34a" />
        <rect x="16" y="76" width="16" height="16" rx="3" fill="#f1f5f9" stroke="#94a3b8" />
      </svg>
    );
  }

  return null;
}
