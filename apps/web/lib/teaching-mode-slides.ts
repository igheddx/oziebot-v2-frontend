import type { InstructionalPackageArtifact, TeachingPresentationSlide } from "@/lib/teacher-assist-v2-types";

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
    title: partial.title,
    subtitle: partial.subtitle,
    bullets: partial.bullets,
    teacherNotes: partial.teacherNotes,
    subjectName: partial.subjectName,
    layout: partial.layout,
    visualType: partial.visualType,
  };
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

export function sortDailyPlans<T extends { day_label: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftIndex = WEEKDAY_ORDER.indexOf(left.day_label ?? "");
    const rightIndex = WEEKDAY_ORDER.indexOf(right.day_label ?? "");
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}

export function dailyPlanArtifactToSlides(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
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
          },
          index++,
        ),
      );
    }
  }

  return slides.length > 0 ? slides : fallbackSlides(artifact.title);
}

export function subjectDeckArtifactToSlides(artifact: InstructionalPackageArtifact): TeachingPresentationSlide[] {
  const content = artifact.content_json;
  if (!content || typeof content !== "object") {
    return fallbackSlides(artifact.title);
  }

  const rawSlides = (content.slides as Array<Record<string, unknown>> | undefined) ?? [];
  if (rawSlides.length === 0) {
    return fallbackSlides(String(content.title ?? artifact.title));
  }

  return rawSlides.map((entry, index) => {
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
        slideType,
        title,
        subtitle: entry.subtitle ? String(entry.subtitle) : undefined,
        bullets: asBullets(entry.bullets),
        teacherNotes: entry.teacherNotes ? String(entry.teacherNotes) : undefined,
        subjectName: artifact.subject_name ?? undefined,
        layout: entry.layout ? String(entry.layout) : undefined,
        visualType: entry.visualType ? String(entry.visualType) : undefined,
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
  return fallbackSlides(artifact.title);
}
