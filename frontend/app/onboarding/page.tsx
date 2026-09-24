"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, ChevronRight, ChevronLeft, Loader2, GraduationCap,
  Target, Clock, Calendar, Layers, Building2, ChevronDown
} from "lucide-react";
import { profileApi, getErrorMessage } from "@/lib/api";
import { saveUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toast } from "sonner";
import clsx from "clsx";

const GOALS = [
  { id: "semester_exams", label: "Semester Exams", icon: "📚" },
  { id: "placements", label: "Placements", icon: "💼" },
  { id: "competitive_exams", label: "Competitive Exams", icon: "🏆" },
  { id: "interviews", label: "Interviews", icon: "🎤" },
  { id: "general_learning", label: "General Learning", icon: "🧠" },
];

const STUDY_TIMES = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3+ hours" },
];

const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year" },
];

const DEGREE_OPTIONS = [
  { value: "B.Tech", label: "B.Tech" },
  { value: "B.E.", label: "B.E." },
  { value: "BCA", label: "BCA" },
  { value: "B.Sc", label: "B.Sc" },
  { value: "M.Tech", label: "M.Tech" },
  { value: "MCA", label: "MCA" },
  { value: "M.Sc", label: "M.Sc" },
  { value: "MBA", label: "MBA" },
  { value: "Diploma", label: "Diploma" },
  { value: "Other", label: "Other Degree..." },
];

const BRANCH_OPTIONS = [
  { value: "Computer Science and Engineering (CSE)", label: "Computer Science (CSE)" },
  { value: "Artificial Intelligence & Data Science (AI & DS)", label: "AI & Data Science (AI & DS)" },
  { value: "Artificial Intelligence & Machine Learning (AI & ML)", label: "AI & Machine Learning (AI & ML)" },
  { value: "Information Technology (IT)", label: "Information Technology (IT)" },
  { value: "Electronics & Communication (ECE)", label: "Electronics & Communication (ECE)" },
  { value: "Electrical & Electronics (EEE)", label: "Electrical & Electronics (EEE)" },
  { value: "Mechanical Engineering (ME)", label: "Mechanical Engineering (ME)" },
  { value: "Civil Engineering (CE)", label: "Civil Engineering (CE)" },
  { value: "Data Science", label: "Data Science" },
  { value: "Cyber Security", label: "Cyber Security" },
  { value: "Biotechnology", label: "Biotechnology" },
  { value: "Other", label: "Other Branch..." },
];

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
            <Icon className="w-4 h-4 flex-shrink-0" />
          </div>
        )}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            paddingLeft: Icon ? "2.125rem" : "0.75rem",
            paddingRight: "1.75rem",
          }}
          className={clsx(
            "input-field text-sm cursor-pointer [background-image:none] appearance-none text-left",
            !value ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"
          )}
        >
          {placeholder && (
            <option value="" disabled className="text-slate-400 bg-white dark:bg-slate-900">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 py-1.5">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-400 flex items-center justify-center">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    college: "", degree: "", branch: "",
    year_of_study: "",
    subjects: [""],
    goals: [] as string[],
    daily_study_minutes: 60,
  });

  const [customDegree, setCustomDegree] = useState("");
  const [customBranch, setCustomBranch] = useState("");

  // Prepopulate form if user provided details during registration
  useEffect(() => {
    profileApi.getMe().then(({ data }) => {
      if (data) {
        const isKnownDegree = DEGREE_OPTIONS.some(d => d.value === data.degree);
        const isKnownBranch = BRANCH_OPTIONS.some(b => b.value === data.branch);

        setForm(f => ({
          ...f,
          college: data.college || f.college,
          degree: data.degree ? (isKnownDegree ? data.degree : "Other") : f.degree,
          branch: data.branch ? (isKnownBranch ? data.branch : "Other") : f.branch,
          year_of_study: data.year_of_study ? String(data.year_of_study) : f.year_of_study,
        }));

        if (data.degree && !isKnownDegree) setCustomDegree(data.degree);
        if (data.branch && !isKnownBranch) setCustomBranch(data.branch);
      }
    }).catch(() => {});
  }, []);

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const toggleGoal = (id: string) => {
    setForm(f => ({
      ...f,
      goals: f.goals.includes(id) ? f.goals.filter(g => g !== id) : [...f.goals, id],
    }));
  };

  const updateSubject = (i: number, val: string) => {
    setForm(f => {
      const s = [...f.subjects];
      s[i] = val;
      return { ...f, subjects: s };
    });
  };

  const addSubject = () => setForm(f => ({ ...f, subjects: [...f.subjects, ""] }));

  const handleFinish = async () => {
    setLoading(true);
    const finalDegree = form.degree === "Other" ? customDegree.trim() : form.degree?.trim();
    const finalBranch = form.branch === "Other" ? customBranch.trim() : form.branch?.trim();

    try {
      await profileApi.completeOnboarding({
        college: form.college?.trim() || undefined,
        degree: finalDegree || undefined,
        branch: finalBranch || undefined,
        year_of_study: form.year_of_study ? parseInt(form.year_of_study) : undefined,
        subjects: form.subjects.filter(s => s.trim()),
        goals: form.goals,
        daily_study_minutes: form.daily_study_minutes,
      });
      try {
        const { data: me } = await profileApi.getMe();
        if (me) {
          saveUser({ id: me.id, email: me.email, full_name: me.full_name });
          window.dispatchEvent(new Event("studyos-user-updated"));
        }
      } catch {
        // Ignore fallback error
      }
      toast.success("Welcome to StudyOS AI! 🎉");
      router.push("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    { title: "Tell us about yourself", subtitle: "We'll personalize your learning experience." },
    { title: "What subjects are you studying?", subtitle: "Add the courses or subjects you want AI to help with." },
    { title: "What are you preparing for?", subtitle: "Select all that apply. This helps tailor your study plan." },
    { title: "How much time can you study daily?", subtitle: "We'll create a realistic, achievable study schedule for you." },
  ];

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4 relative">
      {/* Floating Theme Toggle top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="fixed top-1/4 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fadeIn relative">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Welcome to StudyOS AI</h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">Let's set up your personalized learning space</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
            <span>Step {step + 1} of {totalSteps}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{progress.toFixed(0)}% complete</span>
          </div>
          <div className="progress-bar h-2">
            <div className="progress-fill bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="card-glass p-7 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stepTitles[step].title}</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs mb-6">{stepTitles[step].subtitle}</p>

          {/* Step 0: Academic info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  College / University
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    value={form.college}
                    onChange={e => setForm(f => ({ ...f, college: e.target.value }))}
                    placeholder="e.g., SRKR Engineering College, IIT"
                    style={{ paddingLeft: "2.25rem" }}
                    className="input-field text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Degree Dropdown */}
                <div>
                  <SelectField
                    id="degree"
                    label="Degree"
                    value={form.degree}
                    onChange={v => setForm(f => ({ ...f, degree: v }))}
                    options={DEGREE_OPTIONS}
                    placeholder="Select Degree"
                    icon={GraduationCap}
                  />
                </div>

                {/* Year of Study Dropdown */}
                <div>
                  <SelectField
                    id="year_of_study"
                    label="Year of Study"
                    value={form.year_of_study}
                    onChange={v => setForm(f => ({ ...f, year_of_study: v }))}
                    options={YEAR_OPTIONS}
                    placeholder="Select Year"
                    icon={Calendar}
                  />
                </div>

                {/* Custom Degree input when "Other" is chosen */}
                {form.degree === "Other" && (
                  <div className="col-span-2 animate-fadeIn">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Specify Degree Name
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                        <GraduationCap className="w-4 h-4 flex-shrink-0" />
                      </div>
                      <input
                        value={customDegree}
                        onChange={e => setCustomDegree(e.target.value)}
                        placeholder="e.g. B.Com Honours, MBBS, etc."
                        style={{ paddingLeft: "2.25rem" }}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Branch Dropdown */}
              <div>
                <SelectField
                  id="branch"
                  label="Branch / Specialization"
                  value={form.branch}
                  onChange={v => setForm(f => ({ ...f, branch: v }))}
                  options={BRANCH_OPTIONS}
                  placeholder="Select Branch / Specialization"
                  icon={Layers}
                />
              </div>

              {/* Custom Branch input when "Other" is chosen */}
              {form.branch === "Other" && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Specify Branch / Specialization
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                      <Layers className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <input
                      value={customBranch}
                      onChange={e => setCustomBranch(e.target.value)}
                      placeholder="e.g. Aerospace Engineering, Robotics"
                      style={{ paddingLeft: "2.25rem" }}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Subjects */}
          {step === 1 && (
            <div className="space-y-3">
              {form.subjects.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s}
                    onChange={e => updateSubject(i, e.target.value)}
                    placeholder={`Subject ${i + 1} (e.g., Operating Systems)`}
                    className="input-field flex-1"
                    autoFocus={i === form.subjects.length - 1}
                  />
                  {form.subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, subjects: f.subjects.filter((_, idx) => idx !== i) }))}
                      className="px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:border-rose-500/40 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addSubject}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold py-1.5 px-1 flex items-center gap-1 cursor-pointer"
              >
                + Add another subject
              </button>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div className="grid grid-cols-1 gap-2.5">
              {GOALS.map(goal => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => toggleGoal(goal.id)}
                  className={clsx(
                    "flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                    form.goals.includes(goal.id)
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 font-semibold"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/30"
                  )}
                >
                  <span className="text-xl">{goal.icon}</span>
                  <span className="text-sm font-medium">{goal.label}</span>
                  {form.goals.includes(goal.id) && (
                    <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Study Time */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              {STUDY_TIMES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, daily_study_minutes: t.value }))}
                  className={clsx(
                    "p-4 rounded-xl border text-center font-semibold transition-all cursor-pointer",
                    form.daily_study_minutes === t.value
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/30"
                  )}
                >
                  <Clock className="w-5 h-5 mx-auto mb-1.5 opacity-70" />
                  <span className="text-sm">{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-5">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="btn-secondary flex items-center gap-1.5 py-2.5 px-4 text-sm cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              className="btn-primary flex items-center gap-1.5 py-2.5 px-5 text-sm cursor-pointer"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 text-sm cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {loading ? "Setting up..." : "Complete Setup 🚀"}
            </button>
          )}
        </div>

        <div className="text-center mt-3.5">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-slate-500 text-xs hover:text-slate-400 transition-colors cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
