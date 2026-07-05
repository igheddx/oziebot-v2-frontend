import type { InstructionalPackageArtifact, SlideComparisonPair, SlideEngagement, SlideVisual, TeachingPresentationSlide } from "@/lib/teacher-assist-v2-types";

const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function asBullets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function slide(
  partial: Omit<TeachingPresentationSlide, "id"> & { id?: string },
  index: number,
): TeachingPresentationSlide {
  return {
    id: partial.id ?? `slide-${index}`,
    slideType: partial.slideType,
    layoutType: partial.layoutType,
    title: partial.title,
    subtitle: partial.subtitle,
    body: partial.body,
    bullets: partial.bullets,
    teacherNotes: partial.teacherNotes,
    speakerNotes: partial.speakerNotes,
    discussionQuestion: partial.discussionQuestion,
    comparisonPairs: partial.comparisonPairs,
    subjectName: partial.subjectName,
    layout: partial.layout,
    visual: partial.visual,
    engagement: partial.engagement,
    visualType: partial.visualType,
    visualRecommendation: partial.visualRecommendation,
    objectiveText: partial.objectiveText,
  };
}

function explicitSlidesFromContent(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
  const content = artifact.content_json;
  if (!content || typeof content !== "object" || !Array.isArray(content.slides)) {
    return [];
  }

  return content.slides
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) =>
      slide(
        {
          id: typeof entry.id === "string" ? entry.id : undefined,
          slideType: typeof entry.slideType === "string" ? entry.slideType : "content",
          layoutType: typeof entry.layout_type === "string" ? entry.layout_type : undefined,
          title: typeof entry.title === "string" ? entry.title : `Slide ${index + 1}`,
          subtitle: typeof entry.subtitle === "string" ? entry.subtitle : undefined,
          body: typeof entry.body === "string" ? entry.body : undefined,
          bullets: asBullets(entry.bullets),
          teacherNotes: typeof entry.teacherNotes === "string" ? entry.teacherNotes : undefined,
          speakerNotes: typeof entry.speaker_notes === "string" ? entry.speaker_notes : undefined,
          discussionQuestion: typeof entry.discussion_question === "string" ? entry.discussion_question : undefined,
          comparisonPairs: Array.isArray(entry.comparison_pairs)
            ? (entry.comparison_pairs as SlideComparisonPair[])
            : undefined,
          subjectName: artifact.subject_name ?? undefined,
          layout: typeof entry.layout === "string" ? entry.layout : undefined,
          visualType: typeof entry.visualType === "string" ? entry.visualType : undefined,
          visualRecommendation:
            entry.visualRecommendation && typeof entry.visualRecommendation === "object"
              ? (entry.visualRecommendation as TeachingPresentationSlide["visualRecommendation"])
              : undefined,
          objectiveText: artifact.objective_mapping?.objective_text,
        },
        index,
      ),
    );
}

function fallbackSlides(title: string): TeachingPresentationSlide[] {
  return [
    slide({ slideType: "title", title, bullets: ["Classroom presentation"] }, 0),
    slide({ slideType: "objective", title: "Learning objective", bullets: ["Review the lesson objective with students."] }, 1),
    slide({ slideType: "content", title: "Lesson content", bullets: ["Present the core lesson content."] }, 2),
    slide({ slideType: "activity", title: "Practice / activity", bullets: ["Guide student practice."] }, 3),
    slide({ slideType: "exit_ticket", title: "Exit ticket", bullets: ["Collect a quick check for understanding."] }, 4),
  ];
}

// Parses both plain ("Monday") and week-qualified ("W3-Monday") day labels.
function parseDayLabel(label: string | null): { week: number; dayIndex: number } {
  if (!label) return { week: 0, dayIndex: 99 };
  const qualified = label.match(/^W(\d+)-(.+)$/);
  if (qualified) {
    return { week: parseInt(qualified[1], 10), dayIndex: WEEKDAY_ORDER.indexOf(qualified[2]) };
  }
  return { week: 0, dayIndex: WEEKDAY_ORDER.indexOf(label) };
}

export function sortDailyPlans<T extends { day_label: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const l = parseDayLabel(left.day_label);
    const r = parseDayLabel(right.day_label);
    if (l.week !== r.week) return l.week - r.week;
    const li = l.dayIndex === -1 ? 99 : l.dayIndex;
    const ri = r.dayIndex === -1 ? 99 : r.dayIndex;
    return li - ri;
  });
}

// Formats "W1-Monday" → "Week 1 – Monday", plain "Monday" → "Monday".
export function formatDayLabel(label: string | null): string {
  if (!label) return "";
  const qualified = label.match(/^W(\d+)-(.+)$/);
  if (qualified) return `Week ${qualified[1]} – ${qualified[2]}`;
  return label;
}

export function dailyPlanArtifactToSlides(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
  const explicitSlides = explicitSlidesFromContent(artifact);
  if (explicitSlides.length > 0) {
    return explicitSlides;
  }

  const content = artifact.content_json;
  if (!content || typeof content !== "object") {
    return fallbackSlides(artifact.title);
  }

  const slides: TeachingPresentationSlide[] = [];
  let index = 0;
  slides.push(
    slide(
      {
        slideType: "title",
        title: String(content.title ?? artifact.title),
        bullets: asBullets(content.summary),
        teacherNotes: "Overview slide for the daily teaching plan.",
      },
      index++,
    ),
  );

  for (const subject of (content.subjects as Array<Record<string, unknown>> | undefined) ?? []) {
    const subjectName = String(subject.subject_name ?? "Subject");
    const notes = asBullets(subject.notes).join("\n");
    const teacherActions = asBullets(subject.teacher_actions);

    slides.push(
      slide(
        {
          slideType: "objective",
          title: `${subjectName} — Learning objective`,
          bullets: asBullets(subject.objective),
          teacherNotes: teacherActions.join("\n") || notes,
          subjectName,
          objectiveText: artifact.objective_mapping?.objective_text,
        },
        index++,
      ),
    );

    const materials = asBullets(subject.materials);
    if (materials.length > 0) {
      slides.push(
        slide(
          {
            slideType: "vocabulary",
            title: `${subjectName} — Vocabulary / materials`,
            bullets: materials,
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
    }

    if (teacherActions.length > 0) {
      slides.push(
        slide(
          {
            slideType: "warm_up",
            title: `${subjectName} — Warm-up`,
            bullets: teacherActions.slice(0, 2),
            teacherNotes: teacherActions.slice(2).join("\n"),
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
    }

    slides.push(
      slide(
        {
          slideType: "mini_lesson",
          title: `${subjectName} — Mini lesson`,
          bullets: asBullets(subject.mini_lesson),
          teacherNotes: notes,
          subjectName,
          objectiveText: artifact.objective_mapping?.objective_text,
        },
        index++,
      ),
    );

    const studentActivity = asBullets(subject.student_activity);
    if (studentActivity.length > 0) {
      slides.push(
        slide(
          {
            slideType: "guided_practice",
            title: `${subjectName} — Guided practice`,
            bullets: studentActivity.slice(0, Math.max(1, Math.ceil(studentActivity.length / 2))),
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
      if (studentActivity.length > 1) {
        slides.push(
          slide(
            {
              slideType: "independent_practice",
              title: `${subjectName} — Independent practice`,
              bullets: studentActivity.slice(Math.ceil(studentActivity.length / 2)),
              subjectName,
              objectiveText: artifact.objective_mapping?.objective_text,
            },
            index++,
          ),
        );
      }
    }

    const assessment = asBullets(subject.assessment);
    if (assessment.length > 0) {
      slides.push(
        slide(
          {
            slideType: "check_for_understanding",
            title: `${subjectName} — Check for understanding`,
            bullets: assessment,
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
      slides.push(
        slide(
          {
            slideType: "exit_ticket",
            title: `${subjectName} — Exit ticket`,
            bullets: assessment,
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
    }

    if (notes) {
      slides.push(
        slide(
          {
            slideType: "closing",
            title: `${subjectName} — Closing / next steps`,
            bullets: [notes],
            teacherNotes: notes,
            subjectName,
            objectiveText: artifact.objective_mapping?.objective_text,
          },
          index++,
        ),
      );
    }
  }

  return slides.length > 0 ? slides : fallbackSlides(artifact.title);
}

export function subjectDeckArtifactToSlides(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
  const explicitSlides = explicitSlidesFromContent(artifact);
  if (explicitSlides.length === 0) {
    const content = artifact.content_json;
    return fallbackSlides(String((content && typeof content === "object" && content.title) || artifact.title));
  }

  return explicitSlides.map((entry, index) => {
    const title = String(entry.title ?? `Slide ${index + 1}`);
    const lower = title.toLowerCase();
    let slideType = "content";
    if (index === 0) slideType = "title";
    else if (lower.includes("objective")) slideType = "objective";
    else if (lower.includes("vocab")) slideType = "vocabulary";
    else if (lower.includes("warm")) slideType = "warm_up";
    else if (lower.includes("mini")) slideType = "mini_lesson";
    else if (lower.includes("practice") || lower.includes("activity")) slideType = "guided_practice";
    else if (lower.includes("exit")) slideType = "exit_ticket";
    else if (lower.includes("close")) slideType = "closing";

    return slide(
      {
        id: entry.id,
        slideType,
        layoutType: entry.layoutType,
        title: entry.title,
        subtitle: entry.subtitle,
        body: entry.body,
        bullets: entry.bullets,
        teacherNotes: entry.teacherNotes,
        speakerNotes: entry.speakerNotes,
        discussionQuestion: entry.discussionQuestion,
        comparisonPairs: entry.comparisonPairs,
        subjectName: entry.subjectName ?? artifact.subject_name ?? undefined,
        layout: entry.layout,
        visualType: entry.visualType,
        visualRecommendation: entry.visualRecommendation,
        objectiveText: artifact.objective_mapping?.objective_text,
      },
      index,
    );
  });
}

export function studentLessonDeckArtifactToSlides(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
  const content = artifact.content_json;
  if (!content || typeof content !== "object" || !Array.isArray(content.slides)) {
    return fallbackSlides(artifact.title);
  }

  // Build a lookup from slide_id → asset data for ALL statuses (fetched, pending, failed).
  // The renderer decides what to show based on visual_generation_status.
  const assetBySlideId = new Map<string, {
    local_asset_key?: string | null;
    source_url?: string | null;
    attribution?: string | null;
    visual_generation_status: string;
  }>();
  const statusRank: Record<string, number> = { fetched: 2, pending: 1, failed: 0 };
  for (const asset of artifact.slide_visual_assets ?? []) {
    if (!asset.slide_id) continue;
    const incoming = asset.visual_generation_status ?? "pending";
    const existing = assetBySlideId.get(asset.slide_id);
    if (existing && (statusRank[existing.visual_generation_status] ?? 0) >= (statusRank[incoming] ?? 0)) continue;
    assetBySlideId.set(asset.slide_id, {
      local_asset_key: asset.local_asset_key,
      source_url: asset.source_url,
      attribution: asset.attribution,
      visual_generation_status: incoming,
    });
  }

  return content.slides
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, index) => {
      const slideId = typeof entry.id === "string" ? entry.id : `slide-${index + 1}`;
      let visual: SlideVisual | undefined = undefined;
      const rawVisual = entry.visual;
      if (rawVisual && typeof rawVisual === "object" && !Array.isArray(rawVisual)) {
        visual = rawVisual as SlideVisual;
        // Overlay the DB asset record so the renderer gets the authoritative status
        const slideAsset = assetBySlideId.get(slideId);
        if (slideAsset) {
          visual = {
            ...visual,
            local_asset_key: slideAsset.local_asset_key ?? visual.local_asset_key,
            source_url: slideAsset.source_url ?? visual.source_url,
            attribution: slideAsset.attribution ?? visual.attribution,
            visual_generation_status: slideAsset.visual_generation_status,
          };
        }
      }

      let engagement: SlideEngagement | undefined = undefined;
      const rawEngagement = entry.engagement;
      if (rawEngagement && typeof rawEngagement === "object" && !Array.isArray(rawEngagement)) {
        const eng = rawEngagement as Record<string, unknown>;
        if (typeof eng.type === "string" && typeof eng.prompt === "string") {
          engagement = { type: eng.type, prompt: eng.prompt };
        }
      }

      return slide(
        {
          id: slideId,
          slideType: typeof entry.slide_type === "string" ? entry.slide_type : "content",
          layout: typeof entry.layout === "string" ? entry.layout : undefined,
          title: typeof entry.title === "string" ? entry.title : `Slide ${index + 1}`,
          body: typeof entry.body === "string" ? entry.body : undefined,
          bullets: asBullets(entry.bullets),
          visual,
          engagement,
          // Legacy field compat
          discussionQuestion: typeof entry.student_question === "string" ? entry.student_question : undefined,
          teacherNotes: typeof entry.teacher_notes === "string"
            ? entry.teacher_notes
            : typeof entry.activity_prompt === "string" ? entry.activity_prompt : undefined,
          visualLearningGoal: typeof entry.visual_learning_goal === "string" ? entry.visual_learning_goal : undefined,
          studentEmotion: typeof entry.student_emotion === "string" ? entry.student_emotion : undefined,
          visualType: typeof entry.visual_cue === "string" ? entry.visual_cue : undefined,
          subjectName: artifact.subject_name ?? undefined,
          objectiveText: artifact.objective_mapping?.objective_text,
        },
        index,
      );
    });
}

export function buildSlidesForPresentation(
  artifact: InstructionalPackageArtifact | undefined,
): TeachingPresentationSlide[] {
  if (!artifact) return [];
  if (artifact.artifact_type === "daily_lesson_plan") {
    return dailyPlanArtifactToSlides(artifact);
  }
  if (artifact.artifact_type === "subject_slide_deck") {
    return subjectDeckArtifactToSlides(artifact);
  }
  if (artifact.artifact_type === "student_lesson_deck") {
    return studentLessonDeckArtifactToSlides(artifact);
  }
  return fallbackSlides(artifact.title);
}
