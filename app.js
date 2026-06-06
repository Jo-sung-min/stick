const STORAGE_KEY = "stick-projects-v2";
const accents = ["#d7ff58", "#cce4ff", "#ffd5be", "#ded5ff"];

const seedProjects = [{
  id: crypto.randomUUID(),
  name: "나만의 브랜드 만들기",
  description: "브랜드의 분위기, 콘텐츠와 제품 아이디어를 한곳에 모으는 프로젝트",
  accent: accents[0],
  createdAt: new Date().toISOString(),
  ideas: [{ id: crypto.randomUUID(), type: "idea", title: "매일 쓰고 싶은 물건을 만든다", body: "보기 좋은 것보다 손이 자주 가는 제품을 브랜드의 기준으로 삼기.", tags: ["브랜드", "방향성"], createdAt: new Date().toISOString() }],
  inspirations: []
}];

let projects = loadProjects();
let activeProjectId = null;
let activeTab = "all";
let activeRecord = null;
let editingRecord = null;
let fetchedMetadata = null;
let draggedRecord = null;
let suppressRecordClick = false;
const $ = (selector) => document.querySelector(selector);

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedProjects; }
  catch { return seedProjects; }
}
function saveProjects() { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
function validProjects(value) {
  return Array.isArray(value) && value.every((project) =>
    project && typeof project === "object"
    && typeof project.id === "string"
    && typeof project.name === "string"
    && Array.isArray(project.ideas)
    && Array.isArray(project.inspirations)
  );
}
function exportData() {
  const data = JSON.stringify({ format: "stick-backup", version: 1, exportedAt: new Date().toISOString(), projects }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `stick-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("데이터를 파일로 저장했습니다.");
}
async function importData(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const importedProjects = Array.isArray(parsed) ? parsed : parsed.projects;
    if (!validProjects(importedProjects)) throw new Error("invalid backup");
    if (!confirm("현재 데이터를 선택한 파일의 데이터로 교체할까요?")) return;
    projects = importedProjects;
    saveProjects();
    closeDialogs();
    showHome();
    showToast("파일에서 데이터를 불러왔습니다.");
  } catch {
    showToast("올바른 stick 데이터 파일이 아닙니다.");
  } finally {
    $("#importDataInput").value = "";
  }
}
function activeProject() { return projects.find((project) => project.id === activeProjectId); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]); }
function formatDate(value) { return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value)); }
function tags(value) { return value.split(",").map((tag) => tag.trim()).filter(Boolean); }
function sourceFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("instagram.com")) return "instagram";
    return "web";
  } catch { return "web"; }
}
function sourceLabel(source) { return ({ youtube: "YouTube", instagram: "Instagram", web: "Web", idea: "My Idea" })[source] || source; }
function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (!host.includes("youtube.com")) return "";
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || "";
    return "";
  } catch { return ""; }
}
async function fetchJson(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function fetchYoutubeMetadata(url) {
  const videoId = youtubeVideoId(url);
  if (!videoId) throw new Error("invalid youtube url");
  // noembed exposes YouTube's oEmbed data with browser-compatible CORS headers.
  const data = await fetchJson(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
  if (data.error) throw new Error(data.error);
  return {
    title: data.title || "YouTube 영상",
    description: data.author_name ? `${data.author_name} 채널의 YouTube 영상` : "",
    image: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    source: "youtube",
  };
}
async function fetchGeneralMetadata(url) {
  const result = await fetchJson(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
  const data = result.data || {};
  return {
    title: data.title || sourceLabel(sourceFromUrl(url)),
    description: data.description || "",
    image: data.image?.url || data.logo?.url || "",
    source: sourceFromUrl(url),
  };
}
function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2200);
}
function closeDialogs() { document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close()); }

function renderHome() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const filtered = projects.filter((project) => `${project.name} ${project.description} ${[...project.ideas, ...project.inspirations].map((item) => `${item.title} ${item.body || ""}`).join(" ")}`.toLowerCase().includes(query));
  $("#projectGrid").innerHTML = filtered.map((project) => `
    <button class="project-card" style="--accent:${project.accent}" data-project="${project.id}" type="button">
      <span class="project-icon">✦</span>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || "설명이 없는 프로젝트입니다.")}</p>
      <span class="project-meta"><span>아이디어 ${project.ideas.length}</span><span>영감 ${project.inspirations.length}</span></span>
    </button>`).join("");
  $("#projectEmpty").hidden = filtered.length > 0;
  $("#projectCount").textContent = projects.length;
  $("#ideaCount").textContent = projects.reduce((sum, project) => sum + project.ideas.length, 0);
  $("#inspirationCount").textContent = projects.reduce((sum, project) => sum + project.inspirations.length, 0);
}

function renderDetail() {
  const project = activeProject();
  if (!project) return showHome();
  $("#detailIcon").style.setProperty("--accent", project.accent);
  $("#detailTitle").textContent = project.name;
  $("#detailDescription").textContent = project.description || "이 프로젝트에 아이디어와 영감을 모아보세요.";
  const query = $("#searchInput").value.trim().toLowerCase();
  const type = $("#typeFilter").value;
  const matchesQuery = (item) => `${item.title} ${item.body || ""} ${(item.tags || []).join(" ")}`.toLowerCase().includes(query);
  const ideas = project.ideas.filter(matchesQuery);
  const inspirations = project.inspirations
    .filter((item) => type === "all" || item.source === type)
    .filter(matchesQuery);
  $("#collectionTitle").textContent = ({ all: "모든 기록", ideas: "나의 아이디어", inspirations: "영감 자료" })[activeTab];
  $("#typeFilter").hidden = activeTab === "ideas";
  $("#ideaPanel").hidden = activeTab === "inspirations";
  $("#inspirationPanel").hidden = activeTab === "ideas";
  $("#collectionBoard").classList.toggle("single-panel", activeTab !== "all");
  $("#ideaRecordCount").textContent = ideas.length;
  $("#inspirationRecordCount").textContent = inspirations.length;
  $("#ideaCollectionGrid").innerHTML = ideas.map(recordCard).join("");
  $("#inspirationCollectionGrid").innerHTML = inspirations.map(recordCard).join("");
  $("#ideaCollectionEmpty").hidden = ideas.length > 0;
  $("#inspirationCollectionEmpty").hidden = inspirations.length > 0;
}

function recordCard(item) {
  return `
    <button class="record-card" data-record="${item.id}" data-record-type="${item.type}" draggable="true" aria-label="${escapeHtml(item.title)}, 드래그하여 순서 변경" type="button">
      ${item.image ? `<img class="record-image" src="${escapeHtml(item.image)}" alt="" />` : ""}
      <span class="record-card-body">
        <span class="source-badge ${item.type === "idea" ? "idea" : ""}">${sourceLabel(item.source || "idea")}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body || "저장된 메모가 없습니다.")}</p>
        <span class="record-foot"><span>${(item.tags || []).slice(0, 2).map((tag) => `#${escapeHtml(tag)}`).join(" ")}</span><span>${formatDate(item.createdAt)}</span></span>
      </span>
    </button>`;
}

function showHome() {
  activeProjectId = null;
  $("#projectHome").hidden = false;
  $("#projectDetail").hidden = true;
  $("#headerAddButton").textContent = "+ 새 프로젝트";
  renderHome();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showProject(id) {
  activeProjectId = id;
  activeTab = "all";
  $("#projectHome").hidden = true;
  $("#projectDetail").hidden = false;
  $("#headerAddButton").textContent = "+ 기록 추가";
  $("#contentTabs").querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.tab === "all"));
  renderDetail();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openProjectDialog() { $("#projectForm").reset(); $("#projectDialog").showModal(); }
function openIdeaDialog(record = null) {
  editingRecord = record;
  $("#ideaForm").reset();
  $("#ideaForm").querySelector(".dialog-head h2").textContent = record ? "아이디어 수정" : "아이디어 추가";
  $("#ideaForm").querySelector('[type="submit"]').textContent = record ? "수정 내용 저장" : "아이디어 저장";
  if (record) {
    $("#ideaTitleInput").value = record.title || "";
    $("#ideaContentInput").value = record.body || "";
    $("#ideaTagsInput").value = (record.tags || []).join(", ");
  }
  $("#ideaDialog").showModal();
}
function openInspirationDialog(record = null) {
  editingRecord = record;
  $("#inspirationForm").reset();
  $("#inspirationForm").querySelector(".dialog-head h2").textContent = record ? "영감 정보 수정" : "영감 정보 추가";
  $("#inspirationForm").querySelector('[type="submit"]').textContent = record ? "수정 내용 저장" : "영감 자료 저장";
  $("#metadataPreview").hidden = true;
  $("#fetchStatus").textContent = "주소를 붙여넣으면 제목과 내용을 자동으로 가져옵니다.";
  fetchedMetadata = record ? { source: record.source, image: record.image, description: record.body } : null;
  if (record) {
    $("#urlInput").value = record.url || "";
    $("#inspirationTitleInput").value = record.title || "";
    $("#inspirationMemoInput").value = record.body || "";
    $("#inspirationTagsInput").value = (record.tags || []).join(", ");
    if (record.image) {
      $("#previewImage").src = record.image;
      $("#previewImage").hidden = false;
      $("#previewSource").textContent = sourceLabel(record.source || "web");
      $("#previewTitle").textContent = record.title || "";
      $("#previewDescription").textContent = record.body || "";
      $("#metadataPreview").hidden = false;
    }
  }
  $("#inspirationDialog").showModal();
}

async function fetchMetadata() {
  const url = $("#urlInput").value.trim();
  if (!url) return $("#urlInput").focus();
  try { new URL(url); } catch {
    $("#fetchStatus").textContent = "올바른 주소를 입력해주세요.";
    return;
  }
  $("#fetchMetadataButton").disabled = true;
  $("#fetchStatus").textContent = "주소에서 정보를 가져오는 중입니다...";
  try {
    fetchedMetadata = sourceFromUrl(url) === "youtube"
      ? await fetchYoutubeMetadata(url)
      : await fetchGeneralMetadata(url);
    $("#inspirationTitleInput").value = fetchedMetadata.title;
    $("#previewTitle").textContent = fetchedMetadata.title;
    $("#previewDescription").textContent = fetchedMetadata.description || "내용을 가져오지 못했습니다. 메모를 직접 추가할 수 있습니다.";
    $("#previewSource").textContent = sourceLabel(fetchedMetadata.source);
    $("#previewImage").src = fetchedMetadata.image;
    $("#previewImage").hidden = !fetchedMetadata.image;
    $("#metadataPreview").hidden = false;
    $("#fetchStatus").textContent = "정보를 가져왔습니다. 내용을 확인한 뒤 저장하세요.";
  } catch {
    const source = sourceFromUrl(url);
    const videoId = youtubeVideoId(url);
    fetchedMetadata = {
      title: source === "youtube" ? "YouTube 영상" : "",
      description: "",
      image: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
      source,
    };
    $("#inspirationTitleInput").value ||= fetchedMetadata.title || sourceLabel(source);
    $("#previewTitle").textContent = $("#inspirationTitleInput").value;
    $("#previewDescription").textContent = source === "youtube"
      ? "영상 썸네일은 확인했습니다. 제목을 가져오지 못해 직접 수정할 수 있습니다."
      : "내용을 가져오지 못했습니다. 제목과 메모를 직접 입력할 수 있습니다.";
    $("#previewSource").textContent = sourceLabel(source);
    $("#previewImage").src = fetchedMetadata.image;
    $("#previewImage").hidden = !fetchedMetadata.image;
    $("#metadataPreview").hidden = false;
    $("#fetchStatus").textContent = source === "youtube"
      ? "YouTube 정보를 일부 가져왔습니다. 제목을 확인해주세요."
      : "자동으로 가져오지 못했습니다. 제목과 메모를 직접 입력해 저장할 수 있습니다.";
  } finally { $("#fetchMetadataButton").disabled = false; }
}

function openRecord(id, type) {
  const project = activeProject();
  activeRecord = (type === "idea" ? project.ideas : project.inspirations).find((item) => item.id === id);
  if (!activeRecord) return;
  $("#recordImage").src = activeRecord.image || "";
  $("#recordImage").hidden = !activeRecord.image;
  $("#recordSource").textContent = sourceLabel(activeRecord.source || "idea");
  $("#recordSource").classList.toggle("idea", activeRecord.type === "idea");
  $("#recordTitle").textContent = activeRecord.title;
  $("#recordBody").textContent = activeRecord.body || "저장된 메모가 없습니다.";
  $("#recordTags").innerHTML = (activeRecord.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
  $("#recordLink").href = activeRecord.url || "#";
  $("#recordLink").hidden = !activeRecord.url;
  $("#recordDialog").showModal();
}

function clearDropIndicators() {
  document.querySelectorAll(".drop-target, .drop-target-grid").forEach((element) => element.classList.remove("drop-target", "drop-target-grid"));
}

function reorderRecord(type, sourceId, targetId) {
  const project = activeProject();
  const key = type === "idea" ? "ideas" : "inspirations";
  const records = project[key];
  const sourceIndex = records.findIndex((item) => item.id === sourceId);
  if (sourceIndex < 0 || sourceId === targetId) return false;
  const [moved] = records.splice(sourceIndex, 1);
  const targetIndex = targetId ? records.findIndex((item) => item.id === targetId) : records.length;
  records.splice(targetIndex < 0 ? records.length : targetIndex, 0, moved);
  saveProjects();
  return true;
}

$("#projectForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const project = { id: crypto.randomUUID(), name: $("#projectNameInput").value.trim(), description: $("#projectDescriptionInput").value.trim(), accent: accents[projects.length % accents.length], createdAt: new Date().toISOString(), ideas: [], inspirations: [] };
  projects.unshift(project); saveProjects(); closeDialogs(); showProject(project.id); showToast("새 프로젝트를 만들었습니다.");
});
$("#ideaForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = { title: $("#ideaTitleInput").value.trim(), body: $("#ideaContentInput").value.trim(), tags: tags($("#ideaTagsInput").value) };
  if (editingRecord?.type === "idea") Object.assign(editingRecord, values);
  else activeProject().ideas.unshift({ id: crypto.randomUUID(), type: "idea", source: "idea", ...values, createdAt: new Date().toISOString() });
  editingRecord = null;
  saveProjects(); closeDialogs(); renderDetail(); showToast("아이디어를 저장했습니다.");
});
$("#inspirationForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const url = $("#urlInput").value.trim();
  const values = { source: fetchedMetadata?.source || sourceFromUrl(url), title: $("#inspirationTitleInput").value.trim(), body: $("#inspirationMemoInput").value.trim() || fetchedMetadata?.description || "", image: fetchedMetadata?.image || "", url, tags: tags($("#inspirationTagsInput").value) };
  if (editingRecord?.type === "inspiration") Object.assign(editingRecord, values);
  else activeProject().inspirations.unshift({ id: crypto.randomUUID(), type: "inspiration", ...values, createdAt: new Date().toISOString() });
  editingRecord = null;
  saveProjects(); closeDialogs(); renderDetail(); showToast("영감 자료를 저장했습니다.");
});

$("#projectGrid").addEventListener("click", (event) => { const card = event.target.closest("[data-project]"); if (card) showProject(card.dataset.project); });
$("#collectionBoard").addEventListener("click", (event) => {
  if (suppressRecordClick) return;
  const card = event.target.closest("[data-record]");
  if (card) openRecord(card.dataset.record, card.dataset.recordType);
});
$("#collectionBoard").addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-record]");
  if (!card) return;
  suppressRecordClick = true;
  draggedRecord = { id: card.dataset.record, type: card.dataset.recordType };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.record);
  requestAnimationFrame(() => card.classList.add("dragging"));
});
$("#collectionBoard").addEventListener("dragover", (event) => {
  if (!draggedRecord) return;
  const grid = event.target.closest("[data-record-list]");
  if (!grid || grid.dataset.recordList !== draggedRecord.type) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearDropIndicators();
  const target = event.target.closest("[data-record]");
  if (target && target.dataset.record !== draggedRecord.id) target.classList.add("drop-target");
  else grid.classList.add("drop-target-grid");
});
$("#collectionBoard").addEventListener("drop", (event) => {
  if (!draggedRecord) return;
  const grid = event.target.closest("[data-record-list]");
  if (!grid || grid.dataset.recordList !== draggedRecord.type) return;
  event.preventDefault();
  const target = event.target.closest("[data-record]");
  const changed = reorderRecord(draggedRecord.type, draggedRecord.id, target?.dataset.record || null);
  suppressRecordClick = true;
  clearDropIndicators();
  if (changed) {
    renderDetail();
    showToast("기록 순서를 변경했습니다.");
  }
  draggedRecord = null;
  setTimeout(() => { suppressRecordClick = false; }, 100);
});
$("#collectionBoard").addEventListener("dragend", () => {
  clearDropIndicators();
  document.querySelectorAll(".record-card.dragging").forEach((card) => card.classList.remove("dragging"));
  draggedRecord = null;
  setTimeout(() => { suppressRecordClick = false; }, 100);
});
$("#contentTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-tab]"); if (!button) return; activeTab = button.dataset.tab; $("#contentTabs").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); renderDetail(); });
$("#deleteRecordButton").addEventListener("click", () => {
  const project = activeProject(); const key = activeRecord.type === "idea" ? "ideas" : "inspirations";
  project[key] = project[key].filter((item) => item.id !== activeRecord.id); saveProjects(); closeDialogs(); renderDetail(); showToast("기록을 삭제했습니다.");
});
$("#deleteProjectButton").addEventListener("click", () => { if (!confirm("이 프로젝트와 안의 모든 기록을 삭제할까요?")) return; projects = projects.filter((project) => project.id !== activeProjectId); saveProjects(); showHome(); showToast("프로젝트를 삭제했습니다."); });
$("#newProjectButton").addEventListener("click", openProjectDialog);
$("#exportDataButton").addEventListener("click", exportData);
$("#importDataButton").addEventListener("click", () => $("#importDataInput").click());
$("#importDataInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importData(file);
});
$("#editRecordButton").addEventListener("click", () => {
  const record = activeRecord;
  closeDialogs();
  if (record.type === "idea") openIdeaDialog(record);
  else openInspirationDialog(record);
});
$("#headerAddButton").addEventListener("click", () => activeProjectId ? openIdeaDialog() : openProjectDialog());
$("#addIdeaButton").addEventListener("click", () => openIdeaDialog());
$("#addInspirationButton").addEventListener("click", () => openInspirationDialog());
$("#fetchMetadataButton").addEventListener("click", fetchMetadata);
$("#urlInput").addEventListener("paste", () => setTimeout(fetchMetadata, 50));
$("#homeButton").addEventListener("click", showHome);
$("#backButton").addEventListener("click", showHome);
$("#typeFilter").addEventListener("change", renderDetail);
$("#searchInput").addEventListener("input", () => activeProjectId ? renderDetail() : renderHome());
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeDialogs));
document.addEventListener("keydown", (event) => { if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) { event.preventDefault(); $("#searchInput").focus(); } });

renderHome();
