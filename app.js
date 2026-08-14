(() => {
  "use strict";

  const TASKS_KEY = "alexHub.tasks.v1";
  const NOTES_KEY = "alexHub.notes.v1";
  const WEATHER_KEY = "alexHub.weather.v2";
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const starterTasks = [
    { id: id(), title: "Review this week’s priorities", category: "Personal", completed: false },
    { id: id(), title: "Check the 3D printer queue", category: "Workshop", completed: false },
    { id: id(), title: "Plan tomorrow before signing off", category: "Routine", completed: true },
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

  let tasks = read(TASKS_KEY, starterTasks);
  let notes = read(NOTES_KEY, []);
  let taskFilter = "all";
  let selectedNoteColor = "ember";

  function announce(message = "ALL CHANGES SAVED LOCALLY") {
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

  function openView(view) {
    $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
    $$(".switch").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view));
    if (view === "notes") renderNotes();
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
      : '<p class="inline-empty">Queue clear. Add your first move above.</p>';
    $("#all-task-list").innerHTML = visible.length
      ? visible.map((task) => taskMarkup(task, true)).join("")
      : `<p class="inline-empty">No ${taskFilter === "all" ? "" : `${taskFilter} `}tasks here.</p>`;

    $("#task-total-stat").textContent = tasks.length;
    $("#task-count-label").textContent = `${visible.length} ${visible.length === 1 ? "ITEM" : "ITEMS"}`;
    $("#progress-fraction").textContent = `${completed} / ${tasks.length}`;
    $("#progress-percent").textContent = `${percent}%`;
    $("#progress-orbit").style.setProperty("--progress", `${percent * 3.6}deg`);
    $("#remaining-count").textContent = tasks.length === 0 ? "No tasks queued" : remaining === 0 ? "Queue complete" : `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;
    $("#progress-message").textContent = tasks.length === 0 ? "Your runway is clear." : remaining === 0 ? "You handled everything." : percent >= 50 ? "Past halfway. Keep moving." : "Momentum starts with one.";
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
    tasks = tasks.filter((task) => String(task.id) !== taskId);
    saveTasks();
  }

  function noteDate(note) {
    const parsed = new Date(note.updatedAt || Date.now());
    const value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value).toUpperCase();
  }

  function renderLatestNote() {
    const latest = notes[0];
    if (!latest) {
      $("#latest-note").innerHTML = '<p class="latest-empty">Nothing saved yet. Capture the thought before it disappears.</p>';
      return;
    }
    $("#latest-note").innerHTML = `<div class="latest-note-card ${esc(latest.color || "ember")}">
      <h3>${esc(latest.title)}</h3>
      <p>${esc(latest.content || "No additional details.")}</p>
      <button data-open-notes>OPEN VAULT →</button>
    </div>`;
  }

  function renderNotes() {
    $("#notes-grid").innerHTML = notes.map((note, index) => `<article class="note-card ${esc(note.color || "ember")}">
      <header><span>ENTRY / ${String(index + 1).padStart(2, "0")}</span><button data-delete-note="${esc(note.id)}" aria-label="Delete ${esc(note.title)}">×</button></header>
      <div><h3>${esc(note.title)}</h3><p>${esc(note.content || "No additional details.")}</p></div>
      <footer>${noteDate(note)}</footer>
    </article>`).join("");
    $("#notes-empty").hidden = notes.length > 0 || !$("#note-form").hidden;
    renderLatestNote();
  }

  function saveNotes() {
    persist(NOTES_KEY, notes);
    renderNotes();
  }

  function showNoteForm(show = true) {
    openView("notes");
    const form = $("#note-form");
    form.hidden = !show;
    $("#notes-empty").hidden = notes.length > 0 || show;
    if (show) setTimeout(() => $("#note-title").focus(), 0);
  }

  function weatherSymbol(forecast = "", daytime = true) {
    const text = forecast.toLowerCase();
    if (text.includes("thunder")) return "ϟ";
    if (text.includes("snow") || text.includes("sleet") || text.includes("ice")) return "✻";
    if (text.includes("rain") || text.includes("shower") || text.includes("drizzle")) return "☂";
    if (text.includes("fog") || text.includes("mist")) return "≋";
    if (text.includes("partly") || text.includes("mostly sunny") || text.includes("mostly clear")) return daytime ? "◒" : "◐";
    if (text.includes("cloud") || text.includes("overcast")) return "●";
    return daytime ? "☀" : "☾";
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
    $("#weather-glyph").textContent = weatherSymbol(current.shortForecast, current.isDaytime);
    $("#weather-temp").textContent = Number.isFinite(current.temperature) ? `${Math.round(current.temperature)}°` : "--°";
    $("#weather-condition").textContent = current.shortForecast || "Forecast available";
    $("#weather-rain").textContent = `${Number.isFinite(rain) ? Math.round(rain) : 0}%`;
    $("#weather-wind").textContent = current.windSpeed || "CALM";
    $("#forecast-strip").innerHTML = periods.length ? periods.map((period) => {
      const periodRain = period.probabilityOfPrecipitation?.value;
      const label = period.name === "This Afternoon" ? "Today" : period.name;
      return `<article class="forecast-period">
        <span aria-hidden="true">${weatherSymbol(period.shortForecast, period.isDaytime)}</span>
        <div><strong>${esc(label)}</strong><small>${Number.isFinite(periodRain) ? `${Math.round(periodRain)}% RAIN` : esc(period.shortForecast || "FORECAST")}</small></div>
        <b>${period.temperatureText ? esc(period.temperatureText) : Number.isFinite(period.temperature) ? `${Math.round(period.temperature)}°` : "--"}</b>
      </article>`;
    }).join("") : '<p class="weather-error">The forecast is temporarily unavailable. Try again in a few minutes.</p>';
    const updated = new Date(weather.fetchedAt || Date.now());
    $("#weather-updated").textContent = `UPDATED ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(updated).toUpperCase()}`;
  }

  async function loadWeather() {
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(WEATHER_KEY) || "null");
      if (cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < 20 * 60 * 1000) {
        renderWeather(cached);
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
        latitude: "29.5845",
        longitude: "-81.2079",
        current: "temperature_2m,apparent_temperature,is_day,precipitation_probability,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        precipitation_unit: "inch",
        timezone: "America/New_York",
        forecast_days: "4",
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Forecast unavailable");
      const forecast = await response.json();
      const currentCode = Number(forecast.current?.weather_code);
      const currentLabel = weatherCodeLabel(currentCode);
      const weather = {
        current: {
          temperature: forecast.current?.temperature_2m,
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
      };
      renderWeather(weather);
      try { localStorage.setItem(WEATHER_KEY, JSON.stringify(weather)); } catch { /* weather can work without caching */ }
    } catch {
      if (!cached) {
        $("#weather-condition").textContent = "Forecast unavailable";
        $("#forecast-strip").innerHTML = '<p class="weather-error">The weather feed did not respond. The rest of Alex HQ is still available.</p>';
        $("#weather-updated").textContent = "WEATHER OFFLINE";
      }
    } finally {
      clearTimeout(timer);
    }
  }

  function updateDateAndTime() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const clockParts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).formatToParts(now);
    $("#greeting").textContent = `${greeting}, Alex.`;
    $("#date-label").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(now).toUpperCase();
    $("#day-number").textContent = String(now.getDate()).padStart(2, "0");
    $("#month-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long" }).format(now).toUpperCase();
    $("#live-clock").textContent = clockParts.filter((part) => part.type === "hour" || part.type === "minute" || part.type === "literal").map((part) => part.value).join("");
    $("#clock-period").textContent = clockParts.find((part) => part.type === "dayPeriod")?.value || "";
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
    const openNotesButton = event.target.closest?.("[data-open-notes]");
    if (deleteTaskButton) deleteTask(deleteTaskButton.dataset.deleteTask);
    if (deleteNoteButton) {
      notes = notes.filter((note) => String(note.id) !== deleteNoteButton.dataset.deleteNote);
      saveNotes();
    }
    if (openNotesButton) openView("notes");
  });

  $$("[data-task-filter]").forEach((button) => button.addEventListener("click", () => {
    taskFilter = button.dataset.taskFilter;
    $$("[data-task-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderTasks();
  }));

  [$("#header-note-button"), $("#scratch-add"), $("#new-note-button"), $("#first-note-button")].forEach((button) => button.addEventListener("click", () => showNoteForm(true)));
  $("#close-note-form").addEventListener("click", () => showNoteForm(false));

  $$("[data-note-color]").forEach((button) => button.addEventListener("click", () => {
    selectedNoteColor = button.dataset.noteColor;
    $$("[data-note-color]").forEach((item) => item.classList.toggle("selected", item === button));
  }));

  $("#note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#note-title").value.trim();
    if (!title) return;
    notes.unshift({
      id: id(),
      title: title.slice(0, 120),
      content: $("#note-content").value.trim().slice(0, 10000),
      color: selectedNoteColor,
      updatedAt: new Date().toISOString(),
    });
    event.currentTarget.reset();
    selectedNoteColor = "ember";
    $$("[data-note-color]").forEach((button) => button.classList.toggle("selected", button.dataset.noteColor === "ember"));
    event.currentTarget.hidden = true;
    saveNotes();
  });

  updateDateAndTime();
  setInterval(updateDateAndTime, 30_000);
  renderTasks();
  renderNotes();
  loadWeather();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
