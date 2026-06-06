import { GoogleGenAI, Type } from "@google/genai";
import { JobDescription, MatchResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        jobId: {
          type: Type.STRING,
        },
        jobTitle: {
          type: Type.STRING,
        },
        matchPercentage: {
          type: Type.NUMBER,
        },
        summary: {
          type: Type.STRING,
        },
        matchingSkills: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
        missingSkills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
                skill: { type: Type.STRING },
                context: { 
                    type: Type.STRING,
                    description: "A brief explanation of why this skill is important for the job role."
                }
            },
            required: ['skill', 'context']
          },
        },
      },
      required: ['jobId', 'jobTitle', 'matchPercentage', 'summary', 'matchingSkills', 'missingSkills'],
    },
};

// Check if a thrown error is transient (e.g. server hiccups, timeouts) or permanent (e.g. auth issues, blockages)
const isTransientError = (error: any): boolean => {
  const errMsg = String(error?.message || error || '').toLowerCase();
  if (
    errMsg.includes("api key") || 
    errMsg.includes("api_key_invalid") || 
    errMsg.includes("403") || 
    errMsg.includes("400") || 
    errMsg.includes("quota") || 
    errMsg.includes("429") || 
    errMsg.includes("safety") ||
    errMsg.includes("blocked")
  ) {
    return false;
  }
  return true;
};

// Retry a Promise-returning function with exponential backoff
const executeWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries || !isTransientError(error)) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      console.warn(`Gemini API call failed. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Clean and validate the model JSON output to ensure structural type-safety
const validateMatchResults = (data: any): MatchResult[] => {
  if (!Array.isArray(data)) {
    throw new Error("Invalid format: expected a JSON array containing match results.");
  }

  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Format validation failed: Entry at index ${index} is not a valid object.`);
    }

    if (typeof item.jobId !== 'string' || !item.jobId.trim()) {
      throw new Error(`Format validation failed: Entry at index ${index} is missing a valid 'jobId'.`);
    }

    if (typeof item.jobTitle !== 'string') {
      throw new Error(`Format validation failed: Entry at index ${index} is missing 'jobTitle'.`);
    }

    const matchPercentage = Number(item.matchPercentage);
    if (isNaN(matchPercentage) || matchPercentage < 0 || matchPercentage > 100) {
      throw new Error(`Format validation failed: Entry at index ${index} has an out-of-bounds matchPercentage: ${item.matchPercentage}`);
    }

    if (typeof item.summary !== 'string') {
      throw new Error(`Format validation failed: Entry at index ${index} is missing a 'summary'.`);
    }

    if (!Array.isArray(item.matchingSkills)) {
      throw new Error(`Format validation failed: Entry at index ${index} is missing its 'matchingSkills' array.`);
    }
    const matchingSkills = item.matchingSkills.map((s: any) => String(s));

    if (!Array.isArray(item.missingSkills)) {
      throw new Error(`Format validation failed: Entry at index ${index} is missing its 'missingSkills' array.`);
    }
    const missingSkills = item.missingSkills.map((m: any, idx: number) => {
      if (typeof m !== 'object' || m === null || typeof m.skill !== 'string' || typeof m.context !== 'string') {
        throw new Error(`Format validation failed: Entry at index ${index}, missingSkill at position ${idx} is structurally invalid.`);
      }
      return {
        skill: String(m.skill),
        context: String(m.context)
      };
    });

    return {
      jobId: item.jobId,
      jobTitle: item.jobTitle,
      matchPercentage: matchPercentage,
      summary: item.summary,
      matchingSkills: matchingSkills,
      missingSkills: missingSkills
    };
  });
};

// Formulate descriptive error diagnostics for standard Gemini API faults
const getDetailedErrorMessage = (error: any): string => {
  const errMsg = String(error?.message || error || '').toLowerCase();
  
  if (errMsg.includes("api key") || errMsg.includes("api_key_invalid") || errMsg.includes("invalid key")) {
    return "Invalid API Key: Please verify that the GEMINI_API_KEY in your .env.local file is correct and valid.";
  }
  if (errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("resource exhausted")) {
    return "API Quota Exceeded: You have reached the rate limit for the Gemini API. Please wait a minute before trying again.";
  }
  if (errMsg.includes("safety") || errMsg.includes("blocked")) {
    return "Content Blocked: The analysis was blocked by the Gemini safety filters. Try editing your resume or job descriptions to exclude potentially flaggable terms.";
  }
  if (errMsg.includes("network") || errMsg.includes("fetch")) {
    return "Network Error: Could not communicate with the Gemini API server. Please check your internet connection and try again.";
  }
  
  return error instanceof Error ? error.message : "An unexpected error occurred during the AI analysis workflow.";
};

export const analyzeJobMatches = async (
  resumeText: string,
  jobs: JobDescription[]
): Promise<MatchResult[]> => {
    
    const jobDescriptionsJson = JSON.stringify(jobs.map(j => ({id: j.id, title: j.title, description: j.description})));

    const prompt = `
    You are an expert AI career advisor and talent acquisition specialist. Your task is to analyze a candidate's resume and compare it against several job descriptions to determine the best fit.

    **Candidate's Resume:**
    ---
    ${resumeText}
    ---
    
    **Job Descriptions:**
    ---
    ${jobDescriptionsJson}
    ---
    
    For each job description, please perform the following analysis:
    1.  Identify the key skills, technologies, and qualifications required by the job.
    2.  Identify the key skills, technologies, and experience present in the candidate's resume.
    3.  Compare the two and calculate a "match percentage" from 0 to 100. This score should reflect how well the candidate's skills and experience align with the job's core requirements. A higher score means a better match.
    4.  Provide a concise summary explaining the match score.
    5.  List the top 5 most relevant skills from the resume that match the job description.
    6.  List the top 5 most critical skills or qualifications from the job description that are missing from the resume. For each missing skill, provide a brief (1-sentence) explanation of its importance or context within the job role.
    
    Return your analysis as a JSON object that adheres to the provided schema. The output should be a JSON array where each object corresponds to one of the provided jobs. Do not include any introductory text, explanations, or markdown formatting outside of the JSON object itself.
    `;

  try {
    const response = await executeWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
      });
    });

    const jsonText = response.text.trim();
    const results = JSON.parse(jsonText);
    return validateMatchResults(results);

  } catch (error) {
    console.error("Error analyzing job matches:", error);
    throw new Error(getDetailedErrorMessage(error));
  }
};
