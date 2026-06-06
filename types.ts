export interface JobDescription {
  id: string;
  title: string;
  description: string;
}

export interface MissingSkill {
    skill: string;
    context: string;
}

export interface MatchResult {
  jobId: string;
  jobTitle: string;
  matchPercentage: number;
  summary: string;
  matchingSkills: string[];
  missingSkills: MissingSkill[];
}
