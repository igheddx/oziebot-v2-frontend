export type TeacherAssistV2Role = "root_admin" | "admin" | "teacher";

export type TeacherAssistAiAdminConfig = {
  ai_mode: string;
  configured_provider: string;
  effective_mode: string;
  real_provider_enabled: boolean;
  openai_api_key_configured: boolean;
  openai_api_key_status: "configured" | "missing";
  real_provider_model: string | null;
  allowed_models: string[];
  daily_cost_limit_cents: number;
  daily_usage_cents: number;
  usage_summary: {
    window_hours: number;
    event_count: number;
    total_cost_cents: number;
    total_input_tokens: number;
    total_output_tokens: number;
    cost_cents_by_feature: Record<string, number>;
    daily_usage_cents: number;
  };
  ocr_provider: string;
  fixture_mode: string;
  circuit_state: string;
  circuit_reason: string | null;
  blockers: string[];
  config_source: "platform_settings" | "environment";
  persisted_config: {
    ai_provider: string;
    real_provider_enabled: boolean;
    real_provider_model: string | null;
    daily_cost_limit_cents?: number;
  } | null;
  persisted_updated_at: string | null;
  persisted_updated_by_user_id: string | null;
  last_updated_by: string | null;
  last_updated_at: string | null;
  teacher_banner_message: string;
  env_defaults: {
    ai_provider: string;
    real_provider_enabled: boolean;
    real_provider_model: string | null;
    daily_cost_limit_cents: number;
  };
  notes: string[];
};

export type TeacherAssistAiProviderConfigInput = {
  ai_provider: "mock" | "openai";
  real_provider_enabled: boolean;
  real_provider_model: string | null;
  daily_cost_limit_cents?: number | null;
};

export type TeacherAssistAiGenerationStatus = {
  ai_mode: "mock" | "real_openai";
  provider: string;
  model: string | null;
  banner_message: string;
  real_ai_enabled: boolean;
};

export type TeacherAssistV2Context = {
  has_access: boolean;
  role: TeacherAssistV2Role | null;
  landing_route: string;
  onboarding_complete: boolean;
  pacing_guide_setup_complete?: boolean;
  onboarding_progress_percent?: number;
  requires_password_change?: boolean;
  feature_locked?: boolean;
  feature_lock_message?: string | null;
  allowed_routes?: string[];
  ai_generation?: TeacherAssistAiGenerationStatus;
};

export type TeacherOnboardingForm = {
  assignment: {
    state_id: string;
    district_id: string;
    school_id: string;
    school_name: string;
  };
  school_years: Array<{ id: string; title: string; active: boolean }>;
  default_school_year_id: string | null;
  grades: Array<{ id: string; grade_code: string; display_name: string }>;
  assigned_grade_id: string | null;
  selected_school_year_id: string | null;
  selected_grade_id: string | null;
  selected_subject_ids: string[];
  subjects: Array<{ id: string; subject_code: string; display_name: string }>;
  student_count: number | null;
  onboarding_complete: boolean;
};

export type PacingGuideSetupForm = {
  school_year_title: string;
  grade_id: string;
  subjects: Array<{
    id: string;
    display_name: string;
    subject_code: string;
    available_guides: Array<{
      id: string;
      title: string;
      description: string | null;
      guide_type: string;
      school_year_label: string | null;
    }>;
  }>;
  existing_assignments: Array<{
    subject_id: string;
    pacing_guide_id: string;
    guide_scope: string;
    source_district_guide_id: string | null;
  }>;
  grade_level_guide_enabled: boolean;
  setup_complete: boolean;
};

export type TeacherHomeSummary = {
  school_year_title: string | null;
  school_name: string | null;
  grade_name: string | null;
  subjects: Array<{ id: string; display_name: string }>;
  active_pacing_guides: Array<{
    subject_id: string;
    subject_name: string;
    pacing_guide_id: string;
    pacing_guide_title: string;
    guide_scope: string;
  }>;
  ready_to_plan: boolean;
  package_dashboard?: PackageDashboard;
  recent_assignments?: AssignmentSummary[];
  assignments_requiring_review_count?: number;
  recent_grades_confirmed_count?: number;
  objectives_assessed_count?: number;
  mastery_alerts_count?: number;
};

export type AssignmentSummary = {
  id: string;
  title: string;
  assignment_type: string;
  week_number: number;
  subject_id: string;
  subject_name: string | null;
  status: string;
  creation_origin?: string;
  instructional_plan_id: string;
  created_at: string;
};

export type AssignmentCoverSheet = {
  packet_id: string;
  packet_kind: string;
  format: string;
  student_count: number;
  pages_per_student: number;
  download_url: string;
  title: string;
};

export type ManualAssignmentForm = {
  week_ranges: Array<{ week_start: number; week_end: number; label: string }>;
  subjects: Array<{
    subject_id: string;
    subject_name: string;
    pacing_guide_id: string;
    period_count: number;
  }>;
  assignment_types: string[];
  student_count: number;
  grade_id: string;
};

export type ManualAssignmentObjective = {
  education_objective_id: string;
  objective_code: string | null;
  description: string | null;
};

export type AssignmentDetail = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  status: string;
  creation_origin?: string;
  week_number: number;
  school_year_id: string;
  district_id: string;
  school_id: string | null;
  grade_id: string;
  subject_id: string;
  subject_name: string | null;
  instructional_plan_id: string;
  instructional_plan_title: string;
  pacing_guide_id: string;
  objectives: Array<{
    id: string;
    objective_id: string;
    description: string;
    objective_type: string;
    coverage_type: string;
  }>;
  artifacts: Array<{
    id: string;
    artifact_type: string;
    title: string;
    preview_html: string | null;
    download_url: string | null;
  }>;
  submission_summary?: SubmissionSummaryCounts;
  completion_summary?: AssignmentCompletionSummary;
  grade_reviews?: GradeReviewRow[];
  gradebook_summary?: GradebookSummary;
  objective_performance?: ObjectivePerformanceSummary[];
  google_connection?: GoogleFormsConnectionStatus;
  google_form?: AssignmentGoogleForm | null;
  cover_sheet?: AssignmentCoverSheet | null;
  assignment_rubric?: PackageRubricContent | null;
  rubric_template?: RubricGradingTemplate | null;
  rubric_score_report_available?: boolean;
  rubric_score_report_blocker?: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionSummaryCounts = {
  submitted_count: number;
  processing_count?: number;
  ready_for_review_count?: number;
  confirmed_count?: number;
  not_uploaded_count?: number;
  incomplete_count?: number;
  matched_count: number;
  needs_review_count: number;
  ready_for_grading_count: number;
  grading_complete_count: number;
  teacher_reviewed_count: number;
};

export type AssignmentCompletionSummary = {
  students_assigned_count: number;
  submissions_received_count: number;
  ai_drafts_generated_count: number;
  grades_confirmed_count: number;
  ready_for_review_count: number;
  reviewed_count: number;
  confirmed_count: number;
  rejected_count: number;
  pending_count: number;
};


export type GradebookSummary = {
  confirmed_grades_count: number;
  gradebook_sync_status: string;
  gradebook_records_count: number;
};

export type ObjectivePerformanceSummary = {
  objective_id: string;
  objective_code: string;
  description: string;
  students_assessed: number;
  average_score: number;
  average_percentage: number;
  mastery_count: number;
  developing_count: number;
  beginning_count: number;
  mastery_percentage: number;
  latest_assessment_at: string | null;
};

export type GradebookRecord = {
  id: string;
  assignment_id: string;
  assignment_title: string | null;
  instructional_package_id: string;
  pacing_guide_id: string;
  school_year_id: string;
  district_id: string;
  school_id: string | null;
  grade_id: string;
  subject_id: string;
  student_number: number;
  objective_ids: string[];
  assignment_grade_id: string;
  score: number;
  max_score: number;
  percentage: number;
  mastery_level?: string | null;
  mastery_level_label?: string | null;
  teacher_comment: string;
  confirmed_at: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
};

export type GradebookGridForm = {
  student_count: number;
  subjects: Array<{
    subject_id: string;
    subject_name: string;
    pacing_guide_id: string;
    pacing_guide_title: string;
    grading_periods: Array<{
      grading_period_id: string | null;
      title: string;
      week_numbers: number[];
    }>;
  }>;
};

export type GradebookGridCell = {
  has_grade: boolean;
  percentage: number | null;
  score?: number | null;
  max_score?: number | null;
  gradebook_record_id?: string;
  mastery_level: string;
  mastery_level_label: string;
  mastery_level_short?: string;
};

export type GradebookGrid = {
  subject_id: string;
  pacing_guide_id: string;
  pacing_guide_title: string;
  grading_period_id: string | null;
  grading_period_title: string;
  week_numbers: number[];
  student_count: number;
  teks_groups: Array<{
    objective_id: string;
    objective_code: string;
    objective_description: string | null;
    assignments: Array<{
      assignment_id: string;
      title: string;
      week_number: number;
      assignment_type: string;
      creation_origin: string;
      column_key: string;
    }>;
  }>;
  columns: Array<{
    column_key: string;
    column_kind: "assignment" | "teks_summary";
    objective_id: string;
    objective_code: string;
    assignment_id?: string;
    title: string;
    week_number?: number;
  }>;
  rows: Array<{
    student_number: number;
    student_label: string;
    cells: Record<string, GradebookGridCell>;
  }>;
};

export type MasteryEvidenceRow = {
  id: string;
  student_number: number;
  education_objective_id: string;
  objective_label: string | null;
  assignment_id: string;
  gradebook_record_id: string;
  assignment_grade_id: string;
  evidence_type: string;
  score: number;
  percentage: number;
  mastery_level?: string | null;
  mastery_level_label?: string | null;
  teacher_confirmed: boolean;
  is_current: boolean;
  created_at: string;
};

export type GradeReviewRow = {
  student_submission_id: string;
  student_number: number | null;
  draft_score: number | null;
  draft_max_score: number | null;
  draft_percentage: number | null;
  draft_mastery_level: string | null;
  draft_mastery_level_label: string | null;
  review_status: string;
  grade_status: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  official_score: number | null;
  official_max_score: number | null;
  official_percentage: number | null;
  official_mastery_level: string | null;
  official_mastery_level_label: string | null;
  teacher_viewed: boolean;
  has_grading_draft: boolean;
};

export type AssignmentGrade = {
  id: string;
  assignment_id: string;
  student_submission_id: string;
  student_number: number | null;
  grading_draft_id: string | null;
  score: number;
  max_score: number;
  percentage: number;
  mastery_level?: string | null;
  mastery_level_label?: string | null;
  rubric_json: GradingDraft["rubric_json"];
  teacher_comment: string;
  teacher_override_reason: string | null;
  review_action: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_official: boolean;
};

export type GradeAuditEvent = {
  id: string;
  assignment_grade_id: string;
  assignment_id: string;
  student_submission_id: string;
  grading_draft_id: string | null;
  original_ai_score: number | null;
  original_ai_max_score: number | null;
  final_score: number;
  final_max_score: number;
  score_difference: number | null;
  teacher_override_reason: string | null;
  review_action: string;
  teacher_comment: string;
  rubric_json: GradingDraft["rubric_json"];
  reviewer_user_id: string;
  created_at: string;
};

export type SubmissionBatch = {
  id: string;
  assignment_id: string;
  status: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  submission_count: number;
};

export type StudentSubmissionSummary = {
  id: string;
  assignment_id: string;
  submission_batch_id: string;
  student_number: number | null;
  status: string;
  match_method: string;
  page_range?: string | null;
  original_filename: string;
  created_at: string;
  has_grading_draft?: boolean;
};

export type GradingDraft = {
  id: string;
  score: number;
  max_score: number;
  percentage: number;
  mastery_level?: string | null;
  mastery_level_label?: string | null;
  rubric_json: {
    sections: Array<{
      name: string;
      score: number;
      max_score: number;
      feedback: string;
    }>;
  };
  teacher_comment_draft: string;
  strengths: string[];
  improvements: string[];
  objective_evidence: Array<{
    objective_id: string;
    evidence: string;
  }>;
  confidence_score: number;
  provider: string;
  model: string | null;
  created_at: string;
  teacher_review_required: boolean;
};

export type DocumentExtraction = {
  id: string;
  status: string;
  provider: string | null;
  error_message: string | null;
  character_count: number | null;
  token_estimate: number | null;
  preview: string | null;
  extracted_text_preview: string | null;
  effective_text_excerpt?: string | null;
  teacher_edited_text?: string | null;
  effective_text?: string | null;
  extracted_text?: string | null;
  has_extracted_text: boolean;
  has_teacher_edited_text: boolean;
  has_usable_text: boolean;
  manual_override: boolean;
  created_at: string;
  updated_at: string;
};

export type GradingJob = {
  id: string;
  assignment_id: string;
  student_submission_id: string;
  status: string;
  provider: string;
  model: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  draft?: GradingDraft;
};

export type StudentSubmissionDetail = {
  id: string;
  assignment_id: string;
  assignment_title: string;
  submission_batch_id: string;
  student_number: number | null;
  status: string;
  match_method: string;
  packet_id: string | null;
  page_range: string | null;
  qr_identifier: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number;
  download_url: string | null;
  preview_url: string | null;
  objectives: Array<{
    id: string;
    objective_id: string;
    description: string;
  }>;
  created_at: string;
  updated_at: string;
  grading_draft?: GradingDraft | null;
  assignment_grade?: AssignmentGrade | null;
  teacher_viewed_for_review?: boolean;
  assignment_rubric?: PackageRubricContent | null;
  rubric_template?: RubricGradingTemplate | null;
  extraction?: DocumentExtraction | null;
  student_response_text?: string | null;
  ai_grading_ready?: boolean;
  ai_grading_blocker?: string | null;
};

export type AdminTeacherRow = {
  assignment_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  state_name: string | null;
  district_name: string | null;
  school_name: string | null;
  onboarding: {
    onboarding_complete: boolean;
    pacing_guide_setup_complete: boolean;
  };
};

export type TeacherProvisionResult = {
  user_id: string;
  email: string;
  full_name: string | null;
  created_user: boolean;
  temporary_password: string | null;
  grade_setup_applied: boolean;
  assignment_id: string;
};

export type EducationStateRow = {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
};

export type EducationDistrictRow = {
  id: string;
  state_id: string;
  name: string;
  district_code: string | null;
  active: boolean;
};

export type EducationSchoolRow = {
  id: string;
  district_id: string;
  name: string;
  school_type: string | null;
  active: boolean;
};

export type EducationGradeRow = {
  id: string;
  school_id: string | null;
  grade_code: string;
  display_name: string;
  active: boolean;
};

export type EducationSubjectRow = {
  id: string;
  grade_id: string | null;
  subject_code: string;
  display_name: string;
  active: boolean;
};

export type HierarchySubjectNode = {
  id: string;
  type: "subject";
  subject_code: string;
  display_name: string;
  active: boolean;
};

export type HierarchyGradeNode = {
  id: string;
  type: "grade";
  grade_code: string;
  display_name: string;
  active: boolean;
  subjects: HierarchySubjectNode[];
};

export type HierarchySchoolNode = {
  id: string;
  type: "school";
  name: string;
  school_type: string | null;
  active: boolean;
  grades: HierarchyGradeNode[];
};

export type HierarchyDistrictNode = {
  id: string;
  type: "district";
  name: string;
  district_code: string | null;
  active: boolean;
  schools: HierarchySchoolNode[];
};

export type HierarchyStateNode = {
  id: string;
  type: "state";
  name: string;
  abbreviation: string;
  active: boolean;
  districts: HierarchyDistrictNode[];
};

export type EducationSchoolYearRow = {
  id: string;
  state_id: string;
  district_id: string | null;
  school_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  active: boolean;
};

export type EducationObjectiveRow = {
  id: string;
  state_id: string;
  district_id: string | null;
  school_id: string | null;
  grade_id: string | null;
  subject_id: string | null;
  school_year_id: string | null;
  grade_level: string;
  subject_code: string;
  objective_type: string;
  objective_id: string;
  description: string;
  coverage_type: string;
  active: boolean;
};

export type PacingGuideSummary = {
  id: string;
  title: string;
  description: string | null;
  guide_type: string;
  school_year_label: string | null;
  catalog_state_id?: string | null;
  catalog_district_id: string | null;
  catalog_school_id?: string | null;
  catalog_grade_id: string | null;
  catalog_subject_id: string | null;
  period_count: number;
  objective_count?: number;
  resource_count?: number;
  scope_label?: string | null;
  grade_name?: string | null;
  subject_name?: string | null;
  platform_school_year_id?: string | null;
  ownership_scope?: "district" | "school" | null;
  unit_title?: string | null;
  estimated_duration_weeks?: number | null;
  start_week?: number | null;
  end_week?: number | null;
  is_active: boolean;
};

export type PacingGuideDailyPlan = {
  id?: string | null;
  day_label: string;
  sequence_number?: number | null;
  daily_topic?: string | null;
  objective_focus?: string | null;
  teacher_notes?: string | null;
  materials_needed?: string | null;
  assessment_check?: string | null;
};

export type PacingGuidePeriod = {
  id: string;
  title: string;
  description: string | null;
  sequence_number: number;
  unit_title?: string | null;
  daily_plans?: PacingGuideDailyPlan[];
  objectives: Array<{
    id: string;
    objective_id: string;
    objective_code: string | null;
    objective_description: string | null;
    notes: string | null;
  }>;
};

export type PacingGuideSupportingMaterial = {
  id: string;
  pacing_guide_id: string;
  period_id: string | null;
  period_day_id?: string | null;
  education_objective_id: string | null;
  material_kind: "file" | "link" | "note";
  resource_type: string;
  title: string;
  description: string | null;
  note_body: string | null;
  external_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  download_url: string | null;
  source_resource_id?: string | null;
  source_pacing_guide_id?: string | null;
  active: boolean;
  archived_at?: string | null;
  extraction?: DocumentExtraction | null;
};

export type PacingGuideDetail = PacingGuideSummary & {
  periods: PacingGuidePeriod[];
};

export type PacingGuideBuilderPayload = {
  catalog_state_id: string;
  catalog_district_id: string;
  catalog_school_id?: string | null;
  platform_school_year_id: string;
  catalog_grade_id: string;
  catalog_subject_id: string;
  ownership_scope: "district" | "school";
  title: string;
  description?: string | null;
  unit_title?: string | null;
  estimated_duration_weeks?: number | null;
  start_week?: number | null;
  end_week?: number | null;
  objectives: Array<{ objective_id: string; is_required: boolean; notes?: string | null }>;
  weeks: Array<{
    title: string;
    description?: string | null;
    sequence_number?: number;
    unit_title?: string | null;
    daily_plans: PacingGuideDailyPlan[];
    objective_ids?: string[];
  }>;
};

export type PlanningForm = {
  school_year: { id: string; title: string; active: boolean };
  grade_id: string;
  subjects: Array<{
    subject_id: string;
    subject_code: string;
    subject_name: string;
    pacing_guide_id: string;
    pacing_guide_title: string;
    guide_scope: string;
    period_count: number;
    available_pacing_guides?: Array<{
      id: string;
      title: string;
      description: string | null;
      school_year_label: string | null;
      scope_label: string;
      is_selected: boolean;
    }>;
  }>;
  week_ranges: Array<{ week_start: number; week_end: number; label: string }>;
  default_teaching_order: string[];
  default_plan_start_date: string;
  default_plan_end_date: string;
  required_outputs: string[];
  optional_outputs: string[];
};

export type PlanningPacingDay = {
  day_label: string;
  sequence_number: number;
  daily_topic: string | null;
  objective_focus: string | null;
  teacher_notes?: string | null;
  materials_needed?: string | null;
  assessment_check?: string | null;
};

export type PlanningReview = {
  week_start: number;
  week_end: number;
  weeks: Array<{
    sequence_number: number;
    title: string;
    start_date: string | null;
    end_date: string | null;
    subjects: Array<{
      subject_id: string;
      subject_name: string;
      pacing_guide_id: string;
      period_id: string;
      daily_topic: string | null;
      pacing_days: PlanningPacingDay[];
      objectives: Array<{
        education_objective_id: string;
        objective_code: string | null;
        description: string | null;
      }>;
      district_materials: PacingGuideSupportingMaterial[];
    }>;
  }>;
  teacher_supplemental_materials: PlanningSupplementalMaterial[];
  ai_readiness_summary?: {
    district_resources_loaded: number;
    teacher_materials_loaded: number;
    uploaded_file_count: number;
    extracted_text_available_count: number;
    files_completed_count: number;
    files_failed_count: number;
    files_pending_count: number;
    continue_with_filenames_only: boolean;
  };
  default_plan_start_date: string;
  default_plan_end_date: string;
};

export type PlanningSupplementalMaterial = {
  id: string;
  material_kind: string;
  resource_type: string;
  title: string;
  description?: string | null;
  note_body?: string | null;
  external_url?: string | null;
  download_url?: string | null;
  extraction?: DocumentExtraction | null;
};

export type InstructionalPackageSummary = {
  id: string;
  title: string;
  subject_names: string[];
  week_start: number;
  week_end: number;
  plan_start_date: string;
  plan_end_date: string;
  stored_status: string;
  status: string;
  status_message: string | null;
  can_close_out: boolean;
  download_url: string | null;
  created_at: string;
  closed_at: string | null;
};

export type PackageDashboard = {
  current_package: InstructionalPackageSummary | null;
  upcoming_packages: InstructionalPackageSummary[];
  ending_soon_packages: InstructionalPackageSummary[];
  expired_packages: InstructionalPackageSummary[];
  recently_generated_packages: InstructionalPackageSummary[];
};

export type InstructionalPackageDetail = {
  id: string;
  title: string;
  status: string;
  stored_status: string;
  status_message: string | null;
  week_start: number;
  week_end: number;
  plan_start_date: string;
  plan_end_date: string;
  teaching_order: string[];
  selected_outputs: string[];
  provider_name: string | null;
  generation_document_usage?: {
    district?: {
      used_documents: Array<{ title: string; extraction_status: string; included_characters: number; excerpt: string }>;
      skipped_documents: Array<{ title: string; extraction_status: string; reason: string }>;
    } | null;
    teacher?: {
      used_documents: Array<{ title: string; extraction_status: string; included_characters: number; excerpt: string }>;
      skipped_documents: Array<{ title: string; extraction_status: string; reason: string }>;
    } | null;
  } | null;
  ai_readiness_summary?: PlanningReview["ai_readiness_summary"];
  created_at: string;
  can_close_out: boolean;
  close_out_notes: string | null;
  closed_at: string | null;
  district_materials: PlanningSupplementalMaterial[];
  teacher_supplemental_materials: PlanningSupplementalMaterial[];
  artifact_groups: Record<
    string,
    Array<InstructionalPackageArtifact>
  >;
  artifacts?: InstructionalPackageArtifact[];
  teaching_mode_available?: boolean;
  teaching_presentations?: {
    daily_plans: Array<{ artifact_id: string; day_label: string | null; title: string }>;
    subject_decks: Array<{
      artifact_id: string;
      subject_id: string | null;
      subject_name: string | null;
      title: string;
    }>;
  };
  qr_student_packet?: QrStudentPacket | null;
  google_connection?: GoogleFormsConnectionStatus;
};

export type ArtifactDownload = {
  label: string;
  format: string;
  download_url: string;
};

export type TeacherAiReadiness = {
  ai_generation: TeacherAssistAiGenerationStatus;
  supported_document_types: string[];
  checks: Array<{
    key: string;
    label: string;
    status: "green" | "yellow" | "red";
    detail: string;
  }>;
};

export type QrStudentPacket = {
  packet_id: string;
  title: string;
  student_count: number;
  preview_html?: string;
  download_url?: string | null;
};

export type GoogleFormsConnectionStatus = {
  connected: boolean;
  google_email: string | null;
  connected_at: string | null;
  scopes: string[];
  integration_ready: boolean;
  server_integration_ready?: boolean;
};

export type AssignmentGoogleForm = {
  id: string;
  assignment_id: string;
  artifact_id: string;
  google_form_id: string;
  google_form_url: string;
  google_edit_url: string;
  google_response_url: string | null;
  google_created_at: string;
  google_sync_status: string;
  last_import_at: string | null;
  last_import_count: number | null;
};

export type AdminGoogleSettings = {
  oauth_client_configured: boolean;
  oauth_client_secret_configured: boolean;
  token_encryption_configured: boolean;
  integration_ready: boolean;
  redirect_uri: string;
  required_scopes: string[];
  setup_instructions: string[];
  notes: string[];
};

export type PackageRubricContent = {
  title: string;
  summary?: string | null;
  description?: string | null;
  total_points?: number;
  criteria: PackageRubricCriterion[];
  writing_prompt?: string | null;
  assignment_title?: string | null;
};

export type RubricGradingTemplate = {
  title: string;
  total_points: number;
  criteria: PackageRubricCriterion[];
  sections: Array<{
    name: string;
    score: number;
    max_score: number;
    feedback: string;
  }>;
};

export type PackageRubricCriterion = {
  name: string;
  points: number;
  levels: string[];
};

export type PackageAdditionalAssignmentForm = {
  package_id: string;
  subjects: Array<{ subject_id: string; subject_name: string }>;
  assignment_types: Array<{ id: string; label: string }>;
  existing_assignments: Array<{
    artifact_id: string;
    assignment_id: string | null;
    artifact_type: string;
    title: string;
    subject_id: string | null;
    is_additional: boolean;
  }>;
};

export type InstructionalPackageArtifact = {
  id: string;
  artifact_type: string;
  title: string;
  day_label: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  status?: string;
  description?: string | null;
  linked_rubric_artifact_id?: string | null;
  linked_writing_response_artifact_id?: string | null;
  teacher_edited?: boolean;
  package_additional?: boolean;
  objective_mapping?: {
    objective_code?: string;
    objective_text?: string;
    daily_topic?: string;
    standard_set?: string;
    objective_ids?: string[];
    teks_ids?: string[];
    alignment_summary?: string | null;
  } | null;
  objective_ids?: string[];
  teks_ids?: string[];
  alignment_summary?: string | null;
  preview_html: string | null;
  download_url: string | null;
  export_available: boolean;
  additional_downloads?: ArtifactDownload[];
  slide_visual_assets?: SlideVisualAsset[];
  qr_student_packet?: QrStudentPacket;
  content_json?: Record<string, unknown>;
  assignment_id?: string | null;
  google_form?: AssignmentGoogleForm | null;
};

export type SlideVisualRecommendation = {
  visualType?: string;
  title?: string;
  description?: string;
  educationalPurpose?: string;
  suggestedPlacement?: string;
  suggestedSources?: string[];
  searchTerms?: string[];
  sourceType?: string;
  sourceUrl?: string | null;
  attribution?: string | null;
  promptHint?: string | null;
  layoutTemplate?: string | null;
  visualGenerationStatus?: string | null;
};

export type SlideVisualAsset = {
  id: string;
  slide_id: string;
  visual_type: string;
  title?: string | null;
  description?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  attribution?: string | null;
  local_asset_key?: string | null;
  prompt_hint?: string | null;
  educational_purpose?: string | null;
  suggested_placement?: string | null;
  layout_template?: string | null;
  visual_generation_status?: string | null;
  search_terms?: string[];
  suggested_sources?: string[];
  created_at?: string;
};

export type TeachingPresentationSlide = {
  id: string;
  slideType: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  teacherNotes?: string;
  subjectName?: string;
  layout?: string;
  visualType?: string;
  visualRecommendation?: SlideVisualRecommendation | null;
  objectiveText?: string;
};

export type ArchiveCheck = {
  can_archive: boolean;
  dependencies: string[];
};

export type AdminDashboard = {
  states: number;
  districts: number;
  schools: number;
  grades: number;
  subjects: number;
};
