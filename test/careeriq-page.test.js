import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function extractFunction(name) {
  const start = page.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist in index.html`);
  const bodyStart = page.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < page.length; index += 1) {
    if (page[index] === "{") depth += 1;
    if (page[index] === "}") depth -= 1;
    if (depth === 0) return page.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}.`);
}

test("CareerIQ parses JSON even when Gemini wraps it with extra text", () => {
  const source = `${extractFunction("extractJsonObject")}; return extractJsonObject(response);`;
  const response = [
    "```json",
    "{\"hiring_probability\":72,\"ats_score\":81}",
    "```",
    "I also added an explanation after the JSON.",
  ].join("\n");

  const parsed = Function("response", source)(response);

  assert.equal(parsed.hiring_probability, 72);
  assert.equal(parsed.ats_score, 81);
});

test("CareerIQ asks Gemini for job listings and includes swipe deck containers", () => {
  assert.match(page, /"job_listings"/);
  assert.match(page, /id="job-swipe-deck"/);
  assert.match(page, /id="saved-jobs-list"/);
  assert.match(page, /function saveJob/);
  assert.match(page, /function ignoreJob/);
});

test("CareerIQ uses Gemini JSON mode config and a fallback report path", () => {
  assert.match(page, /generationConfig/);
  assert.match(page, /responseMimeType:\s*'application\/json'/);
  assert.match(page, /maxOutputTokens:\s*6144/);
  assert.match(page, /function buildFallbackReport/);
  assert.match(page, /return buildFallbackReport\(resume, role, market, level\)/);
});

test("CareerIQ includes personalized learning resources", () => {
  assert.match(page, /"learning_path"/);
  assert.match(page, /id="learning-path-list"/);
  assert.match(page, /function renderLearningPath/);
  assert.match(page, /function fallbackLearningPath/);
  assert.match(page, /https:\/\/www\.cloudskillsboost\.google/);
  assert.match(page, /https:\/\/www\.freecodecamp\.org/);
});

test("CareerIQ generates an ATS friendly optimized CV with PDF and Word downloads", () => {
  assert.match(page, /"optimized_cv"/);
  assert.match(page, /id="optimized-cv-preview"/);
  assert.match(page, /id="cv-download-document"/);
  assert.match(page, /function renderOptimizedCv/);
  assert.match(page, /function downloadOptimizedCvPdf/);
  assert.match(page, /function downloadOptimizedCvWord/);
  assert.match(page, /ATS-friendly, one-column resume/);
  assert.match(page, /html2pdf\.bundle\.min\.js/);
});

test("CareerIQ turns saved jobs into verified application drafts with resume support", () => {
  assert.match(page, /Create Application Draft/);
  assert.match(page, /function toggleApplicationDraft/);
  assert.match(page, /function verifyApplicationDraft/);
  assert.match(page, /function buildApplicationPacket/);
  assert.match(page, /function downloadApplicationCvWord/);
  assert.match(page, /function openApplySearch/);
  assert.match(page, /Review and verify before applying/);
});
