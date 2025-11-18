// app/my-jobs/page.tsx

"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Briefcase, DollarSign, MapPin, Calendar, Trash2, ExternalLink, Filter, Menu, X, Home, BarChart3, Settings, HelpCircle, User } from "lucide-react";
import { logout } from "@/utils/supabase/action";

type UserInfo = {
  fullName: string | null;
  email: string | null;
};

type UserApiResponse = {
    success: boolean;
    user?: {
        id: string;
        email: string | null;
        fullName: string | null;
    };
    error?: string;
}

type JobFeatures = {
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  time_type: string | null;
  department: string | null;
};

type Job = {
  id: string;
  title: string;
  company_name: string;
  location: string;
  absolute_url: string;
  updated_at: string;
  ats: string;
  job_features: JobFeatures | null;
};

type SavedJob = {
  job_id: string;
  checked_at: string;
  jobs: Job;
};

type FilterType = "all" | "greenhouse" | "web";

export default function MyJobsPage() {
  const router = useRouter();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
      setIsLoggingOut(true);
      const result = await logout();
    }

  useEffect(() => {
    let cancelled = false;
    const loadJobs = async () => {
        try{
            setLoading(true);
            const res = await fetch("/api/my-jobs");
            if (!res.ok) {
                console.error("[MyJobsPage] Failed to fetch jobs:", res.statusText);
                toast.error("Couldn't load your saved jobs. Please try again.");
                return;
            }

            const data = await res.json() as { success: boolean; jobs?: SavedJob[]; error?: string };

            if (!data.success || !data.jobs) {
                console.error("[MyJobsPage] API error:", data.error);
                toast.error(data.error ?? "Error loading jobs");
                return;
            }

            if (!cancelled) {
                setJobs(data.jobs);
            }
            } catch (err) {
            console.error("[MyJobsPage] Network/JS error:", err);
            toast.error("Network error loading jobs.");
            } finally {
            if (!cancelled) setLoading(false);
            }
        };

        loadJobs();

        return () => {
            cancelled = true;
        };
        }, []);

  useEffect(() => {
      const fetchUser = async () => {
          try {
              // 1. Fetch data from user API route
              const res = await fetch("/api/user");
              const data: UserApiResponse = await res.json();

              // 2. Handle non-success response 
              if (!res.ok || !data.success || !data.user) {
                  console.error("[MyJobsPage] Failed to fetch user profile:", data.error || res.statusText);
                  // don't show user info.
                  return;
              }

              // 3. Set the state with data
              setUserInfo({
                  fullName: data.user.fullName ?? null,
                  email: data.user.email ?? null,
              });

          } catch (err) {
              console.error("[MyJobsPage] Network error fetching user profile:", err);
          }
      };

      fetchUser();
  }, []);

const handleUnsave = (jobId: string) => {
  setJobToDelete(jobId);
  console.log("[handleUnsave] trash clicked for jobId =", jobId);
};

const confirmDelete = async () => {
  if (!jobToDelete) return; // Should never happen if popup is open

  const jobId = jobToDelete;

  // Clear the state immediately to close it
  setJobToDelete(null); 

  const prevJobs = jobs;
  setJobs(prev => prev.filter(j => j.job_id !== jobId));
  
  try {
    const res = await fetch("/api/my-jobs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setJobs(prevJobs);
      toast.error(data.error ?? "Could not remove job");
      return;
    }

    toast.success("Job removed from My Jobs");
  } catch (err) {
    console.error("[confirmDelete] network error:", err);
    setJobs(prevJobs);
    toast.error("Error while removing job");
  }
};


  const formatSalary = (job: Job) => {
    const features = job.job_features;
    if (!features?.salary_min && !features?.salary_max) return 'Salary not disclosed';
    
    const currency = features.currency || 'USD';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    });

    if (features.salary_min && features.salary_max) {
      return `${formatter.format(features.salary_min)} - ${formatter.format(features.salary_max)}`;
    }
    return formatter.format(features.salary_min || features.salary_max || 0);
  };


  const formatDate = (dateString?: string | null) => {
  if (!dateString) return "Unknown";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

  const departments = Array.from(new Set(
    jobs
      .map(j => j.jobs.job_features?.department)
      .filter((d): d is string => !!d)
  ));

  const filteredJobs = jobs.filter(job => {
    if (filterType !== 'all' && job.jobs.ats !== filterType) return false;
    if (filterDepartment !== 'all' && job.jobs.job_features?.department !== filterDepartment) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading your jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold">
            <span className="text-orange-500">Job</span> Busters
          </h2>
          <button onClick={() => setSidebarOpen(false)} 
            className="p-1 hover:bg-slate-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-2">

          <button
            onClick={() => {
                setSidebarOpen(false)
                router.push("/")
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white text-left"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Analyze Jobs</span>
          </button>

          <button
            onClick={() => {
                setSidebarOpen(false)
                router.push("/my-jobs")
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-orange-600 text-white text-left"
          >
            <Briefcase className="w-5 h-5"/>
            <span className="font-medium">My Jobs</span>
          </button>
        </nav>

        {/* User Profile Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                    {userInfo?.fullName || "Logged-in user"}
                </p>
                <p className="text-xs text-slate-400 truncate">
                    {userInfo?.email || ""}
                </p>
            </div>
          </div>
        </div>
      </aside>


        {/* Nav Bar  */}
        <header className="sticky top-0 z-30 bg-white border-b border-orange-100 shadow-sm">
          {/* center row */}
            <div className="relative flex items-center justify-center h-16">
                {/* menu to the left */}
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="absolute left-4 p-2 hover:bg-orange-50 rounded-lg transition-colors"
                >
                    <Menu className="w-6 h-6 text-gray-700" />
                </button>

                {/* center */}
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
                    <span className="text-orange-600">Job</span>{" "}
                    <span className="text-slate-900">Busters</span>
                    </h1>
                    <span className="text-xs text-gray-600">
                    My Saved Jobs
                    </span>
                </div>

            {/* logout to the right */}
            <button
              onClick={async () => {
                setSidebarOpen(false); // Close sidebar 
                await handleLogout();
              }}
              disabled={isLoggingOut} 
              className="absolute right-4 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
        </div>
        </header>

        
        <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">My Saved Jobs</h2>
            <p className="text-gray-600">Track and manage jobs you have analyzed. {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} saved.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>
              
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Sources</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="web">Web Scraped (Coming soon)</option>
              </select>

              {departments.length > 0 && (
                <select 
                  value={filterDepartment} 
                  onChange={(e) => setFilterDepartment(e.target.value)} 
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">

                  <option value="all">All Departments</option>
                  
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              )}

              {(filterType !== 'all' || filterDepartment !== 'all') && (
                <button onClick={() => { setFilterType('all'); setFilterDepartment('all'); }} className="text-sm text-orange-600 hover:text-orange-700 font-medium">Clear filters</button>
              )}
            </div>
          </div>


          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600 mb-6">
                {jobs.length === 0 ? "Start analyzing job postings to build your saved jobs list." : "Try adjusting your filters to see more results."}
              </p>

              {jobs.length === 0 && (
                <button
                    onClick={() => router.push("/")}
                    className="inline-flex px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                    Analyze Your First Job
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((savedJob) => {
                const job = savedJob.jobs;
                return (
                  <div key={savedJob.job_id} className="bg-white rounded-xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1 hover:text-orange-600 transition-colors">
                                <a href={job.absolute_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                  {job.title}
                                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                </a>
                              </h3>
                              <p className="text-gray-600 font-medium">{job.company_name}</p>
                            </div>
                            
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${job.ats === 'greenhouse' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                              {job.ats === 'greenhouse' ? 'Greenhouse' : 'Web'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 mb-4">
                            {job.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span>{job.location}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span>{formatSalary(job)}</span>
                            </div>

                            {job.job_features?.time_type && (
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="capitalize">{job.job_features.time_type}</span>
                              </div>
                            )}

                            {job.job_features?.department && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">{job.job_features.department}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Saved {formatDate(savedJob.checked_at)}</span>
                            </div>
                            <span>•</span>
                            <span>Updated {formatDate(job.updated_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <button 
                            onClick={() => handleUnsave(savedJob.job_id)} 
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Remove from saved jobs"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirmation Pop up */}
          {jobToDelete && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
                  <div className="flex flex-col items-center">
                    <Trash2 className="w-8 h-8 text-red-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Removal</h3>
                    <p className="text-center text-gray-600 mb-6">
                      Are you sure you want to remove this job from My Jobs? This action cannot be undone.
                    </p>
                    <div className="flex w-full gap-3">
                      <button
                        onClick={() => setJobToDelete(null)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </main>
      </div>
  );
}