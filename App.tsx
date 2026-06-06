import React, { useState, useCallback, useEffect } from 'react';
import { JobDescription, MatchResult } from './types';
import { analyzeJobMatches } from './services/geminiService';
import { PlusIcon, TrashIcon, SparklesIcon, CheckCircleIcon, XCircleIcon, ChevronDownIcon, ChevronUpIcon } from './components/icons';

const SAMPLE_RESUME = `John Doe
Full Stack Software Engineer
john.doe@email.com | github.com/johndoe | linkedin.com/in/johndoe

SUMMARY
Detail-oriented and results-driven Software Engineer with 4+ years of experience building high-performance web applications. Specialized in TypeScript, React, Node.js, and modern cloud infrastructures. Proven track record of improving web app performance by 40% and leading frontend migrations.

SKILLS
- Programming Languages: TypeScript, JavaScript (ES6+), Python, HTML5, CSS3
- Frontend: React.js, Next.js, Redux Toolkit, Tailwind CSS, Webpack
- Backend & Databases: Node.js, Express, RESTful APIs, PostgreSQL, MongoDB, Redis
- Cloud & DevOps: AWS (S3, EC2, Lambda), Docker, Git, CI/CD pipelines
- Methodologies: Agile/Scrum, Test-Driven Development (TDD)

EXPERIENCE
Software Engineer | TechVibe Solutions (2022 - Present)
- Architected and built a SaaS dashboard using React, TypeScript, and Tailwind CSS, reducing page-load time by 35%.
- Built and integrated RESTful APIs with Node.js and Express, connected to a PostgreSQL database.
- Implemented state management using Redux Toolkit, resulting in more predictable data flows and reduced bug count by 20%.
- Conducted code reviews, mentored 2 junior developers, and introduced Jest/React Testing Library unit testing.`;

const SAMPLE_JOBS = [
  {
    id: 'job-1',
    title: 'Senior Frontend Engineer',
    description: `We are looking for a Senior Frontend Engineer to join our growing engineering team. In this role, you will be responsible for leading the design and development of our user-facing web applications.

Responsibilities:
- Build reusable components and front-end libraries using React.js.
- Optimize web application components for maximum speed and scalability.
- Work closely with UX/UI designers and product managers to translate designs into high-quality code.
- Write clean, maintainable, and well-tested code using Jest and React Testing Library.

Key Requirements:
- 5+ years of experience in modern frontend development.
- Strong proficiency in JavaScript/TypeScript and React.js.
- Excellent understanding of state management tools (like Redux or Recoil).
- Experience with Next.js, GraphQL, and tailwindcss is a big plus.
- Experience with cloud platforms (AWS, GCP) and containerization tools like Docker.
- Exceptional communication skills and experience mentoring team members.`
  }
];

const App: React.FC = () => {
  const [resume, setResume] = useState<string>(() => localStorage.getItem('resume') || '');
  const [jobs, setJobs] = useState<JobDescription[]>(() => {
    try {
      const savedJobs = localStorage.getItem('jobs');
      if (savedJobs) {
        const parsedJobs = JSON.parse(savedJobs);
        if (Array.isArray(parsedJobs) && parsedJobs.length > 0) {
          // Schema validation for items loaded from localStorage to prevent crashes
          const validated = parsedJobs.filter(job => 
            job && 
            typeof job === 'object' && 
            typeof job.id === 'string' && 
            typeof job.title === 'string' && 
            typeof job.description === 'string'
          );
          if (validated.length > 0) {
            return validated;
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse and validate jobs from localStorage", e);
    }
    return [{ id: 'job-1', title: '', description: '' }];
  });
  
  const [results, setResults] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('resume', resume);
    }, 2000);
    return () => clearTimeout(timer);
  }, [resume]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('jobs', JSON.stringify(jobs));
    }, 2000);
    return () => clearTimeout(timer);
  }, [jobs]);

  const addJob = () => {
    setJobs([...jobs, { id: `job-${Date.now()}`, title: '', description: '' }]);
  };

  const removeJob = (id: string) => {
    setJobs(jobs.filter((job) => job.id !== id));
  };

  const updateJob = (id: string, field: 'title' | 'description', value: string) => {
    setJobs(
      jobs.map((job) => (job.id === id ? { ...job, [field]: value } : job))
    );
  };

  const loadDemoData = () => {
    setResume(SAMPLE_RESUME);
    setJobs(SAMPLE_JOBS);
    setError(null);
  };

  const handleAnalyze = useCallback(async () => {
    const cleanResume = resume.trim();
    if (!cleanResume || jobs.some(job => !job.title.trim() || !job.description.trim())) {
      setError('Please fill in your resume and all job titles and descriptions.');
      return;
    }

    // Input length limits verification to stay within model token margins
    if (cleanResume.length > 60000) {
      setError(`Resume character length is too long (${cleanResume.length.toLocaleString()} characters). Please shorten it under 60,000 characters.`);
      return;
    }

    const oversizedJob = jobs.find(job => job.description.trim().length > 30000);
    if (oversizedJob) {
      setError(`Job description for "${oversizedJob.title || 'Untitled'}" is too long (${oversizedJob.description.trim().length.toLocaleString()} characters). Please shorten it under 30,000 characters.`);
      return;
    }

    setError(null);
    setIsLoading(true);
    setResults([]);

    try {
      const matchResults = await analyzeJobMatches(cleanResume, jobs);
      const sortedResults = matchResults.sort((a, b) => b.matchPercentage - a.matchPercentage);
      setResults(sortedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [resume, jobs]);

  return (
    <div className="min-h-screen bg-[#070b13] text-[#e2e8f0] relative overflow-hidden pb-24">
      {/* Background Ambient Glows */}
      <div className="glow-blob glow-indigo -top-20 -left-20"></div>
      <div className="glow-blob glow-violet top-[30%] -right-20"></div>
      <div className="glow-blob glow-emerald bottom-10 left-[15%]"></div>

      <header className="border-b border-white/5 bg-[#070b13]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            <SparklesIcon className="w-7 h-7 mr-2 text-indigo-400 animate-pulse" />
            AI JOB MATCHER
          </h1>
          <button
            onClick={loadDemoData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/20 hover:border-indigo-500/60 transition-all duration-300 cursor-pointer"
            title="Populate input fields with pre-filled sample developer resume & job description"
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            Load Demo Data
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Resume Container */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-violet-500"></div>
            <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 text-sm font-semibold">1</span>
              Your Resume
            </h2>
            <p className="text-sm text-slate-400 mb-4">Paste the plain text of your resume below. For the most accurate matching, ensure it highlights your tech stack, experiences, and metrics.</p>
            <textarea
              className="w-full h-64 p-4 rounded-xl glass-input focus:ring-1 focus:ring-indigo-500 transition-all duration-300 font-mono text-sm leading-relaxed resize-y"
              placeholder="Paste your resume content here..."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              aria-label="Resume text area"
            />
          </div>

          {/* Job Descriptions Container */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-emerald-500"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/10 text-violet-400 text-sm font-semibold">2</span>
                  Target Job Descriptions
                </h2>
                <p className="text-sm text-slate-400 mt-1">Provide one or more job listings to analyze alignment.</p>
              </div>
            </div>

            <div className="space-y-6">
              {jobs.map((job, index) => (
                <div key={job.id} className="p-5 rounded-xl border border-white/5 bg-[#090d16]/40 hover:border-white/10 transition-colors duration-300 relative group/card">
                  <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Job Entry #{index + 1}</span>
                      {jobs.length > 1 && (
                        <button
                          onClick={() => removeJob(job.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
                          aria-label={`Remove job #${index + 1}`}
                          title="Remove Job Form"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                  <input
                    type="text"
                    className="w-full p-3 mb-3 rounded-lg glass-input focus:ring-1 focus:ring-violet-500 font-semibold"
                    placeholder="Job Title (e.g., Senior Frontend Developer)"
                    value={job.title}
                    onChange={(e) => updateJob(job.id, 'title', e.target.value)}
                    aria-label={`Title for job #${index + 1}`}
                  />
                  <textarea
                    className="w-full h-44 p-3 rounded-lg glass-input focus:ring-1 focus:ring-violet-500 text-sm leading-relaxed resize-y"
                    placeholder="Paste job description details..."
                    value={job.description}
                    onChange={(e) => updateJob(job.id, 'description', e.target.value)}
                    aria-label={`Description for job #${index + 1}`}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={addJob}
              className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group cursor-pointer"
              title="Add another job description form"
            >
              <PlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Add Another Job Listing
            </button>
          </div>

          {/* Action Trigger */}
          <div className="flex justify-center pt-4 sticky bottom-6 z-20">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="flex items-center justify-center w-full max-w-md px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 hover:from-indigo-500 hover:via-violet-500 hover:to-emerald-500 shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none cursor-pointer"
              title="Analyze resume alignment with target jobs"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>ANALYZING PROFILE MATCHES...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  <span>RUN AI MATCH ANALYSIS</span>
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div role="alert" className="text-center font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl animate-shake">
              {error}
            </div>
          )}

          {/* Loading Skeleton Panel */}
          {isLoading && <LoadingSkeleton />}

          {/* Results Section */}
          {results.length > 0 && !isLoading && (
            <div className="mt-12 space-y-8 animate-slide-up">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Match Results</h2>
                <p className="text-sm text-slate-400">Detailed AI evaluation of your profile against your selected positions.</p>
              </div>
              <div className="space-y-6">
                {results.map((result) => {
                  const originalJob = jobs.find(j => j.id === result.jobId);
                  return (
                    <ResultCard 
                        key={result.jobId} 
                        result={result}
                        jobDescription={originalJob ? originalJob.description : "Description not found."}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

/* SVG Circular Match Gauge */
const CircularScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let scoreColor = 'stroke-rose-400';
  let textColor = 'text-rose-400';
  let badgeColorClass = 'badge-glow-error';

  if (score >= 80) {
    scoreColor = 'stroke-emerald-400';
    textColor = 'text-emerald-400';
    badgeColorClass = 'badge-glow-success';
  } else if (score >= 60) {
    scoreColor = 'stroke-amber-400';
    textColor = 'text-amber-400';
    badgeColorClass = 'badge-glow-warning';
  }

  return (
    <div className="relative flex flex-col items-center justify-center flex-shrink-0">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="7"
            fill="transparent"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            className={`circular-gauge-path ${scoreColor}`}
            strokeWidth="7"
            fill="transparent"
            style={{
              strokeDasharray: circumference,
              // @ts-ignore
              '--dashoffset': strokeDashoffset,
            } as React.CSSProperties}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${textColor}`}>{score}%</span>
        </div>
      </div>
      <span className={`mt-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${badgeColorClass}`}>
        {score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Gap Identified'}
      </span>
    </div>
  );
};

/* Result Card Component */
const ResultCard: React.FC<{ result: MatchResult, jobDescription: string }> = ({ result, jobDescription }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 relative">
            <div className="p-6 sm:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1 space-y-2">
                        <h3 className="text-xl font-extrabold text-white tracking-tight">{result.jobTitle}</h3>
                        <p className="text-sm text-slate-300 leading-relaxed bg-[#090d16]/30 p-4 rounded-xl border border-white/5">{result.summary}</p>
                    </div>
                    <CircularScoreGauge score={result.matchPercentage} />
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                    {/* Matching Skills */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                            Matching Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {result.matchingSkills.length > 0 ? (
                              result.matchingSkills.map((skill, i) => (
                                <span key={i} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 italic">No matching skills identified.</span>
                            )}
                        </div>
                    </div>

                    {/* Missing Skills */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                            <XCircleIcon className="w-5 h-5 text-rose-400" />
                            Missing Skills
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {result.missingSkills.length > 0 ? (
                              result.missingSkills.map((missingSkill, i) => (
                                <span 
                                    key={i} 
                                    className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 cursor-help transition-all duration-300 hover:bg-rose-500/20"
                                    title={missingSkill.context}
                                >
                                    {missingSkill.skill}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-emerald-400 font-medium italic">All critical skills present!</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4 flex justify-end">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors p-1"
                        aria-expanded={isExpanded}
                        title={isExpanded ? "Hide full description" : "View full description"}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUpIcon className="w-4 h-4 mr-1.5" />
                                Hide Job Details
                            </>
                        ) : (
                            <>
                                <ChevronDownIcon className="w-4 h-4 mr-1.5" />
                                View Job Details
                            </>
                        )}
                    </button>
                </div>

                {isExpanded && (
                    <div className="mt-4 bg-[#090d16]/60 p-4 rounded-xl border border-white/5 animate-slide-up">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Original Job Description</h5>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {jobDescription}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

/* Loading Skeleton Component */
const LoadingSkeleton: React.FC = () => {
  return (
    <div className="mt-8 space-y-6 animate-pulse">
      <div className="h-6 bg-slate-800 rounded-md w-1/4 mx-auto skeleton-pulse"></div>
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 flex-1">
            <div className="h-6 bg-slate-800 rounded w-1/3 skeleton-pulse"></div>
            <div className="h-16 bg-slate-800/50 rounded-xl skeleton-pulse"></div>
          </div>
          <div className="w-24 h-24 rounded-full bg-slate-800 skeleton-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
          <div className="space-y-3">
            <div className="h-4 bg-slate-800 rounded w-1/4 skeleton-pulse"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 bg-slate-800 rounded w-16 skeleton-pulse"></div>
              <div className="h-6 bg-slate-800 rounded w-20 skeleton-pulse"></div>
              <div className="h-6 bg-slate-800 rounded w-14 skeleton-pulse"></div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-800 rounded w-1/4 skeleton-pulse"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 bg-slate-800 rounded w-16 skeleton-pulse"></div>
              <div className="h-6 bg-slate-800 rounded w-20 skeleton-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
