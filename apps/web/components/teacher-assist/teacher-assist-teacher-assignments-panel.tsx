"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherAssistFormErrorSummary } from "@/components/teacher-assist/teacher-assist-form-error-summary";
import {
  TeacherAssistInlineAlert,
  sectionError,
  sectionSuccess,
  useTeacherAssistSectionAlerts,
} from "@/components/teacher-assist/teacher-assist-inline-alert";
import {
  fetchCatalogAvailableTeachers,
  fetchCatalogTeacherAssignments,
  provisionCatalogTeacherAssignment,
} from "@/lib/education-catalog-api";
import type {
  EducationDistrict,
  EducationGrade,
  EducationSchool,
  EducationState,
  TeacherSchoolAssignmentListItem,
} from "@/lib/education-catalog-types";
import { withPreservedScroll } from "@/lib/teacher-assist-scroll";

type Props = {
  states: EducationState[];
  districts: EducationDistrict[];
  schools: EducationSchool[];
  grades: EducationGrade[];
  onRefreshCatalog: () => Promise<void>;
};

type PlacementForm = {
  state_id: string;
  district_id: string;
  school_id: string;
  catalog_grade_id: string;
};

type NewTeacherForm = {
  email: string;
  full_name: string;
  tenant_name: string;
};

const emptyPlacement = (): PlacementForm => ({
  state_id: "",
  district_id: "",
  school_id: "",
  catalog_grade_id: "",
});

export function TeacherAssistTeacherAssignmentsPanel({
  states,
  districts,
  schools,
  grades,
  onRefreshCatalog,
}: Props) {
  const { setSectionAlert, clearSectionAlert, getSectionAlert } = useTeacherAssistSectionAlerts();
  const [assignments, setAssignments] = useState<TeacherSchoolAssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [filterStateId, setFilterStateId] = useState("");
  const [filterDistrictId, setFilterDistrictId] = useState("");
  const [filterSchoolId, setFilterSchoolId] = useState("");

  const [assignPlacement, setAssignPlacement] = useState<PlacementForm>(emptyPlacement);
  const [createPlacement, setCreatePlacement] = useState<PlacementForm>(emptyPlacement);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherResults, setTeacherResults] = useState<Awaited<ReturnType<typeof fetchCatalogAvailableTeachers>>>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const [newTeacherForm, setNewTeacherForm] = useState<NewTeacherForm>({
    email: "",
    full_name: "",
    tenant_name: "",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState<string | null>(null);
  const [lastProvisionEmail, setLastProvisionEmail] = useState<string | null>(null);

  const filterDistricts = useMemo(
    () => districts.filter((row) => !filterStateId || row.state_id === filterStateId),
    [districts, filterStateId],
  );
  const filterSchools = useMemo(
    () => schools.filter((row) => !filterDistrictId || row.district_id === filterDistrictId),
    [schools, filterDistrictId],
  );

  const assignDistricts = useMemo(
    () => districts.filter((row) => !assignPlacement.state_id || row.state_id === assignPlacement.state_id),
    [districts, assignPlacement.state_id],
  );
  const assignSchools = useMemo(
    () => schools.filter((row) => !assignPlacement.district_id || row.district_id === assignPlacement.district_id),
    [schools, assignPlacement.district_id],
  );
  const assignGrades = useMemo(
    () => grades.filter((row) => !assignPlacement.school_id || row.school_id === assignPlacement.school_id),
    [grades, assignPlacement.school_id],
  );

  const createDistricts = useMemo(
    () => districts.filter((row) => !createPlacement.state_id || row.state_id === createPlacement.state_id),
    [districts, createPlacement.state_id],
  );
  const createSchools = useMemo(
    () => schools.filter((row) => !createPlacement.district_id || row.district_id === createPlacement.district_id),
    [schools, createPlacement.district_id],
  );
  const createGrades = useMemo(
    () => grades.filter((row) => !createPlacement.school_id || row.school_id === createPlacement.school_id),
    [grades, createPlacement.school_id],
  );

  const refreshAssignments = useCallback(async () => {
    setListError(null);
    try {
      const rows = await fetchCatalogTeacherAssignments({
        stateId: filterStateId || undefined,
        districtId: filterDistrictId || undefined,
        schoolId: filterSchoolId || undefined,
      });
      setAssignments(rows);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load teacher assignments.");
    } finally {
      setLoading(false);
    }
  }, [filterDistrictId, filterSchoolId, filterStateId]);

  useEffect(() => {
    void refreshAssignments();
  }, [refreshAssignments]);

  useEffect(() => {
    if (!assignPlacement.school_id) {
      setTeacherResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearchLoading(true);
      void fetchCatalogAvailableTeachers(assignPlacement.school_id, teacherSearch || undefined)
        .then(setTeacherResults)
        .catch(() => setTeacherResults([]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [assignPlacement.school_id, teacherSearch]);

  const runProvision = async (
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    clearSectionAlert("teacher-assignments");
    setLastTemporaryPassword(null);
    setLastProvisionEmail(null);
    try {
      await withPreservedScroll("teacher-assignments-panel", async () => {
        const result = await provisionCatalogTeacherAssignment(body);
        if (result.temporary_password) {
          setLastTemporaryPassword(result.temporary_password);
          setLastProvisionEmail(result.email);
        }
        await onRefreshCatalog();
        await refreshAssignments();
      });
      setSectionAlert("teacher-assignments", sectionSuccess(successMessage));
      setSelectedTeacherId("");
      setTeacherSearch("");
    } catch (error) {
      setSectionAlert("teacher-assignments", sectionError(error instanceof Error ? error.message : "Save failed."));
    }
  };

  const masonDefault = useMemo(() => {
    const texas = states.find((row) => row.abbreviation === "TX");
    const leander = districts.find((row) => row.name.includes("Leander"));
    const mason = schools.find((row) => row.name === "Mason Elementary");
    const grade5 = grades.find((row) => row.grade_code === "5" && row.school_id === mason?.id);
    return { texas, leander, mason, grade5 };
  }, [districts, grades, schools, states]);

  useEffect(() => {
    if (!assignPlacement.state_id && masonDefault.texas) {
      setAssignPlacement((current) => ({
        ...current,
        state_id: masonDefault.texas?.id ?? "",
        district_id: masonDefault.leander?.id ?? "",
        school_id: masonDefault.mason?.id ?? "",
        catalog_grade_id: masonDefault.grade5?.id ?? "",
      }));
      setCreatePlacement((current) => ({
        ...current,
        state_id: masonDefault.texas?.id ?? "",
        district_id: masonDefault.leander?.id ?? "",
        school_id: masonDefault.mason?.id ?? "",
        catalog_grade_id: masonDefault.grade5?.id ?? "",
      }));
    }
  }, [assignPlacement.state_id, masonDefault]);

  const alert = getSectionAlert("teacher-assignments");

  return (
    <div id="teacher-assignments-panel" className="mt-5 space-y-6">
      <TeacherAssistInlineAlert alert={alert} />
      {lastTemporaryPassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Temporary password for {lastProvisionEmail}</p>
          <p className="mt-1 font-mono text-base">{lastTemporaryPassword}</p>
          <p className="mt-2 text-xs">Share this once. The teacher should change it after first login.</p>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Filter assignments</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="ta-input"
            value={filterStateId}
            onChange={(event) => {
              setFilterStateId(event.target.value);
              setFilterDistrictId("");
              setFilterSchoolId("");
            }}
          >
            <option value="">All states</option>
            {states.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="ta-input"
            value={filterDistrictId}
            onChange={(event) => {
              setFilterDistrictId(event.target.value);
              setFilterSchoolId("");
            }}
            disabled={!filterStateId}
          >
            <option value="">All districts</option>
            {filterDistricts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="ta-input"
            value={filterSchoolId}
            onChange={(event) => setFilterSchoolId(event.target.value)}
            disabled={!filterDistrictId}
          >
            <option value="">All schools</option>
            {filterSchools.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Assign existing teacher</h3>
          <button
            type="button"
            className="ta-button-secondary"
            onClick={() => setShowCreateForm((value) => !value)}
          >
            {showCreateForm ? "Hide new teacher form" : "Create new teacher profile"}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Search teachers with Teacher Assist access who are not currently assigned to the selected school.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="ta-input"
            value={assignPlacement.state_id}
            onChange={(event) =>
              setAssignPlacement({
                state_id: event.target.value,
                district_id: "",
                school_id: "",
                catalog_grade_id: "",
              })
            }
          >
            <option value="">Select state</option>
            {states.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="ta-input"
            value={assignPlacement.district_id}
            onChange={(event) =>
              setAssignPlacement((current) => ({
                ...current,
                district_id: event.target.value,
                school_id: "",
                catalog_grade_id: "",
              }))
            }
            disabled={!assignPlacement.state_id}
          >
            <option value="">Select district</option>
            {assignDistricts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="ta-input"
            value={assignPlacement.school_id}
            onChange={(event) =>
              setAssignPlacement((current) => ({
                ...current,
                school_id: event.target.value,
                catalog_grade_id: "",
              }))
            }
            disabled={!assignPlacement.district_id}
          >
            <option value="">Select school</option>
            {assignSchools.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="ta-input"
            value={assignPlacement.catalog_grade_id}
            onChange={(event) =>
              setAssignPlacement((current) => ({ ...current, catalog_grade_id: event.target.value }))
            }
            disabled={!assignPlacement.school_id}
          >
            <option value="">Grade optional — collect during onboarding</option>
            {assignGrades.map((row) => (
              <option key={row.id} value={row.id}>
                {row.display_name}
              </option>
            ))}
          </select>
        </div>
        <input
          className="ta-input"
          placeholder="Search by name or email"
          value={teacherSearch}
          onChange={(event) => setTeacherSearch(event.target.value)}
          disabled={!assignPlacement.school_id}
        />
        <select
          className="ta-input"
          value={selectedTeacherId}
          onChange={(event) => setSelectedTeacherId(event.target.value)}
          disabled={!assignPlacement.school_id || searchLoading}
        >
          <option value="">
            {searchLoading ? "Searching…" : "Select teacher"}
          </option>
          {teacherResults.map((row) => (
            <option key={row.user_id} value={row.user_id}>
              {row.full_name ? `${row.full_name} · ${row.email}` : row.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ta-button-primary"
          disabled={
            !selectedTeacherId ||
            !assignPlacement.state_id ||
            !assignPlacement.district_id ||
            !assignPlacement.school_id
          }
          onClick={() => {
            void runProvision(
              {
                user_id: selectedTeacherId,
                state_id: assignPlacement.state_id,
                district_id: assignPlacement.district_id,
                school_id: assignPlacement.school_id,
                catalog_grade_id: assignPlacement.catalog_grade_id || null,
                active: true,
              },
              "Teacher assigned to school.",
            );
          }}
        >
          Assign selected teacher
        </button>
      </section>

      {showCreateForm ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Create new teacher profile</h3>
          <p className="text-xs text-slate-600">
            Creates a Teacher Assist account, assigns the school, and generates a temporary password.
          </p>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runProvision(
                {
                  email: newTeacherForm.email.trim(),
                  full_name: newTeacherForm.full_name.trim(),
                  tenant_name: newTeacherForm.tenant_name.trim() || null,
                  state_id: createPlacement.state_id,
                  district_id: createPlacement.district_id,
                  school_id: createPlacement.school_id,
                  catalog_grade_id: createPlacement.catalog_grade_id || null,
                  active: true,
                },
                "Teacher profile created and assigned.",
              );
            }}
          >
            <input
              className="ta-input"
              placeholder="Email"
              type="email"
              required
              value={newTeacherForm.email}
              onChange={(event) => setNewTeacherForm((current) => ({ ...current, email: event.target.value }))}
            />
            <input
              className="ta-input"
              placeholder="Full name"
              required
              value={newTeacherForm.full_name}
              onChange={(event) => setNewTeacherForm((current) => ({ ...current, full_name: event.target.value }))}
            />
            <input
              className="ta-input md:col-span-2"
              placeholder="Tenant name (optional)"
              value={newTeacherForm.tenant_name}
              onChange={(event) => setNewTeacherForm((current) => ({ ...current, tenant_name: event.target.value }))}
            />
            <select
              className="ta-input"
              required
              value={createPlacement.state_id}
              onChange={(event) =>
                setCreatePlacement({
                  state_id: event.target.value,
                  district_id: "",
                  school_id: "",
                  catalog_grade_id: "",
                })
              }
            >
              <option value="">Select state</option>
              {states.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="ta-input"
              required
              value={createPlacement.district_id}
              onChange={(event) =>
                setCreatePlacement((current) => ({
                  ...current,
                  district_id: event.target.value,
                  school_id: "",
                  catalog_grade_id: "",
                }))
              }
              disabled={!createPlacement.state_id}
            >
              <option value="">Select district</option>
              {createDistricts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="ta-input"
              required
              value={createPlacement.school_id}
              onChange={(event) =>
                setCreatePlacement((current) => ({
                  ...current,
                  school_id: event.target.value,
                  catalog_grade_id: "",
                }))
              }
              disabled={!createPlacement.district_id}
            >
              <option value="">Select school</option>
              {createSchools.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              className="ta-input"
              value={createPlacement.catalog_grade_id}
              onChange={(event) =>
                setCreatePlacement((current) => ({ ...current, catalog_grade_id: event.target.value }))
              }
              disabled={!createPlacement.school_id}
            >
              <option value="">Grade optional — collect during onboarding</option>
              {createGrades.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.display_name}
                </option>
              ))}
            </select>
            <button type="submit" className="ta-button-primary md:col-span-2">
              Create teacher and assign
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Current assignments</h3>
        {listError ? <TeacherAssistFormErrorSummary message={listError} /> : null}
        {loading ? <p className="text-sm text-slate-600">Loading assignments…</p> : null}
        {!loading && assignments.length === 0 ? (
          <p className="text-sm text-slate-600">No teacher assignments match these filters.</p>
        ) : null}
        {assignments.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <p className="font-semibold text-slate-900">
              {row.user_full_name ?? "Teacher"} · {row.user_email ?? row.user_id.slice(0, 8)}
            </p>
            <p className="mt-1 text-slate-600">
              {row.state_name ?? row.state_id} · {row.district_name ?? row.district_id} ·{" "}
              {row.school_name ?? row.school_id}
              {row.active ? "" : " · inactive"}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
