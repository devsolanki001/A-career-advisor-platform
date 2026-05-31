const form = document.querySelector("#profile-form");
const fileInput = document.querySelector("#resume-file");
const fileStatus = document.querySelector("#file-status");
const profileText = document.querySelector("#profile-text");
const analyzeButton = document.querySelector("#analyze-button");
const alertBox = document.querySelector("#alert");
const loading = document.querySelector("#loading");
const results = document.querySelector("#results");
const retryButton = document.querySelector("#retry-button");

let lastPayload = null;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    profileText.value = text.trim();
    fileStatus.textContent = `${file.name} loaded`;
    hideAlert();
  } catch {
    showAlert("Could not read this file. Please paste the resume text directly.");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = getPayload();
  await analyze(payload);
});

retryButton.addEventListener("click", async () => {
  if (lastPayload) {
    await analyze(lastPayload);
  }
});

function getPayload() {
  const data = new FormData(form);
  return {
    profileText: String(data.get("profileText") || "").trim(),
    targetRoles: String(data.get("targetRoles") || "").trim(),
    location: String(data.get("location") || "").trim(),
    experienceLevel: String(data.get("experienceLevel") || "").trim(),
  };
}

async function analyze(payload) {
  hideAlert();

  if (payload.profileText.length < 80) {
    showAlert("Paste more profile detail first: skills, projects, education, experience, and target roles.");
    return;
  }

  lastPayload = payload;
  setLoading(true);

  try {
    const response = await fetch("/api/analyze-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "CareerLens could not generate the advisor report.");
    }

    renderReport(data.report);
  } catch (error) {
    showAlert(`${error.message} Use Regenerate after fixing the issue.`);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  analyzeButton.disabled = isLoading;
  analyzeButton.querySelector("span").textContent = isLoading ? "Analyzing..." : "Analyze Career Fit";
}

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.classList.remove("hidden");
}

function hideAlert() {
  alertBox.classList.add("hidden");
  alertBox.textContent = "";
}

function renderReport(report) {
  results.classList.remove("hidden");
  document.querySelector("#profile-summary").textContent = safeText(report.profileSummary);

  const overallScore = numberOrDash(report.hiringProbability?.overallScore);
  document.querySelector("#overall-score").textContent = overallScore;
  document.querySelector("#confidence").textContent = safeText(report.hiringProbability?.confidence, "Confidence unknown");

  renderRoles(report.recommendedRoles || []);
  renderSkillGaps(report.skillGaps || []);
  renderHiringSignals(report.hiringProbability || {});
  renderSalary(report.salaryBenchmarks || {});
  renderAtsReview(report.resumeAtsReview || {});
  renderList("#resume-bullets", report.optimizedResumeBullets || []);
  renderInterview(report.interviewPrepPlan || []);
  renderSevenDayPlan(report.next7DaysPlan || []);

  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRoles(roles) {
  const roleGrid = document.querySelector("#role-grid");
  roleGrid.innerHTML = "";

  roles.forEach((role) => {
    const card = document.createElement("article");
    card.className = "role-card";
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(role.title)}</h3>
          <p>${escapeHtml(role.whyThisRoleFits)}</p>
        </div>
        <span class="metric">${numberOrDash(role.fitScore)}</span>
      </header>
      <div>
        <strong>Hiring probability: ${numberOrDash(role.hiringProbability)}</strong>
      </div>
      <div class="chip-row">${toChips(role.matchingSkills, "Match")}</div>
      <div class="chip-row">${toChips(role.missingSkills, "Gap")}</div>
      <div class="list-card">
        <strong>Advisor actions</strong>
        <p>${escapeHtml(asSentence(role.improvementActions))}</p>
      </div>
    `;
    roleGrid.append(card);
  });
}

function renderSkillGaps(gaps) {
  document.querySelector("#gap-count").textContent = `${gaps.length} gaps`;
  const container = document.querySelector("#skill-gaps");
  container.innerHTML = "";

  gaps.forEach((gap) => {
    const importance = String(gap.importance || "Medium").toLowerCase();
    const item = document.createElement("div");
    item.className = "list-card";
    item.innerHTML = `
      <strong>
        ${escapeHtml(gap.skill)}
        <span class="importance ${escapeHtml(importance)}">${escapeHtml(gap.importance || "Medium")}</span>
      </strong>
      <p>${escapeHtml(gap.currentEvidence || "Evidence not clear in profile.")}</p>
      <p>${escapeHtml(gap.action || "Add proof through a project, metric, or certification.")}</p>
    `;
    container.append(item);
  });
}

function renderHiringSignals(probability) {
  const container = document.querySelector("#hiring-signals");
  container.innerHTML = "";

  const sections = [
    ["Strong signals", probability.strongSignals || []],
    ["Risk factors", probability.riskFactors || []],
    ["How to improve", probability.howToImprove || []],
  ];

  sections.forEach(([title, items]) => {
    const card = document.createElement("div");
    card.className = "list-card";
    card.innerHTML = `<strong>${title}</strong><p>${escapeHtml(asSentence(items))}</p>`;
    container.append(card);
  });
}

function renderSalary(salary) {
  document.querySelector("#salary-location").textContent = safeText(salary.location, "Market");
  document.querySelector("#salary-range").textContent = safeText(salary.estimatedRange, "Range unavailable");
  document.querySelector("#salary-drivers").innerHTML = toChips(salary.drivers || [], "Driver");
  document.querySelector("#salary-disclaimer").textContent = safeText(
    salary.disclaimer,
    "Advisory estimate, not a guaranteed offer range."
  );
}

function renderAtsReview(review) {
  document.querySelector("#ats-score").textContent = `${numberOrDash(review.atsScore)} ATS`;
  const container = document.querySelector("#ats-review");
  container.innerHTML = "";

  [
    ["Missing keywords", review.missingKeywords || []],
    ["Formatting warnings", review.formattingWarnings || []],
    ["Top fixes", review.topFixes || []],
  ].forEach(([title, items]) => {
    const card = document.createElement("div");
    card.className = "list-card";
    card.innerHTML = `<strong>${title}</strong><p>${escapeHtml(asSentence(items))}</p>`;
    container.append(card);
  });
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  list.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = String(item);
    list.append(li);
  });
}

function renderInterview(items) {
  const container = document.querySelector("#interview-plan");
  container.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "list-card";
    card.innerHTML = `
      <strong>${escapeHtml(item.topic || "Interview topic")}</strong>
      <p>${escapeHtml(asSentence(item.questions || []))}</p>
      <p>${escapeHtml(item.practiceTask || "")}</p>
    `;
    container.append(card);
  });
}

function renderSevenDayPlan(items) {
  const container = document.querySelector("#seven-day-plan");
  container.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    row.innerHTML = `
      <div class="timeline-day">${escapeHtml(item.day || `Day ${index + 1}`)}</div>
      <div class="list-card">
        <strong>${escapeHtml(item.focus || "Career progress")}</strong>
        <p>${escapeHtml(asSentence(item.actions || []))}</p>
        <p>${escapeHtml(item.outcome || "")}</p>
      </div>
    `;
    container.append(row);
  });
}

function toChips(items, fallback) {
  return normalizeArray(items)
    .map((item) => `<span class="chip">${escapeHtml(item || fallback)}</span>`)
    .join("");
}

function asSentence(items) {
  const values = normalizeArray(items).filter(Boolean);
  return values.length ? values.join(" | ") : "No detail returned.";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function numberOrDash(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return String(Math.round(number));
}

function safeText(value, fallback = "--") {
  const text = String(value || "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
