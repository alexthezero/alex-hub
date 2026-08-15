(() => {
  "use strict";

  const TASKS_KEY = "alexHub.tasks.v1";
  const NOTES_KEY = "alexHub.notes.v1";
  const PROJECTS_KEY = "alexHub.projects.v1";
  const WEATHER_KEY = "alexHub.weather.v4";
  const AUTH_KEY = "alexHQ.auth.v1";
  const LAST_BACKUP_KEY = "alexHQ.lastBackup.v1";
  const PASSWORD_HASH = "16a0b62c9aeb7ec7da8e886b84d7dfa38f73e711e83d97a1ebc2ba358c834c50";
  const IDLE_LOCK_MS = 30 * 60 * 1000;
  const VIEWS = ["today", "tasks", "notes", "projects", "settings"];
  const DEFAULT_LOCATION = Object.freeze({ latitude: 29.5845, longitude: -81.2079, label: "PALM COAST" });
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const starterTasks = [
    { id: id(), title: "Review this week’s priorities", category: "Personal", completed: false },
    { id: id(), title: "Check the 3D printer queue", category: "Workshop", completed: false },
    { id: id(), title: "Plan tomorrow before signing off", category: "Routine", completed: true },
  ];
  const starterProjects = [
    { id: "smart-mirror", code: "A1", tone: "ember", graphic: "mirror", category: "HOME TECH", title: "Smart Mirror", summary: "Radar, widgets & daily view", description: "Local radar, weather, calendar, and useful daily widgets.", progress: 42 },
    { id: "print-lab", code: "B2", tone: "cyan", graphic: "printer", category: "WORKSHOP", title: "Print Lab", summary: "Queue, parts & experiments", description: "Parts, printer improvements, material tests, and the active queue.", progress: 68 },
    { id: "next-venture", code: "C3", tone: "violet", graphic: "venture", category: "BUSINESS", title: "Next Venture", summary: "Ideas worth testing", description: "Practical ideas that can save time, make money, or both.", progress: 18 },
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const read = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? JSON.parse(stored) : fallback;
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const getSessionAccess = () => {
    try { return sessionStorage.getItem(AUTH_KEY) === "unlocked"; } catch { return false; }
  };

  const setSessionAccess = (unlocked) => {
    try {
      if (unlocked) sessionStorage.setItem(AUTH_KEY, "unlocked");
      else sessionStorage.removeItem(AUTH_KEY);
    } catch { /* the gate still works when session storage is unavailable */ }
  };

  const hashText = async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  let idleTimer;
  let lastActivity = Date.now();

  function armIdleLock(delay = IDLE_LOCK_MS) {
    clearTimeout(idleTimer);
    if (!document.body.classList.contains("locked")) idleTimer = setTimeout(lockApp, Math.max(1000, delay));
  }

  function recordActivity() {
    if (document.body.classList.contains("locked")) return;
    lastActivity = Date.now();
    armIdleLock();
  }

  function setPasswordVisibility(visible) {
    const input = $("#access-password");
    const button = $("#password-toggle");
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    $("#password-toggle-label").textContent = visible ? "HIDE" : "SHOW";
  }

  function unlockApp() {
    document.body.classList.remove("locked");
    $("#access-gate").setAttribute("aria-hidden", "true");
    $(".app-frame").removeAttribute("aria-hidden");
    setSessionAccess(true);
    $("#access-form").reset();
    setPasswordVisibility(false);
    $("#caps-lock-warning").hidden = true;
    $(".gate-panel").classList.remove("denied");
    $("#access-error").textContent = "";
    lastActivity = Date.now();
    armIdleLock();
  }

  function lockApp() {
    clearTimeout(idleTimer);
    closeRadar(false);
    setSessionAccess(false);
    document.body.classList.add("locked");
    $("#access-gate").removeAttribute("aria-hidden");
    $(".app-frame").setAttribute("aria-hidden", "true");
    setPasswordVisibility(false);
    $("#caps-lock-warning").hidden = true;
    $(".gate-panel").classList.remove("denied");
    $("#access-error").textContent = "";
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => $("#access-password").focus());
  }

  if (getSessionAccess()) unlockApp();
  else lockApp();

  $("#access-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const passwordInput = $("#access-password");
    const submitButton = event.currentTarget.querySelector("button[type='submit']");
    const submitLabel = submitButton.querySelector("span");
    const error = $("#access-error");
    submitButton.disabled = true;
    submitLabel.textContent = "CHECKING…";
    error.textContent = "VERIFYING ACCESS…";
    try {
      if (await hashText(passwordInput.value) === PASSWORD_HASH) {
        unlockApp();
        return;
      }
      error.textContent = "ACCESS CODE REJECTED · TRY AGAIN";
    } catch {
      error.textContent = "SECURE CHECK UNAVAILABLE";
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = "AUTHENTICATE";
    }
    passwordInput.value = "";
    $(".gate-panel").classList.remove("denied");
    requestAnimationFrame(() => {
      $(".gate-panel").classList.add("denied");
      passwordInput.focus();
    });
  });

  $("#password-toggle").addEventListener("click", () => {
    setPasswordVisibility($("#access-password").type === "password");
    $("#access-password").focus();
  });

  ["keydown", "keyup"].forEach((eventName) => $("#access-password").addEventListener(eventName, (event) => {
    $("#caps-lock-warning").hidden = !event.getModifierState?.("CapsLock");
  }));
  $("#access-password").addEventListener("blur", () => { $("#caps-lock-warning").hidden = true; });
  $("#access-password").addEventListener("input", () => {
    if ($("#access-error").textContent !== "VERIFYING ACCESS…") $("#access-error").textContent = "";
  });

  [$("#lock-control"), $("#mobile-lock-control"), $("#settings-lock")].forEach((button) => button.addEventListener("click", lockApp));
  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => document.addEventListener(eventName, recordActivity, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || document.body.classList.contains("locked")) return;
    const elapsed = Date.now() - lastActivity;
    if (elapsed >= IDLE_LOCK_MS) lockApp();
    else armIdleLock(IDLE_LOCK_MS - elapsed);
  });

  let tasks = read(TASKS_KEY, starterTasks);
  let notes = read(NOTES_KEY, []);
  let projects = read(PROJECTS_KEY, starterProjects);
  let taskFilter = "all";
  let noteQuery = "";
  let editingNoteId = null;
  let selectedNoteColor = "ember";
  let pendingUndo = null;
  let weatherCenter = { ...DEFAULT_LOCATION };
  let weatherSessionCache = null;
  let weatherRequestId = 0;
  let radarCenter = { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };
  let radarZoom = 7;
  let radarFrames = [];
  let radarFrameIndex = 0;
  let radarTimer = null;
  let radarHost = "";
  let radarInitialized = false;
  let radarLocateRequested = false;
  let radarLastFocus = null;

  function announce(message = "LOCAL DATA CHANNEL NOMINAL") {
    const status = $("#save-status");
    status.textContent = message;
    status.classList.add("flash");
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => status.classList.remove("flash"), 1300);
  }

  function persist(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      announce();
    } catch {
      announce("THIS BROWSER COULD NOT SAVE");
    }
  }

  function dismissToast() {
    pendingUndo = null;
    $("#action-toast").hidden = true;
  }

  function showUndo(message, undoAction) {
    pendingUndo = undoAction;
    $("#toast-message").textContent = message;
    $("#action-toast").hidden = false;
  }

  function openView(view, updateHash = true) {
    if (!VIEWS.includes(view)) return;
    $$(".view").forEach((panel) => {
      const active = panel.id === `view-${view}`;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    $$(".switch").forEach((button) => {
      const active = button.dataset.viewTarget === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (view === "notes") renderNotes();
    if (view === "settings") renderSettings();
    if (!$("#radar-modal").hidden) closeRadar(false);
    if (updateHash) history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function taskMarkup(task, removable = false) {
    const taskId = esc(task.id);
    const title = esc(task.title);
    const category = esc(task.category || "Inbox");
    return `<article class="task-item${task.completed ? " done" : ""}">
      <label>
        <input type="checkbox" data-toggle-task="${taskId}" ${task.completed ? "checked" : ""}>
        <span class="task-check" aria-hidden="true">✓</span>
        <span class="task-copy"><strong>${title}</strong><small>${category}</small></span>
      </label>
      <span class="task-status">${task.completed ? "DONE" : "OPEN"}</span>
      ${removable ? `<button class="delete-task" data-delete-task="${taskId}" aria-label="Delete ${title}">×</button>` : ""}
    </article>`;
  }

  function filteredTasks(ordered) {
    if (taskFilter === "open") return ordered.filter((task) => !task.completed);
    if (taskFilter === "done") return ordered.filter((task) => task.completed);
    return ordered;
  }

  function renderTasks() {
    const ordered = [...tasks].sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)));
    const visible = filteredTasks(ordered);
    const completed = tasks.filter((task) => task.completed).length;
    const remaining = tasks.length - completed;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    $("#today-task-list").innerHTML = ordered.length
      ? ordered.slice(0, 5).map((task) => taskMarkup(task)).join("")
      : '<p class="inline-empty">No active assignments. Enter the first task above.</p>';
    $("#all-task-list").innerHTML = visible.length
      ? visible.map((task) => taskMarkup(task, true)).join("")
      : `<p class="inline-empty">No ${taskFilter === "all" ? "" : `${taskFilter} `}assignments in this queue.</p>`;

    $("#task-total-stat").textContent = tasks.length;
    $("#task-count-label").textContent = `${visible.length} ${visible.length === 1 ? "ITEM" : "ITEMS"}`;
    $("#clear-completed").hidden = completed === 0;
    $("#progress-fraction").textContent = `${completed} / ${tasks.length}`;
    $("#progress-percent").textContent = `${percent}%`;
    $("#progress-orbit").style.setProperty("--progress", `${percent * 3.6}deg`);
    $("#remaining-count").textContent = tasks.length === 0 ? "No assignments queued" : remaining === 0 ? "Operation complete" : `${remaining} ${remaining === 1 ? "assignment" : "assignments"} remaining`;
    $("#progress-message").textContent = tasks.length === 0 ? "Tasking channel is clear." : remaining === 0 ? "All assigned actions are complete." : percent >= 50 ? "Past halfway. Maintain pace." : "Complete one action to build momentum.";
  }

  function saveTasks() {
    persist(TASKS_KEY, tasks);
    renderTasks();
  }

  function addTask(rawTitle) {
    const title = rawTitle.trim();
    if (!title) return;
    tasks.unshift({ id: id(), title: title.slice(0, 240), category: "Inbox", completed: false });
    saveTasks();
  }

  function toggleTask(taskId) {
    tasks = tasks.map((task) => String(task.id) === taskId ? { ...task, completed: !task.completed } : task);
    saveTasks();
  }

  function deleteTask(taskId) {
    const index = tasks.findIndex((task) => String(task.id) === taskId);
    if (index < 0) return;
    const [removed] = tasks.splice(index, 1);
    saveTasks();
    showUndo("Task deleted", () => {
      tasks.splice(index, 0, removed);
      saveTasks();
    });
  }

  function clearCompletedTasks() {
    const completed = tasks.filter((task) => task.completed);
    if (!completed.length) return;
    const previous = [...tasks];
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    showUndo(`${completed.length} completed ${completed.length === 1 ? "task" : "tasks"} cleared`, () => {
      tasks = previous;
      saveTasks();
    });
  }

  function noteDate(note) {
    const parsed = new Date(note.updatedAt || Date.now());
    const value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value).toUpperCase();
  }

  function renderLatestNote() {
    const latest = notes[0];
    if (!latest) {
      $("#latest-note").innerHTML = '<p class="latest-empty">No field log entries. Record the next useful detail here.</p>';
      return;
    }
    $("#latest-note").innerHTML = `<div class="latest-note-card ${esc(latest.color || "ember")}">
      <h3>${esc(latest.title)}</h3>
      <p>${esc(latest.content || "No additional details.")}</p>
      <button data-open-notes>OPEN FIELD LOG →</button>
    </div>`;
  }

  function renderNotes() {
    const query = noteQuery.trim().toLowerCase();
    const visibleNotes = query ? notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query)) : notes;
    $("#notes-grid").innerHTML = visibleNotes.length ? visibleNotes.map((note) => {
      const index = notes.findIndex((item) => String(item.id) === String(note.id));
      return `<article class="note-card ${esc(note.color || "ember")}">
      <header><span>ENTRY / ${String(index + 1).padStart(2, "0")}</span><div class="note-actions"><button data-edit-note="${esc(note.id)}" aria-label="Edit ${esc(note.title)}">EDIT</button><button data-delete-note="${esc(note.id)}" aria-label="Delete ${esc(note.title)}">×</button></div></header>
      <div><h3>${esc(note.title)}</h3><p>${esc(note.content || "No additional details.")}</p></div>
      <footer>${noteDate(note)}</footer>
    </article>`;
    }).join("") : query ? '<p class="inline-empty note-no-results">No notes match that search.</p>' : "";
    $("#note-count-label").textContent = query ? `${visibleNotes.length} OF ${notes.length}` : `${notes.length} ${notes.length === 1 ? "ENTRY" : "ENTRIES"}`;
    $("#notes-empty").hidden = notes.length > 0 || !$("#note-form").hidden;
    renderLatestNote();
  }

  function saveNotes() {
    persist(NOTES_KEY, notes);
    renderNotes();
  }

  function setNoteColor(color = "ember") {
    selectedNoteColor = ["ember", "cyan", "violet"].includes(color) ? color : "ember";
    $$("[data-note-color]").forEach((button) => button.classList.toggle("selected", button.dataset.noteColor === selectedNoteColor));
  }

  function showNoteForm(show = true, noteId = null) {
    openView("notes");
    const form = $("#note-form");
    form.hidden = !show;
    $("#notes-empty").hidden = notes.length > 0 || show;
    if (!show) {
      editingNoteId = null;
      form.reset();
      setNoteColor();
      return;
    }
    const note = noteId ? notes.find((item) => String(item.id) === String(noteId)) : null;
    editingNoteId = note ? String(note.id) : null;
    form.reset();
    $("#note-form-label").textContent = note ? "EDIT ENTRY" : "NEW ENTRY";
    $("#note-save-button").textContent = note ? "UPDATE LOG ENTRY" : "SAVE LOG ENTRY";
    $("#note-title").value = note?.title || "";
    $("#note-content").value = note?.content || "";
    setNoteColor(note?.color || "ember");
    setTimeout(() => $("#note-title").focus(), 0);
  }

  function deleteNote(noteId) {
    const index = notes.findIndex((note) => String(note.id) === String(noteId));
    if (index < 0) return;
    const [removed] = notes.splice(index, 1);
    saveNotes();
    showUndo("Note deleted", () => {
      notes.splice(index, 0, removed);
      saveNotes();
    });
  }

  function projectProgress(value) {
    return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  }

  function renderProjects() {
    $("#project-ribbon").innerHTML = projects.map((project) => {
      const tone = ["ember", "cyan", "violet"].includes(project.tone) ? project.tone : "ember";
      return `<article class="project-unit ${tone}">
        <div class="project-index">${esc(project.code || "--")}</div><div><span>${esc(project.category || "PROJECT")}</span><h3>${esc(project.title || "Untitled project")}</h3><p>${esc(project.summary || project.description || "In progress")}</p></div><b data-project-value="${esc(project.id)}">${projectProgress(project.progress)}%</b>
      </article>`;
    }).join("");

    $("#project-showcase").innerHTML = projects.map((project, index) => {
      const tone = ["ember", "cyan", "violet"].includes(project.tone) ? project.tone : "ember";
      const graphic = ["mirror", "printer", "venture"].includes(project.graphic) ? project.graphic : "venture";
      const progress = projectProgress(project.progress);
      const inputId = `project-progress-${String(project.id || index).replace(/[^a-zA-Z0-9_-]/g, "")}`;
      return `<article class="project-card ${tone}">
        <header><span>PROJECT / ${esc(project.code || String(index + 1).padStart(2, "0"))}</span><b data-project-value="${esc(project.id)}">${progress}%</b></header>
        <div class="project-graphic ${graphic}" aria-hidden="true"><i></i><i></i><i></i></div>
        <div><p>${esc(project.category || "PROJECT")}</p><h3>${esc(project.title || "Untitled project")}</h3><span>${esc(project.description || project.summary || "Keep moving this forward.")}</span></div>
        <div class="project-control"><label for="${esc(inputId)}">PROGRESS</label><input id="${esc(inputId)}" type="range" min="0" max="100" step="1" value="${progress}" data-project-progress="${esc(project.id)}" /><output data-project-value="${esc(project.id)}">${progress}%</output></div>
        <footer><i data-project-bar="${esc(project.id)}" style="--amount:${progress}%"></i></footer>
      </article>`;
    }).join("");
    $("#project-count").textContent = `${String(projects.length).padStart(2, "0")} ACTIVE OPS`;
  }

  function updateProjectProgress(projectId, value) {
    const progress = projectProgress(value);
    projects = projects.map((project) => String(project.id) === String(projectId) ? { ...project, progress } : project);
    $$(`[data-project-value="${CSS.escape(String(projectId))}"]`).forEach((element) => { element.textContent = `${progress}%`; });
    $$(`[data-project-bar="${CSS.escape(String(projectId))}"]`).forEach((element) => element.style.setProperty("--amount", `${progress}%`));
  }

  function saveProjects() {
    persist(PROJECTS_KEY, projects);
    renderProjects();
    renderSettings();
  }

  function weatherIcon(forecast = "", daytime = true) {
    const text = forecast.toLowerCase();
    const open = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
    const close = "</svg>";
    const cloud = '<path d="M7 18h9.5a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.5 9 4.5 4.5 0 0 0 7 18Z"/>';
    if (text.includes("thunder")) return `${open}${cloud}<path d="m13 13-2 4h2l-1 4 4-6h-2l1-2"/>${close}`;
    if (text.includes("snow") || text.includes("sleet") || text.includes("ice")) return `${open}${cloud}<path d="M9 20v2m-1-1h2m5-1v2m-1-1h2"/>${close}`;
    if (text.includes("rain") || text.includes("shower") || text.includes("drizzle")) return `${open}${cloud}<path d="m9 20-1 2m5-2-1 2m5-2-1 2"/>${close}`;
    if (text.includes("fog") || text.includes("mist")) return `${open}<path d="M4 8h16M2 12h17M5 16h17"/>${close}`;
    if (text.includes("partly") || text.includes("mostly sunny") || text.includes("mostly clear")) return `${open}<circle cx="8" cy="8" r="3"/><path d="M8 2v2M2 8h2m.5-3.5L6 6"/>${cloud}${close}`;
    if (text.includes("cloud") || text.includes("overcast")) return `${open}${cloud}${close}`;
    if (!daytime) return `${open}<path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>${close}`;
    return `${open}<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>${close}`;
  }

  function weatherCodeLabel(code) {
    if (code === 0) return "Clear";
    if (code === 1) return "Mostly clear";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code === 45 || code === 48) return "Foggy";
    if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
    if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
    if ([80, 81, 82].includes(code)) return "Rain showers";
    if ([95, 96, 99].includes(code)) return "Thunderstorms";
    return "Current conditions";
  }

  function renderWeather(weather) {
    const current = weather.current || {};
    const periods = Array.isArray(weather.periods) ? weather.periods.slice(0, 4) : [];
    const rain = current.probabilityOfPrecipitation?.value;
    $("#weather-location-label").textContent = weather.location?.label || weatherCenter.label;
    $("#weather-glyph").innerHTML = weatherIcon(current.shortForecast, current.isDaytime);
    $("#weather-temp").textContent = Number.isFinite(current.temperature) ? `${Math.round(current.temperature)}°` : "--°";
    $("#weather-condition").textContent = current.shortForecast || "Forecast available";
    const apparentTemperature = Number.isFinite(current.apparentTemperature) ? current.apparentTemperature : current.temperature;
    $("#weather-feels").textContent = Number.isFinite(apparentTemperature) ? `${Math.round(apparentTemperature)}°` : "--°";
    $("#weather-rain").textContent = `${Number.isFinite(rain) ? Math.round(rain) : 0}%`;
    $("#weather-wind").textContent = current.windSpeed || "CALM";
    $("#forecast-strip").innerHTML = periods.length ? periods.map((period) => {
      const periodRain = period.probabilityOfPrecipitation?.value;
      const label = period.name === "This Afternoon" ? "Today" : period.name;
      return `<article class="forecast-period">
        <span aria-hidden="true">${weatherIcon(period.shortForecast, period.isDaytime)}</span>
        <div><strong>${esc(label)}</strong><small>${Number.isFinite(periodRain) ? `${Math.round(periodRain)}% RAIN` : esc(period.shortForecast || "FORECAST")}</small></div>
        <b>${period.temperatureText ? esc(period.temperatureText) : Number.isFinite(period.temperature) ? `${Math.round(period.temperature)}°` : "--"}</b>
      </article>`;
    }).join("") : '<p class="weather-error">The forecast is temporarily unavailable. Try again in a few minutes.</p>';
    const updated = new Date(weather.fetchedAt || Date.now());
    $("#weather-updated").textContent = `UPDATED ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(updated).toUpperCase()}`;
  }

  async function loadWeather(force = false) {
    const refreshButton = $("#weather-refresh");
    const requestId = ++weatherRequestId;
    const requestedLocation = { ...weatherCenter };
    refreshButton.disabled = true;
    refreshButton.textContent = "UPDATING…";
    let cached;
    try {
      cached = requestedLocation.label === "CURRENT LOCATION"
        ? weatherSessionCache
        : JSON.parse(localStorage.getItem(WEATHER_KEY) || "null");
      const cachedLocationMatches = Number.isFinite(cached?.location?.latitude)
        && Number.isFinite(cached?.location?.longitude)
        && Math.abs(cached.location.latitude - requestedLocation.latitude) < .01
        && Math.abs(cached.location.longitude - requestedLocation.longitude) < .01;
      if (!cachedLocationMatches) cached = null;
      if (!force && Number.isFinite(cached?.current?.apparentTemperature) && cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < 20 * 60 * 1000) {
        renderWeather(cached);
        if (requestId === weatherRequestId) {
          refreshButton.disabled = false;
          refreshButton.textContent = "REFRESH";
        }
        return;
      }
      if (cached) renderWeather(cached);
    } catch {
      cached = null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const params = new URLSearchParams({
        latitude: String(requestedLocation.latitude),
        longitude: String(requestedLocation.longitude),
        current: "temperature_2m,apparent_temperature,is_day,precipitation_probability,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        precipitation_unit: "inch",
        timezone: "auto",
        forecast_days: "4",
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Forecast unavailable");
      const forecast = await response.json();
      if (requestId !== weatherRequestId) return;
      const currentCode = Number(forecast.current?.weather_code);
      const currentLabel = weatherCodeLabel(currentCode);
      const weather = {
        current: {
          temperature: forecast.current?.temperature_2m,
          apparentTemperature: forecast.current?.apparent_temperature,
          shortForecast: currentLabel,
          isDaytime: Boolean(forecast.current?.is_day),
          probabilityOfPrecipitation: { value: forecast.current?.precipitation_probability },
          windSpeed: Number.isFinite(forecast.current?.wind_speed_10m) ? `${Math.round(forecast.current.wind_speed_10m)} MPH` : "CALM",
        },
        periods: (forecast.daily?.time || []).slice(0, 4).map((date, index) => {
          const code = Number(forecast.daily?.weather_code?.[index]);
          const high = forecast.daily?.temperature_2m_max?.[index];
          const low = forecast.daily?.temperature_2m_min?.[index];
          const parsedDate = new Date(`${date}T12:00:00`);
          return {
            name: index === 0 ? "Today" : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsedDate),
            shortForecast: weatherCodeLabel(code),
            isDaytime: true,
            probabilityOfPrecipitation: { value: forecast.daily?.precipitation_probability_max?.[index] },
            temperatureText: Number.isFinite(high) && Number.isFinite(low) ? `${Math.round(high)}°/${Math.round(low)}°` : "--",
          };
        }),
        fetchedAt: new Date().toISOString(),
        location: requestedLocation,
      };
      renderWeather(weather);
      if (requestedLocation.label === "CURRENT LOCATION") weatherSessionCache = weather;
      else {
        try { localStorage.setItem(WEATHER_KEY, JSON.stringify(weather)); } catch { /* weather can work without caching */ }
      }
    } catch {
      if (!cached) {
        $("#weather-condition").textContent = "Forecast unavailable";
        $("#forecast-strip").innerHTML = '<p class="weather-error">The weather feed did not respond. The rest of Alex HQ is still available.</p>';
        $("#weather-updated").textContent = "WEATHER OFFLINE";
      }
    } finally {
      clearTimeout(timer);
      if (requestId === weatherRequestId) {
        refreshButton.disabled = false;
        refreshButton.textContent = "REFRESH";
      }
    }
  }

  function radarTimeLabel(timestamp) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp * 1000)).toUpperCase();
  }

  function radarTileLayout() {
    const map = $("#radar-map");
    const width = map.clientWidth || 860;
    const height = map.clientHeight || 360;
    const latitude = Math.min(85.0511, Math.max(-85.0511, radarCenter.latitude));
    const latitudeRadians = latitude * Math.PI / 180;
    const scale = 2 ** radarZoom;
    const centerX = ((radarCenter.longitude + 180) / 360) * scale * 256;
    const centerY = ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale * 256;
    const centerTileX = Math.floor(centerX / 256);
    const centerTileY = Math.floor(centerY / 256);
    const radiusX = Math.ceil(width / 512);
    const radiusY = Math.ceil(height / 512);
    const tiles = [];
    for (let offsetY = -radiusY; offsetY <= radiusY; offsetY += 1) {
      const rawY = centerTileY + offsetY;
      if (rawY < 0 || rawY >= scale) continue;
      for (let offsetX = -radiusX; offsetX <= radiusX; offsetX += 1) {
        const rawX = centerTileX + offsetX;
        tiles.push({
          left: Math.round(rawX * 256 - centerX + width / 2),
          top: Math.round(rawY * 256 - centerY + height / 2),
          x: ((rawX % scale) + scale) % scale,
          y: rawY,
        });
      }
    }
    return tiles;
  }

  function fillRadarTiles(layer, urlForTile) {
    const fragment = document.createDocumentFragment();
    radarTileLayout().forEach((tile) => {
      const image = new Image(256, 256);
      image.alt = "";
      image.className = "radar-map-tile";
      image.decoding = "async";
      image.loading = "eager";
      image.src = urlForTile(tile);
      image.style.left = `${tile.left}px`;
      image.style.top = `${tile.top}px`;
      fragment.append(image);
    });
    layer.replaceChildren(fragment);
  }

  function renderRadarMap() {
    if (!radarInitialized) return;
    fillRadarTiles($("#radar-base-layer"), (tile) => `https://tile.openstreetmap.org/${radarZoom}/${tile.x}/${tile.y}.png`);
    if (radarFrames.length && radarHost) {
      const frame = radarFrames[radarFrameIndex];
      fillRadarTiles($("#radar-overlay-layer"), (tile) => `${radarHost}${frame.path}/256/${radarZoom}/${tile.x}/${tile.y}/2/1_1.png`);
    } else $("#radar-overlay-layer").replaceChildren();
    $("#radar-zoom-in").disabled = radarZoom >= 7;
    $("#radar-zoom-out").disabled = radarZoom <= 4;
  }

  function renderRadarFrame(index) {
    if (!radarInitialized || !radarFrames.length || !radarHost) return;
    radarFrameIndex = Math.min(radarFrames.length - 1, Math.max(0, Number(index) || 0));
    const frame = radarFrames[radarFrameIndex];
    fillRadarTiles($("#radar-overlay-layer"), (tile) => `${radarHost}${frame.path}/256/${radarZoom}/${tile.x}/${tile.y}/2/1_1.png`);
    $("#radar-frame").value = radarFrameIndex;
    $("#radar-time").textContent = radarFrameIndex === radarFrames.length - 1 ? `LATEST · ${radarTimeLabel(frame.time)}` : radarTimeLabel(frame.time);
  }

  function changeRadarZoom(amount) {
    radarZoom = Math.min(7, Math.max(4, radarZoom + amount));
    renderRadarMap();
  }

  function setRadarPlaying(playing) {
    clearInterval(radarTimer);
    radarTimer = null;
    const button = $("#radar-play");
    if (!playing || radarFrames.length < 2) {
      button.textContent = "PLAY";
      button.setAttribute("aria-label", "Play radar animation");
      return;
    }
    button.textContent = "PAUSE";
    button.setAttribute("aria-label", "Pause radar animation");
    radarTimer = setInterval(() => renderRadarFrame((radarFrameIndex + 1) % radarFrames.length), 1100);
  }

  async function initRadar() {
    if (radarInitialized) {
      requestAnimationFrame(renderRadarMap);
      return;
    }
    radarInitialized = true;
    const state = $("#radar-state");
    renderRadarMap();

    try {
      const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Radar feed unavailable");
      const data = await response.json();
      const host = new URL(data.host || "");
      if (host.protocol !== "https:" || host.hostname !== "tilecache.rainviewer.com") throw new Error("Unexpected radar host");
      radarHost = host.origin;
      radarFrames = Array.isArray(data.radar?.past) ? data.radar.past.filter((frame) => Number.isFinite(frame.time) && /^\/v2\/radar\/[a-z0-9]+$/i.test(frame.path || "")).slice(-8) : [];
      if (!radarFrames.length) throw new Error("No radar frames available");
      radarFrameIndex = radarFrames.length - 1;
      $("#radar-frame").max = radarFrames.length - 1;
      $("#radar-frame").disabled = false;
      $("#radar-play").disabled = false;
      renderRadarFrame(radarFrameIndex);
      state.textContent = "";
    } catch {
      state.textContent = "LIVE RADAR IS TEMPORARILY UNAVAILABLE";
      $("#radar-status").textContent = "BASE MAP AVAILABLE · RADAR FEED OFFLINE";
    }
  }

  function setDashboardInert(inert) {
    [$(".app-header"), $(".view-switcher"), $("main"), $(".app-footer"), $(".action-toast")].forEach((element) => {
      if (element) element.inert = inert;
    });
  }

  async function useGrantedRadarLocation() {
    if (radarLocateRequested || !navigator.permissions?.query) return;
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") locateRadar();
      else if (permission.state === "denied") {
        $("#radar-location-label").innerHTML = "<i></i> LOCATION PERMISSION OFF";
        $("#radar-status").textContent = "SHOWING PALM COAST · ENABLE LOCATION IN BROWSER SETTINGS";
        $("#radar-location").textContent = "TRY LOCATION";
      }
    } catch { /* location stays opt-in when permission state is unavailable */ }
  }

  async function openRadar() {
    const modal = $("#radar-modal");
    if (!modal.hidden || document.body.classList.contains("locked")) return;
    radarLastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("radar-open");
    setDashboardInert(true);
    requestAnimationFrame(() => {
      $("#radar-close").focus();
      renderRadarMap();
    });
    await initRadar();
    if (!modal.hidden) useGrantedRadarLocation();
  }

  function closeRadar(restoreFocus = true) {
    const modal = $("#radar-modal");
    if (!modal || modal.hidden) return;
    setRadarPlaying(false);
    modal.hidden = true;
    document.body.classList.remove("radar-open");
    setDashboardInert(false);
    if (restoreFocus && radarLastFocus instanceof HTMLElement) radarLastFocus.focus();
    radarLastFocus = null;
  }

  function handleRadarKeys(event) {
    const modal = $("#radar-modal");
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeRadar();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = $$('button:not([disabled]), input:not([disabled]), a[href]', $(".radar-dialog"))
      .filter((element) => element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function locateRadar(force = false) {
    if (!navigator.geolocation || !radarInitialized) {
      $("#radar-location-label").innerHTML = "<i></i> PALM COAST FALLBACK";
      $("#radar-status").textContent = "LOCATION IS NOT AVAILABLE IN THIS BROWSER";
      return;
    }
    if (radarLocateRequested && !force) return;
    radarLocateRequested = true;
    const button = $("#radar-location");
    button.disabled = true;
    button.textContent = "LOCATING…";
    $("#radar-status").textContent = "REQUESTING THIS DEVICE’S CURRENT LOCATION…";
    navigator.geolocation.getCurrentPosition((position) => {
      radarCenter = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      weatherCenter = { latitude: position.coords.latitude, longitude: position.coords.longitude, label: "CURRENT LOCATION" };
      radarZoom = 7;
      renderRadarMap();
      $("#radar-location-label").innerHTML = "<i></i> CURRENT LOCATION";
      $("#weather-location-label").textContent = weatherCenter.label;
      $("#radar-map").setAttribute("aria-label", "Animated precipitation radar centered on your current location");
      $("#radar-status").textContent = "CENTERED ON YOUR CURRENT LOCATION · NOT SAVED";
      button.disabled = false;
      button.textContent = "UPDATE LOCATION";
      loadWeather(true);
    }, (error) => {
      const message = error.code === 1 ? "LOCATION PERMISSION OFF" : "LOCATION UNAVAILABLE";
      $("#radar-location-label").innerHTML = `<i></i> ${message}`;
      $("#radar-status").textContent = "SHOWING PALM COAST · TAP TO TRY LOCATION AGAIN";
      button.disabled = false;
      button.textContent = "TRY LOCATION";
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 });
  }

  async function renderStorageStatus() {
    const status = $("#storage-status");
    const button = $("#protect-storage");
    if (!navigator.storage?.persisted || !navigator.storage?.persist) {
      status.textContent = "BROWSER MANAGED";
      button.disabled = true;
      button.textContent = "NOT SUPPORTED HERE";
      return;
    }
    try {
      const persisted = await navigator.storage.persisted();
      status.textContent = persisted ? "PERSISTENT" : "BEST EFFORT";
      button.disabled = persisted;
      button.textContent = persisted ? "PERSISTENCE ACTIVE" : "REQUEST PERSISTENCE";
    } catch {
      status.textContent = "BROWSER MANAGED";
      button.disabled = true;
    }
  }

  function renderSettings() {
    $("#data-task-count").textContent = tasks.length;
    $("#data-note-count").textContent = notes.length;
    $("#data-project-count").textContent = projects.length;
    try {
      const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
      $("#last-backup").textContent = lastBackup ? `LAST EXPORTED ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(lastBackup)).toUpperCase()}` : "NO BACKUP EXPORTED YET";
    } catch {
      $("#last-backup").textContent = "BACKUP STATUS UNAVAILABLE";
    }
    renderStorageStatus();
  }

  function exportBackup() {
    const exportedAt = new Date().toISOString();
    const payload = { version: 1, app: "Alex HQ", exportedAt, tasks, notes, projects };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alex-hq-backup-${exportedAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { localStorage.setItem(LAST_BACKUP_KEY, exportedAt); } catch { /* export still succeeded */ }
    renderSettings();
    announce("BACKUP EXPORTED");
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Backup file is too large");
      const backup = JSON.parse(await file.text());
      if (!Array.isArray(backup.tasks) || !Array.isArray(backup.notes) || !Array.isArray(backup.projects)) throw new Error("This is not an Alex HQ backup");
      if (!confirm(`Replace the data on this device with ${backup.tasks.length} tasks, ${backup.notes.length} notes, and ${backup.projects.length} projects?`)) return;
      tasks = backup.tasks.map((task) => ({ id: String(task.id || id()), title: String(task.title || "Untitled task").slice(0, 240), category: String(task.category || "Inbox").slice(0, 40), completed: Boolean(task.completed) }));
      notes = backup.notes.map((note) => ({ id: String(note.id || id()), title: String(note.title || "Untitled note").slice(0, 120), content: String(note.content || "").slice(0, 10000), color: ["ember", "cyan", "violet"].includes(note.color) ? note.color : "ember", updatedAt: note.updatedAt || new Date().toISOString() }));
      projects = backup.projects.length ? backup.projects.map((project, index) => ({ ...starterProjects[index % starterProjects.length], ...project, id: String(project.id || id()), progress: projectProgress(project.progress) })) : [...starterProjects];
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      renderTasks();
      renderNotes();
      renderProjects();
      renderSettings();
      announce("BACKUP RESTORED");
    } catch (error) {
      announce(error?.message || "BACKUP COULD NOT BE IMPORTED");
    } finally {
      $("#import-backup").value = "";
    }
  }

  async function requestStoragePersistence() {
    try {
      const granted = await navigator.storage.persist();
      announce(granted ? "PERSISTENT STORAGE ACTIVE" : "BROWSER KEPT STANDARD STORAGE");
    } catch {
      announce("PERSISTENT STORAGE UNAVAILABLE");
    }
    renderStorageStatus();
  }

  function updateDateAndTime() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const clockParts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).formatToParts(now);
    const dateText = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(now).toUpperCase();
    const clockText = clockParts.filter((part) => part.type === "hour" || part.type === "minute" || part.type === "literal").map((part) => part.value).join("");
    const periodText = clockParts.find((part) => part.type === "dayPeriod")?.value || "";
    $("#greeting").textContent = `${greeting}, Alex.`;
    $("#date-label").textContent = dateText;
    $("#gate-date").textContent = dateText;
    $("#day-number").textContent = String(now.getDate()).padStart(2, "0");
    $("#month-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long" }).format(now).toUpperCase();
    $("#live-clock").textContent = clockText;
    $("#gate-clock").textContent = clockText;
    $("#clock-period").textContent = periodText;
    $("#gate-period").textContent = periodText;
  }

  $$('[data-view-target]').forEach((button) => button.addEventListener("click", () => openView(button.dataset.viewTarget)));

  $("#today-task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addTask($("#today-task-input").value);
    event.currentTarget.reset();
  });

  $("#all-task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addTask($("#all-task-input").value);
    event.currentTarget.reset();
  });

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest?.("[data-toggle-task]");
    if (checkbox) toggleTask(checkbox.dataset.toggleTask);
  });

  document.addEventListener("click", (event) => {
    const deleteTaskButton = event.target.closest?.("[data-delete-task]");
    const deleteNoteButton = event.target.closest?.("[data-delete-note]");
    const editNoteButton = event.target.closest?.("[data-edit-note]");
    const openNotesButton = event.target.closest?.("[data-open-notes]");
    if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
    if (deleteNoteButton) deleteNote(deleteNoteButton.dataset.deleteNote);
    if (editNoteButton) showNoteForm(true, editNoteButton.dataset.editNote);
    if (openNotesButton) openView("notes");
  });

  $("#clear-completed").addEventListener("click", clearCompletedTasks);

  $$("[data-task-filter]").forEach((button) => button.addEventListener("click", () => {
    taskFilter = button.dataset.taskFilter;
    $$("[data-task-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderTasks();
  }));

  [$("#header-note-button"), $("#scratch-add"), $("#new-note-button"), $("#first-note-button")].forEach((button) => button.addEventListener("click", () => showNoteForm(true)));
  $("#close-note-form").addEventListener("click", () => showNoteForm(false));

  $$("[data-note-color]").forEach((button) => button.addEventListener("click", () => setNoteColor(button.dataset.noteColor)));

  $("#note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#note-title").value.trim();
    if (!title) return;
    const nextNote = {
      id: id(),
      title: title.slice(0, 120),
      content: $("#note-content").value.trim().slice(0, 10000),
      color: selectedNoteColor,
      updatedAt: new Date().toISOString(),
    };
    if (editingNoteId) {
      const existing = notes.find((note) => String(note.id) === editingNoteId);
      nextNote.id = existing?.id || editingNoteId;
      notes = [nextNote, ...notes.filter((note) => String(note.id) !== editingNoteId)];
    } else notes.unshift(nextNote);
    event.currentTarget.reset();
    editingNoteId = null;
    setNoteColor();
    $("#note-form-label").textContent = "NEW ENTRY";
    $("#note-save-button").textContent = "SAVE LOG ENTRY";
    event.currentTarget.hidden = true;
    saveNotes();
  });

  $("#note-search").addEventListener("input", (event) => {
    noteQuery = event.currentTarget.value;
    renderNotes();
  });

  document.addEventListener("input", (event) => {
    const range = event.target.closest?.("[data-project-progress]");
    if (range) updateProjectProgress(range.dataset.projectProgress, range.value);
  });

  document.addEventListener("change", (event) => {
    const range = event.target.closest?.("[data-project-progress]");
    if (range) saveProjects();
  });

  $("#weather-refresh").addEventListener("click", () => loadWeather(true));
  $("#weather-radar").addEventListener("click", openRadar);
  $("#radar-close").addEventListener("click", () => closeRadar());
  $(".radar-backdrop").addEventListener("click", () => closeRadar());
  $("#radar-location").addEventListener("click", () => locateRadar(true));
  $("#radar-zoom-in").addEventListener("click", () => changeRadarZoom(1));
  $("#radar-zoom-out").addEventListener("click", () => changeRadarZoom(-1));
  $("#radar-play").addEventListener("click", () => setRadarPlaying(!radarTimer));
  $("#radar-frame").addEventListener("input", (event) => {
    setRadarPlaying(false);
    renderRadarFrame(event.currentTarget.value);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" && radarTimer) setRadarPlaying(false);
  });
  document.addEventListener("keydown", handleRadarKeys);
  window.addEventListener("resize", () => {
    clearTimeout(renderRadarMap.resizeTimer);
    renderRadarMap.resizeTimer = setTimeout(() => {
      if (radarInitialized && !$("#radar-modal").hidden) renderRadarMap();
    }, 180);
  });
  $("#toast-undo").addEventListener("click", () => {
    const undo = pendingUndo;
    dismissToast();
    if (undo) {
      undo();
      announce("CHANGE UNDONE");
    }
  });
  $("#toast-dismiss").addEventListener("click", dismissToast);
  $("#export-backup").addEventListener("click", exportBackup);
  $("#import-backup-button").addEventListener("click", () => $("#import-backup").click());
  $("#import-backup").addEventListener("change", (event) => importBackup(event.currentTarget.files?.[0]));
  $("#protect-storage").addEventListener("click", requestStoragePersistence);
  window.addEventListener("hashchange", () => openView(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "today", false));

  updateDateAndTime();
  setInterval(updateDateAndTime, 30_000);
  renderTasks();
  renderNotes();
  renderProjects();
  renderSettings();
  loadWeather();
  openView(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "today", false);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
