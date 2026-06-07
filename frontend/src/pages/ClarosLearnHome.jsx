import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, GraduationCap, Loader2, Users2 } from "lucide-react";
import { PageHeader } from "../components/layout/Shell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";

function CourseCard({ course, isFaculty }) {
  const facultyHref = `/learn/faculty/${course.id}`;
  const studentHref = `/learn/courses/${course.id}`;
  return (
    <Link
      to={isFaculty ? facultyHref : studentHref}
      data-testid={`learn-course-card-${course.id}`}
      className="card p-5 border border-border bg-card hover:border-primary/40 transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow">{course.code}</div>
          <h3 className="text-lg font-semibold tracking-tight leading-tight">{course.title}</h3>
        </div>
        <BookOpen className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-xs text-muted-foreground">
        {isFaculty
          ? `${course.enrollment_count ?? 0} students · ${course.credits ?? 0} credits`
          : `Faculty: ${course.faculty || "—"} · ${course.credits ?? 0} credits`}
      </div>
      {!isFaculty && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span data-testid={`learn-course-progress-${course.id}`}>{course.progress_pct ?? 0}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, course.progress_pct || 0))}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-end text-xs text-primary mt-auto">
        Open <ChevronRight className="h-3 w-3 ml-1" />
      </div>
    </Link>
  );
}

export default function ClarosLearnHome() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);

  const isFaculty = useMemo(
    () => user && ["faculty", "instructor", "hod", "dean", "institution_admin", "super_admin"].includes(user.role),
    [user]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/v1/learn/courses/me");
      setCourses(r.data || []);
    } catch (e) {
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="learn-home">
      <PageHeader
        eyebrow="Claros Learn"
        moduleId="claros-learn"
        title={isFaculty ? "Teaching Dashboard" : "My Courses"}
        description={isFaculty
          ? "Manage course content, assignments and quizzes for the courses you teach."
          : "Continue learning. Pick up where you left off."}
      />
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="learn-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading courses…
        </div>
      )}
      {!loading && courses.length === 0 && (
        <div className="card p-8 border border-dashed border-border text-center text-sm text-muted-foreground"
             data-testid="learn-empty">
          {isFaculty ? (
            <>
              <Users2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              You have no courses assigned yet.
            </>
          ) : (
            <>
              <GraduationCap className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              You are not enrolled in any courses yet.
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => <CourseCard key={c.id} course={c} isFaculty={isFaculty} />)}
      </div>
    </div>
  );
}
