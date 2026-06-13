export type PacingGuideType = "DISTRICT" | "GRADE_LEVEL" | "TEACHER";
export type PacingGuidePeriodType = "YEAR" | "GRADING_PERIOD" | "UNIT" | "WEEK";
export type PacingSchoolYearRole = "current" | "next" | "above_next";

export type PacingSchoolYearOption = {
  id: string;
  title: string;
  role: PacingSchoolYearRole;
  start_date: string;
  end_date: string;
  is_default: boolean;
  is_active: boolean;
};

export type PacingSchoolYearOptions = {
  options: PacingSchoolYearOption[];
  default_school_year_id: string | null;
};

export type CatalogPacingGuideSummary = {
  id: string;
  tenant_id: string;
  school_year_id: string;
  school_year_label: string | null;
  guide_type: PacingGuideType;
  title: string;
  description: string | null;
  catalog_state_id: string | null;
  catalog_district_id: string | null;
  catalog_school_id: string | null;
  catalog_grade_id: string | null;
  catalog_subject_id: string | null;
  is_template: boolean;
  is_active: boolean;
  is_shared: boolean;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  period_count: number;
  created_at: string;
  updated_at: string;
};

export type CatalogPacingGuideObjective = {
  id: string;
  objective_id: string;
  is_required: boolean;
  notes: string | null;
  objective_code: string | null;
  objective_description: string | null;
};

export type CatalogPacingGuideResource = {
  id: string;
  catalog_resource_id: string | null;
  resource_library_item_id: string | null;
  is_primary: boolean;
  notes: string | null;
  resource_title: string | null;
  resource_type: string | null;
};

export type CatalogPacingGuidePeriod = {
  id: string;
  pacing_guide_id: string;
  period_type: PacingGuidePeriodType;
  title: string;
  description: string | null;
  sequence_number: number;
  start_date: string | null;
  end_date: string | null;
  objectives: CatalogPacingGuideObjective[];
  resources: CatalogPacingGuideResource[];
  created_at: string;
  updated_at: string;
};

export type CatalogPacingGuideDetail = CatalogPacingGuideSummary & {
  periods: CatalogPacingGuidePeriod[];
};

export const PACING_GUIDE_TYPE_OPTIONS: Array<{ value: PacingGuideType | ""; label: string }> = [
  { value: "", label: "All guide types" },
  { value: "DISTRICT", label: "District" },
  { value: "GRADE_LEVEL", label: "Grade level" },
  { value: "TEACHER", label: "Teacher" },
];

export const PACING_GUIDE_PERIOD_TYPE_OPTIONS: Array<{ value: PacingGuidePeriodType; label: string }> = [
  { value: "WEEK", label: "Week" },
  { value: "UNIT", label: "Unit" },
  { value: "GRADING_PERIOD", label: "Grading period" },
  { value: "YEAR", label: "Year" },
];
