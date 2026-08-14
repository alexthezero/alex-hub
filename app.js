(() => {
  "use strict";

  const TASKS_KEY = "alexHub.tasks.v1";
  const NOTES_KEY = "alexHub.notes.v1";
  const starterTasks = [
    { id: crypto.randomUUID(), title: "Review this week’s priorities", category: "Personal", completed: false },
    { id: crypto.randomUUID(), title: "Check the 3D printer queue", category: "Workshop", completed: false },
    { id: crypto.randomUUID(), title: "Plan tomorrow before signing off", category: "Routine", completed: true },
  ];

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch { return fallback; }
  };

  let tasks = read(TASKS_KEY, starterTasks);
  let notes = read(NOTES_KEY, []);
  let selectedNoteColor = "sage";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  function announce(text = "Saved on this device") {
    const status = $("#save-status");
    status.textContent = text;
    status.classList.add("flash");
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => status.classList.remove("flash"), 1200);
  }

  function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    renderTasks();
    announce();
  }

  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    renderNotes();
    announce();
  }

  function openView(view) {
    $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function taskMarkup(task, removable) {
    return `<div class="task-row${task.completed ? " done" : ""}">
      <label><input type="checkbox" data-toggle-task="${task.id}" ${task.completed ? "checked" : ""}><span class="checkmark" aria-hidden="true">✓</span><span class="task-copy"><strong>${esc(task.title)}</strong><small>${esc(task.category)}</small></span></label>
      ${removable ? `<button class="delete-button" data-delete-task="${task.id}" aria-label="Delete ${esc(task.title)}">×</button>` : ""}
    </div>`;
  }

  function renderTasks() {
    const ordered = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
    $("#today-task-list").innerHTML = ordered.length ? ordered.slice(0, 4).map((task) => taskMarkup(task, false)).join("") : '<p class="inline-empty">Your list is clear. Add your first task above.</p>';
    $("#all-task-list").innerHTML = ordered.length ? ordered.map((task) => taskMarkup(task, true)).join("") : '<p class="inline-empty">Nothing hanging over your head. Add something when you’re ready.</p>';
    $("#task-count").textContent = `${tasks.length} total`;
    const complete = tasks.filter((task) => task.completed).length;
    $("#progress-label").textContent = `${complete}/${tasks.length}`;
    $("#progress-ring").style.setProperty("--progress", `${tasks.length ? (complete / tasks.length) * 360 : 0}deg`);
    $("#progress-copy").textContent = tasks.length === 0 ? "Add a task to start your day." : complete === tasks.length ? "All done. Nice work." : "Keep the momentum going.";
  }

  function addTask(value) {
    const title = value.trim();
    if (!title) return;
    tasks.unshift({ id: crypto.randomUUID(), title: title.slice(0, 240), category: "Inbox", completed: false });
    saveTasks();
  }

  function toggleTask(id) {
    tasks = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
    saveTasks();
  }

  function deleteTask(id) {
    tasks = tasks.filter((task) => task.id !== id);
    saveTasks();
  }

  function renderNotes() {
    const grid = $("#notes-grid");
    grid.innerHTML = notes.map((note) => `<article class="note-card ${note.color}"><div><span class="eyebrow">NOTE</span><h3>${esc(note.title)}</h3><p>${esc(note.content || "No additional details.")}</p></div><footer><small>${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(note.updatedAt))}</small><button data-delete-note="${note.id}" aria-label="Delete ${esc(note.title)}">×</button></footer></article>`).join("");
    $("#notes-empty").hidden = notes.length > 0 || !$("#note-form").hidden;
  }

  function showNoteForm(show = true) {
    const form = $("#note-form");
    form.hidden = !show;
    $("#toggle-note-form").textContent = show ? "Cancel" : "+ New note";
    if (show) setTimeout(() => $("#note-title").focus(), 0);
    renderNotes();
  }

  function initializeDate() {
    const now = new Date();
    $("#date-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now);
    $("#day-badge").textContent = now.getDate();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
    $("#greeting").textContent = `${greeting}, Alex.`;
  }

  $$('[data-view-target]').forEach((button) => button.addEventListener("click", () => openView(button.dataset.viewTarget)));
  $("#today-task-form").addEventListener("submit", (event) => { event.preventDefault(); addTask($("#today-task-input").value); event.target.reset(); });
  $("#all-task-form").addEventListener("submit", (event) => { event.preventDefault(); addTask($("#all-task-input").value); event.target.reset(); });

  document.addEventListener("change", (event) => {
    const id = event.target.dataset.toggleTask;
    if (id) toggleTask(id);
  });
  document.addEventListener("click", (event) => {
    const taskId = event.target.dataset.deleteTask;
    const noteId = event.target.dataset.deleteNote;
    if (taskId) deleteTask(taskId);
    if (noteId) { notes = notes.filter((note) => note.id !== noteId); saveNotes(); }
  });

  $("#toggle-note-form").addEventListener("click", () => showNoteForm($("#note-form").hidden));
  $("#first-note-button").addEventListener("click", () => showNoteForm(true));
  $$("[data-note-color]").forEach((button) => button.addEventListener("click", () => {
    selectedNoteColor = button.dataset.noteColor;
    $$("[data-note-color]").forEach((item) => item.classList.toggle("selected", item === button));
  }));
  $("#note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#note-title").value.trim();
    if (!title) return;
    notes.unshift({ id: crypto.randomUUID(), title: title.slice(0, 120), content: $("#note-content").value.trim().slice(0, 10000), color: selectedNoteColor, updatedAt: new Date().toISOString() });
    event.target.reset();
    selectedNoteColor = "sage";
    $$("[data-note-color]").forEach((button) => button.classList.toggle("selected", button.dataset.noteColor === "sage"));
    showNoteForm(false);
    saveNotes();
  });

  initializeDate();
  renderTasks();
  renderNotes();
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
})();
