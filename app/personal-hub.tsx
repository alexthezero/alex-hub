"use client";

import { useEffect, useMemo, useState } from "react";

type View = "today" | "tasks" | "notes" | "projects";
type Task = { id: number; title: string; category: string; completed: boolean; createdAt?: string };
type Note = { id: number; title: string; content: string; color: string; updatedAt: string };

const previewTasks: Task[] = [
  { id: 1, title: "Review this week’s priorities", category: "Personal", completed: false },
  { id: 2, title: "Check the 3D printer queue", category: "Workshop", completed: false },
  { id: 3, title: "Plan tomorrow before signing off", category: "Routine", completed: true },
];

const projects = [
  { title: "Smart Mirror", eyebrow: "BUILD", detail: "Weather radar + daily widgets", tone: "green" },
  { title: "3D Printing", eyebrow: "WORKSHOP", detail: "Print queue, ideas, and supplies", tone: "orange" },
  { title: "Business Ideas", eyebrow: "NEXT UP", detail: "Apps and income experiments", tone: "blue" },
];

const quickLinks = [
  { label: "GitHub", href: "https://github.com/alexthezero", mark: "GH" },
  { label: "IronNest Etsy", href: "https://ironnestco.etsy.com", mark: "IN" },
  { label: "ChatGPT", href: "https://chatgpt.com", mark: "AI" },
  { label: "Weather", href: "https://www.weather.gov/", mark: "WX" },
];

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function PersonalHub({ displayName }: { displayName: string }) {
  const [view, setView] = useState<View>("today");
  const [tasks, setTasks] = useState<Task[]>(previewTasks);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState("sage");
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [status, setStatus] = useState("Loading your hub…");
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/tasks"), fetch("/api/notes")])
      .then(async ([taskResponse, noteResponse]) => {
        if (!taskResponse.ok || !noteResponse.ok) throw new Error("Your saved items are unavailable.");
        const taskData = (await taskResponse.json()) as { tasks: Task[] };
        const noteData = (await noteResponse.json()) as { notes: Note[] };
        if (active) {
          setTasks(taskData.tasks);
          setNotes(noteData.notes);
          setStatus("");
        }
      })
      .catch(() => active && setStatus("Preview mode — changes won’t be saved here."));
    return () => { active = false; };
  }, []);

  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now);
  const complete = tasks.filter((task) => task.completed).length;

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    setStatus("Saving…");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, category: "Inbox" }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { task: Task };
      setTasks((current) => [data.task, ...current]);
      setDraft("");
      setStatus("Saved");
      window.setTimeout(() => setStatus(""), 1400);
    } catch {
      setStatus("Couldn’t save that task. Please try again.");
    }
  }

  async function toggleTask(task: Task) {
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id, completed }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      setStatus("That change didn’t save.");
    }
  }

  async function deleteTask(id: number) {
    const before = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));
    try {
      const response = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    } catch {
      setTasks(before);
      setStatus("That task couldn’t be removed.");
    }
  }

  async function addNote() {
    const title = noteTitle.trim();
    if (!title) return;
    setStatus("Saving…");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content: noteContent, color: noteColor }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { note: Note };
      setNotes((current) => [data.note, ...current]);
      setNoteTitle("");
      setNoteContent("");
      setNoteColor("sage");
      setNoteFormOpen(false);
      setStatus("Note saved");
      window.setTimeout(() => setStatus(""), 1400);
    } catch {
      setStatus("Couldn’t save that note. Please try again.");
    }
  }

  async function deleteNote(id: number) {
    const before = notes;
    setNotes((current) => current.filter((note) => note.id !== id));
    try {
      const response = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    } catch {
      setNotes(before);
      setStatus("That note couldn’t be removed.");
    }
  }

  const TaskRow = ({ task, removable = false }: { task: Task; removable?: boolean }) => (
    <div className={task.completed ? "task-row done" : "task-row"}>
      <label>
        <input checked={task.completed} onChange={() => toggleTask(task)} type="checkbox" />
        <span className="checkmark" aria-hidden="true">✓</span>
        <span className="task-copy"><strong>{task.title}</strong><small>{task.category}</small></span>
      </label>
      {removable && <button className="delete-button" onClick={() => deleteTask(task.id)} type="button" aria-label={`Delete ${task.title}`}>×</button>}
    </div>
  );

  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Alex Hub home"><span className="brand-mark">A</span><span><strong>Alex Hub</strong><small>Private workspace</small></span></a>
        <nav className="nav-list" aria-label="Main navigation">
          {([ ["today", "⌂", "Today"], ["tasks", "✓", "Tasks"], ["notes", "✎", "Notes"], ["projects", "◇", "Projects"] ] as const).map(([key, icon, label]) => (
            <button className={view === key ? "nav-item active" : "nav-item"} key={key} onClick={() => setView(key)} type="button"><span aria-hidden="true">{icon}</span>{label}</button>
          ))}
        </nav>
        <div className="privacy-card"><span className="privacy-icon" aria-hidden="true">●</span><div><strong>Private & secure</strong><p>Only your account can open this hub.</p></div></div>
        <div className="profile-mini"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName} C.</strong><small>Owner</small></div></div>
      </aside>

      <main className="main" id="top">
        <header className="topbar">
          <div><p className="date-line">{dateLabel}</p><h1>{greetingForHour(now.getHours())}, {displayName}.</h1><p className="subhead">Here’s your day at a glance.</p></div>
          <div className="topbar-tools">{status && <span className="save-status" role="status">{status}</span>}<button className="avatar-button" type="button" aria-label="Account menu">{displayName.slice(0, 1).toUpperCase()}</button></div>
        </header>

        {view === "today" && (
          <div className="dashboard-grid">
            <section className="focus-card panel">
              <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Make today count.</h2></div><span className="day-badge">{now.getDate()}</span></div>
              <p className="focus-copy">One clear priority beats a dozen half-finished plans. Capture what matters, then get moving.</p>
              <div className="capture-row"><input aria-label="Add a new task" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="What needs to get done?" value={draft} /><button onClick={addTask} type="button">Add task</button></div>
            </section>

            <section className="progress-card panel">
              <span className="eyebrow">DAILY PROGRESS</span><div className="progress-center"><div className="progress-ring" style={{ "--progress": `${tasks.length ? (complete / tasks.length) * 360 : 0}deg` } as React.CSSProperties}><span>{complete}/{tasks.length}</span></div><p>{tasks.length === 0 ? "Add a task to start your day." : complete === tasks.length ? "All done. Nice work." : "Keep the momentum going."}</p></div>
            </section>

            <section className="tasks-card panel">
              <div className="section-heading compact"><div><span className="eyebrow">UP NEXT</span><h2>Tasks</h2></div><button className="text-button" onClick={() => setView("tasks")} type="button">View all →</button></div>
              <div className="task-list">{tasks.length ? tasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} />) : <p className="inline-empty">Your list is clear. Add your first task above.</p>}</div>
            </section>

            <section className="links-card panel">
              <div className="section-heading compact"><div><span className="eyebrow">BOOKMARKS</span><h2>Quick links</h2></div></div>
              <div className="link-grid">{quickLinks.map((link) => <a href={link.href} key={link.label} rel="noreferrer" target="_blank"><span>{link.mark}</span><strong>{link.label}</strong><b aria-hidden="true">↗</b></a>)}</div>
            </section>

            <section className="projects-card panel">
              <div className="section-heading compact"><div><span className="eyebrow">IN THE WORKS</span><h2>Active projects</h2></div><button className="text-button" onClick={() => setView("projects")} type="button">See projects →</button></div>
              <div className="project-grid">{projects.map((project) => <article className={`project-tile ${project.tone}`} key={project.title}><span>{project.eyebrow}</span><h3>{project.title}</h3><p>{project.detail}</p></article>)}</div>
            </section>
          </div>
        )}

        {view === "tasks" && (
          <section className="page-panel panel">
            <div className="section-heading"><div><span className="eyebrow">GET IT DONE</span><h2>All tasks</h2></div><span className="count-pill">{tasks.length} total</span></div>
            <div className="capture-row page-capture"><input aria-label="Add a new task" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Add a task to your inbox" value={draft} /><button onClick={addTask} type="button">Add task</button></div>
            <div className="task-list wide">{tasks.length ? tasks.map((task) => <TaskRow key={task.id} removable task={task} />) : <p className="inline-empty spacious">Nothing hanging over your head. Add something when you’re ready.</p>}</div>
          </section>
        )}

        {view === "notes" && (
          <section className="page-panel panel notes-page">
            <div className="section-heading"><div><span className="eyebrow">PERSONAL NOTES</span><h2>A clear place for loose thoughts.</h2></div><button className="primary-button" onClick={() => setNoteFormOpen((open) => !open)} type="button">{noteFormOpen ? "Cancel" : "+ New note"}</button></div>
            {noteFormOpen && (
              <div className="note-form">
                <input aria-label="Note title" onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" value={noteTitle} />
                <textarea aria-label="Note content" onChange={(event) => setNoteContent(event.target.value)} placeholder="Write anything you don’t want to forget…" rows={5} value={noteContent} />
                <div className="note-form-footer">
                  <div className="color-picker" aria-label="Note color">{["sage", "sand", "blue"].map((color) => <button aria-label={`${color} note`} className={`${color} ${noteColor === color ? "selected" : ""}`} key={color} onClick={() => setNoteColor(color)} type="button" />)}</div>
                  <button className="primary-button" disabled={!noteTitle.trim()} onClick={addNote} type="button">Save note</button>
                </div>
              </div>
            )}
            {notes.length ? (
              <div className="notes-grid">{notes.map((note) => <article className={`note-card ${note.color}`} key={note.id}><div><span className="eyebrow">NOTE</span><h3>{note.title}</h3><p>{note.content || "No additional details."}</p></div><footer><small>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(note.updatedAt.replace(" ", "T") + "Z"))}</small><button onClick={() => deleteNote(note.id)} type="button" aria-label={`Delete ${note.title}`}>×</button></footer></article>)}</div>
            ) : !noteFormOpen && (
              <div className="notes-empty"><span className="empty-icon">✎</span><h3>Your notes will live here.</h3><p>Use this for shopping lists, measurements, project ideas, or anything else worth remembering.</p><button className="primary-button" onClick={() => setNoteFormOpen(true)} type="button">Create your first note</button></div>
            )}
          </section>
        )}

        {view === "projects" && (
          <section className="page-panel panel"><div className="section-heading"><div><span className="eyebrow">IDEAS INTO ACTION</span><h2>Your projects</h2></div></div><div className="project-grid expanded">{projects.map((project) => <article className={`project-tile ${project.tone}`} key={project.title}><span>{project.eyebrow}</span><h3>{project.title}</h3><p>{project.detail}</p><button type="button">Open project →</button></article>)}</div></section>
        )}
      </main>
    </div>
  );
}
