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
