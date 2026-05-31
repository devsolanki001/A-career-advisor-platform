const REQUIRED_SECTIONS = [
  "profileSummary",
  "recommendedRoles",
  "skillGaps",
  "hiringProbability",
  "salaryBenchmarks",
  "resumeAtsReview",
  "optimizedResumeBullets",
  "interviewPrepPlan",
  "next7DaysPlan",
];

const REQUIRED_ROLE_FIELDS = [
  "title",
  "fitScore",
  "hiringProbability",
  "matchingSkills",
  "missingSkills",
  "whyThisRoleFits",
  "improvementActions",
];

export function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Gemini returned an empty response.");
  }

  const withoutFence = rawText
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Gemini response did not contain a JSON object.");
    }

    return JSON.parse(rawText.slice(start, end + 1));
  }
}

export function validateCareerReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("Career report must be a JSON object.");
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!(section in report)) {
      throw new Error(`Career report is missing "${section}".`);
    }
  }

  if (!Array.isArray(report.recommendedRoles)) {
    throw new Error('Career report field "recommendedRoles" must be an array.');
  }

  report.recommendedRoles.forEach((role, index) => {
    for (const field of REQUIRED_ROLE_FIELDS) {
      if (!(field in role)) {
        throw new Error(`recommendedRoles[${index}] is missing "${field}".`);
      }
    }
  });

  return report;
}

export function buildCareerPrompt({ profileText, targetRoles, location, experienceLevel }) {
  const trimmedProfile = String(profileText || "").trim();
  const requestedRoles = String(targetRoles || "Open to best-fit roles").trim();
  const marketLocation = String(location || "User's target market").trim();
  const level = String(experienceLevel || "Not specified").trim();

  return `
You are CareerLens AI, a rigorous career advisor for job seekers. Analyze the candidate profile and produce personalized, actionable career intelligence.

Return strict JSON only. Do not include markdown, commentary, or prose outside the JSON object. Start with "{" and end with "}".

Candidate profile:
${trimmedProfile}

Target roles or interests: ${requestedRoles}
Target location: ${marketLocation}
Experience level: ${level}

Use advisory estimates for salary and hiring probability. Be honest about uncertainty. Do not invent exact market facts; frame them as estimates based on common labor-market patterns for the role, location, skills, and seniority.

Required JSON shape:
{
  "profileSummary": "Short advisor-style summary of the candidate's market position.",
  "recommendedRoles": [
    {
      "title": "Role title",
      "fitScore": 0,
      "hiringProbability": 0,
      "matchingSkills": ["skill"],
      "missingSkills": ["skill"],
      "whyThisRoleFits": "Reason this role fits.",
      "improvementActions": ["specific action"]
    }
  ],
  "skillGaps": [
    {
      "skill": "Skill name",
      "importance": "High | Medium | Low",
      "currentEvidence": "Evidence found or missing from profile.",
      "action": "Specific improvement action."
    }
  ],
  "hiringProbability": {
    "overallScore": 0,
    "confidence": "High | Medium | Low",
    "strongSignals": ["signal"],
    "riskFactors": ["risk"],
    "howToImprove": ["action"]
  },
  "salaryBenchmarks": {
    "currency": "INR or local currency",
    "location": "${marketLocation}",
    "estimatedRange": "Example: 6 LPA - 12 LPA",
    "drivers": ["factor"],
    "disclaimer": "Advisory estimate, not a guaranteed offer range."
  },
  "resumeAtsReview": {
    "atsScore": 0,
    "missingKeywords": ["keyword"],
    "formattingWarnings": ["warning"],
    "topFixes": ["fix"]
  },
  "optimizedResumeBullets": [
    "Rewritten resume bullet with measurable impact."
  ],
  "interviewPrepPlan": [
    {
      "topic": "Topic",
      "questions": ["question"],
      "practiceTask": "Practice task"
    }
  ],
  "next7DaysPlan": [
    {
      "day": "Day 1",
      "focus": "Focus area",
      "actions": ["action"],
      "outcome": "Expected outcome"
    }
  ]
}

Rules:
- Scores must be numbers from 0 to 100.
- Recommend 3 to 5 roles.
- Make advice specific to the uploaded profile, target roles, experience level, and location.
- If profile evidence is weak, say what evidence is missing and how to add it.
`.trim();
}
