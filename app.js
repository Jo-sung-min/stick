const STORAGE_KEY = "stick-ideas-v1";

const seedIdeas = [
  {
    id: crypto.randomUUID(),
    title: "매일 한 문장씩 쓰는 감정 일기",
    content: "복잡한 기록 대신 오늘의 감정을 한 문장과 하나의 색으로만 남기는 작은 서비스.",
    tags: ["사이드프로젝트", "라이프"],
    status: "active",
    favorite: true,
    createdAt: "2026-06-05T09:30:00.000Z",
  },
  {
    id: crypto.randomUUID(),
    title: "동네의 조용한 작업 공간 지도",
    content: "카페의 콘센트 수보다 소음과 좌석 간격을 중심으로 소개하는 작업 공간 지도.",
    tags: ["로컬", "커뮤니티"],
    status: "spark",
    favorite: false,
    createdAt: "2026-06-03T12:10:00.000Z",
  },
  {
    id: crypto.randomUUID(),
    title: "읽은 문장을 다시 만나는 방법",
    content: "책에서 저장한 문장을 잊을 즈음 무작위로 다시 보여주는 위젯.",
    tags: ["독서", "위젯"],
    status: "done",
    favorite: true,
    createdAt: "2026-05-28T04:20:00.000Z",
  },
];

const statusMap = {
  spark: { label: "씨앗", color: "#d7ff58" },
  active: { label: "진행 중", color: "#cce4ff" },
  done: { label: "완료", color: "#ded5ff" },
};

let ideas = loadIdeas();
let currentFilter = "all";
let editingId = null;

const $ = (selector) => document.querySelector(selector);
const elements = {
  ideaGrid: $("#ideaGrid"),
  emptyState: $("#emptyState"),
  ideaForm: $("#ideaForm"),
  capture: $("#captureSection"),
  captureExpand: $("#captureExpand"),
  titleInput: $("#titleInput"),
  contentInput: $("#contentInput"),
  tagsInput: $("#tagsInput"),
  statusInput: $("#statusInput"),
  searchInput: $("#searchInput"),
  sortSelect: $("#sortSelect"),
  filterTabs: $("#filterTabs"),
  dialog: $("#ideaDialog"),
  editTitle: $("#editTitle"),
  editContent: $("#editContent"),
  editTags: $("#editTags"),
  editStatus: $("#editStatus"),
  toast: $("#toast"),
};

function loadIdeas() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : seedIdeas;
  } catch {
    return seedIdeas;
  }
}

function saveIdeas() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(dateString));
}

function render() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const sort = elements.sortSelect.value;
  const filtered = ideas
    .filter((idea) => {
      const matchesFilter = currentFilter === "all"
        || (currentFilter === "favorite" && idea.favorite)
        || idea.status === currentFilter;
      const searchable = `${idea.title} ${idea.content} ${idea.tags.join(" ")}`.toLowerCase();
      return matchesFilter && searchable.includes(query);
    })
    .sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "title") return a.title.localeCompare(b.title, "ko");
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  elements.ideaGrid.innerHTML = filtered.map((idea) => {
    const status = statusMap[idea.status] || statusMap.spark;
    return `
      <article class="idea-card" data-id="${idea.id}" style="--accent:${status.color}" tabindex="0">
        <div class="card-top">
          <span class="status-badge">${status.label}</span>
          <button class="favorite-button ${idea.favorite ? "active" : ""}" data-favorite="${idea.id}" aria-label="즐겨찾기" type="button">${idea.favorite ? "★" : "☆"}</button>
        </div>
        <h3>${escapeHtml(idea.title)}</h3>
        <p>${escapeHtml(idea.content || "아직 설명이 없어요. 열어서 생각을 더해보세요.")}</p>
        <div class="card-footer">
          <div class="tag-list">${idea.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>
          <span class="card-date">${formatDate(idea.createdAt)}</span>
        </div>
      </article>
    `;
  }).join("");

  elements.emptyState.hidden = filtered.length > 0;
  $("#totalCount").textContent = ideas.length;
  $("#activeCount").textContent = ideas.filter((idea) => idea.status === "active").length;
  $("#favoriteCount").textContent = ideas.filter((idea) => idea.favorite).length;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function openCapture() {
  elements.capture.classList.add("open");
  elements.capture.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => elements.titleInput.focus(), 350);
}

function openIdea(id) {
  const idea = ideas.find((item) => item.id === id);
  if (!idea) return;
  editingId = id;
  elements.editTitle.value = idea.title;
  elements.editContent.value = idea.content;
  elements.editTags.value = idea.tags.join(", ");
  elements.editStatus.value = idea.status;
  elements.dialog.showModal();
}

elements.captureExpand.addEventListener("click", () => elements.capture.classList.toggle("open"));
$("#topAddButton").addEventListener("click", openCapture);

elements.ideaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  ideas.unshift({
    id: crypto.randomUUID(),
    title: elements.titleInput.value.trim(),
    content: elements.contentInput.value.trim(),
    tags: elements.tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    status: elements.statusInput.value,
    favorite: false,
    createdAt: new Date().toISOString(),
  });
  saveIdeas();
  elements.ideaForm.reset();
  elements.capture.classList.remove("open");
  render();
  showToast("새 아이디어를 붙여두었어요.");
});

elements.ideaGrid.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const idea = ideas.find((item) => item.id === favoriteButton.dataset.favorite);
    idea.favorite = !idea.favorite;
    saveIdeas();
    render();
    return;
  }
  const card = event.target.closest(".idea-card");
  if (card) openIdea(card.dataset.id);
});

elements.ideaGrid.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches(".idea-card")) openIdea(event.target.dataset.id);
});

elements.filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  elements.filterTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

elements.searchInput.addEventListener("input", render);
elements.sortSelect.addEventListener("change", render);

$("#saveEditButton").addEventListener("click", () => {
  const idea = ideas.find((item) => item.id === editingId);
  const title = elements.editTitle.value.trim();
  if (!idea || !title) return elements.editTitle.focus();
  idea.title = title;
  idea.content = elements.editContent.value.trim();
  idea.tags = elements.editTags.value.split(",").map((tag) => tag.trim()).filter(Boolean);
  idea.status = elements.editStatus.value;
  saveIdeas();
  elements.dialog.close();
  render();
  showToast("아이디어를 업데이트했어요.");
});

$("#deleteButton").addEventListener("click", () => {
  ideas = ideas.filter((item) => item.id !== editingId);
  saveIdeas();
  elements.dialog.close();
  render();
  showToast("아이디어를 삭제했어요.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    event.preventDefault();
    elements.searchInput.focus();
  }
});

render();
