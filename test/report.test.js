import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCareerPrompt, extractJsonObject, validateCareerReport } from "../src/report.js";

test("extractJsonObject parses JSON wrapped in a markdown code fence", () => {
  const response = [
    "Here is the report:",
    "```json",
    "{\"profileSummary\":\"Backend learner\",\"recommendedRoles\":[],\"skillGaps\":[],\"hiringProbability\":{},\"salaryBenchmarks\":{},\"resumeAtsReview\":{},\"optimizedResumeBullets\":[],\"interviewPrepPlan\":[],\"next7DaysPlan\":[]}",
    "```",
  ].join("\n");

  const parsed = extractJsonObject(response);

  assert.equal(parsed.profileSummary, "Backend learner");
});

test("validateCareerReport rejects reports missing required sections", () => {
  assert.throws(
    () => validateCareerReport({ profileSummary: "Only a summary" }),
    /recommendedRoles/
  );
});

test("validateCareerReport requires role recommendation fields", () => {
  assert.throws(
    () =>
      validateCareerReport({
        profileSummary: "Candidate summary",
        recommendedRoles: [{ title: "Frontend Engineer" }],
        skillGaps: [],
        hiringProbability: {},
        salaryBenchmarks: {},
        resumeAtsReview: {},
        optimizedResumeBullets: [],
        interviewPrepPlan: [],
        next7DaysPlan: [],
      }),
    /fitScore/
  );
});

test("buildCareerPrompt requests strict JSON and includes user context", () => {
  const prompt = buildCareerPrompt({
    profileText: "React, Node, internship projects",
    targetRoles: "Frontend, full-stack",
    location: "Bengaluru",
    experienceLevel: "Entry level",
  });

  assert.match(prompt, /strict JSON/i);
  assert.match(prompt, /Frontend, full-stack/);
  assert.match(prompt, /Bengaluru/);
  assert.match(prompt, /Entry level/);
  assert.match(prompt, /React, Node/);
});
