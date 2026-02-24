import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  isFirebaseConfigured,
  missingFirebaseEnvKeys,
} from "./firebaseClient";

const STORAGE_KEY = "daily_tasks_v1";
const THEME_KEY = "daily_tasks_theme_v1";

const sampleTaskLists = [
  {
    id: crypto.randomUUID(),
    title: "Today Focus",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deadlineAt: Date.now() + 1000 * 60 * 60 * 24,
    tasks: [
      {
        id: crypto.randomUUID(),
        text: "Finish app shell",
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: crypto.randomUUID(),
        text: "Plan Firebase migration",
        completed: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeInputValue(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deadlineMeta(deadlineAt) {
  if (!deadlineAt) return { label: "No deadline", overdue: false };
  const diff = deadlineAt - Date.now();
  if (diff < 0) return { label: `Overdue: ${formatDateTime(deadlineAt)}`, overdue: true };
  return { label: `Due: ${formatDateTime(deadlineAt)}`, overdue: false };
}

function storageKeyFor(uid) {
  return `${STORAGE_KEY}_${uid}`;
}

function loadTaskLists(uid) {
  if (!uid) return [];
  const raw = localStorage.getItem(storageKeyFor(uid));
  if (!raw) return sampleTaskLists;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return sampleTaskLists;
    return parsed.map((list) => ({ ...list, deadlineAt: list.deadlineAt ?? null }));
  } catch {
    return sampleTaskLists;
  }
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

function normalizeIdentifierToEmail(identifier) {
  const value = identifier.trim().toLowerCase();
  if (value.includes("@")) return value;
  return `${value}@dailytasks.local`;
}

function AuthCard({
  authMode,
  setAuthMode,
  identifier,
  setIdentifier,
  password,
  setPassword,
  displayName,
  setDisplayName,
  authError,
  isAuthLoading,
  onEmailAuth,
  onGoogleAuth,
}) {
  return (
    <div className="auth-card card soft-card" id="auth-access">
      <h2>{authMode === "signin" ? "Sign in" : "Create account"}</h2>
      {authError ? <p className="auth-error">{authError}</p> : null}

      <form className="auth-form" onSubmit={onEmailAuth}>
        {authMode === "signup" ? (
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
            autoComplete="name"
          />
        ) : null}
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Email or username"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete={authMode === "signin" ? "current-password" : "new-password"}
        />
        <button type="submit" disabled={isAuthLoading}>
          {isAuthLoading ? "Please wait..." : authMode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="auth-divider" aria-hidden="true" />

      <button type="button" className="secondary-btn" onClick={onGoogleAuth} disabled={isAuthLoading}>
        Continue with Google
      </button>

      <p className="auth-switch">
        {authMode === "signin" ? "New here?" : "Already have an account?"}
        <button
          type="button"
          className="text-btn"
          onClick={() => setAuthMode((prev) => (prev === "signin" ? "signup" : "signin"))}
        >
          {authMode === "signin" ? "Create account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [taskLists, setTaskLists] = useState([]);
  const [activeTaskListId, setActiveTaskListId] = useState(null);
  const [newTaskListTitle, setNewTaskListTitle] = useState("");
  const [newTaskListDeadline, setNewTaskListDeadline] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsAuthLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setTaskLists([]);
      setActiveTaskListId(null);
      return;
    }

    const loaded = loadTaskLists(authUser.uid);
    setTaskLists(loaded);
    setActiveTaskListId(loaded[0]?.id ?? null);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    localStorage.setItem(storageKeyFor(authUser.uid), JSON.stringify(taskLists));
  }, [taskLists, authUser]);

  useEffect(() => {
    if (!taskLists.length) {
      setActiveTaskListId(null);
      return;
    }

    const stillExists = taskLists.some((taskList) => taskList.id === activeTaskListId);
    if (!stillExists) {
      setActiveTaskListId(taskLists[0].id);
    }
  }, [taskLists, activeTaskListId]);

  const sortedTaskLists = useMemo(
    () => [...taskLists].sort((a, b) => b.updatedAt - a.updatedAt),
    [taskLists]
  );

  const activeTaskList = useMemo(
    () => taskLists.find((taskList) => taskList.id === activeTaskListId) ?? null,
    [taskLists, activeTaskListId]
  );

  const upcomingTimeline = useMemo(
    () =>
      [...taskLists]
        .filter((item) => item.deadlineAt)
        .sort((a, b) => a.deadlineAt - b.deadlineAt)
        .slice(0, 4),
    [taskLists]
  );

  const openAuth = (mode) => {
    setAuthMode(mode);
    setTimeout(() => {
      const target = document.getElementById("auth-access");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setAuthError("");

    if (!identifier.trim() || !password.trim()) {
      setAuthError("Enter email/username and password.");
      return;
    }

    try {
      setIsSubmittingAuth(true);
      const email = normalizeIdentifierToEmail(identifier);

      if (authMode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
      }

      setIdentifier("");
      setPassword("");
      setDisplayName("");
    } catch (error) {
      setAuthError(error?.message || "Authentication failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    try {
      setIsSubmittingAuth(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error?.message || "Google sign-in failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const createTaskList = (event) => {
    event.preventDefault();
    const title = newTaskListTitle.trim();
    if (!title) return;

    const now = Date.now();
    const nextTaskList = {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      deadlineAt: newTaskListDeadline ? new Date(newTaskListDeadline).getTime() : null,
      tasks: [],
    };

    setTaskLists((prev) => [nextTaskList, ...prev]);
    setActiveTaskListId(nextTaskList.id);
    setNewTaskListTitle("");
    setNewTaskListDeadline("");
  };

  const renameTaskList = (taskListId, title) => {
    const now = Date.now();
    setTaskLists((prev) =>
      prev.map((taskList) => {
        if (taskList.id !== taskListId) return taskList;
        return {
          ...taskList,
          title,
          updatedAt: now,
        };
      })
    );
  };

  const updateTaskListDeadline = (taskListId, inputValue) => {
    const now = Date.now();
    setTaskLists((prev) =>
      prev.map((taskList) => {
        if (taskList.id !== taskListId) return taskList;
        return {
          ...taskList,
          deadlineAt: inputValue ? new Date(inputValue).getTime() : null,
          updatedAt: now,
        };
      })
    );
  };

  const addTask = (event) => {
    event.preventDefault();
    const text = newTaskText.trim();
    if (!text || !activeTaskListId) return;

    const now = Date.now();

    setTaskLists((prev) =>
      prev.map((taskList) => {
        if (taskList.id !== activeTaskListId) return taskList;
        return {
          ...taskList,
          updatedAt: now,
          tasks: [
            {
              id: crypto.randomUUID(),
              text,
              completed: false,
              createdAt: now,
              updatedAt: now,
            },
            ...taskList.tasks,
          ],
        };
      })
    );

    setNewTaskText("");
  };

  const toggleTask = (taskId) => {
    const now = Date.now();

    setTaskLists((prev) =>
      prev.map((taskList) => {
        const hasTask = taskList.tasks.some((task) => task.id === taskId);
        if (!hasTask) return taskList;

        return {
          ...taskList,
          updatedAt: now,
          tasks: taskList.tasks.map((task) => {
            if (task.id !== taskId) return task;
            return {
              ...task,
              completed: !task.completed,
              updatedAt: now,
            };
          }),
        };
      })
    );
  };

  const deleteTask = (taskId) => {
    const now = Date.now();

    setTaskLists((prev) =>
      prev.map((taskList) => {
        const hasTask = taskList.tasks.some((task) => task.id === taskId);
        if (!hasTask) return taskList;

        return {
          ...taskList,
          updatedAt: now,
          tasks: taskList.tasks.filter((task) => task.id !== taskId),
        };
      })
    );
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="auth-shell">
        <div className="auth-card card soft-card">
          <h2>Firebase setup needed</h2>
          <p className="auth-copy">
            Add your Firebase keys to `.env` using `.env.example`, then restart `npm run dev`.
          </p>
          {missingFirebaseEnvKeys.length ? (
            <p className="auth-error">Missing: {missingFirebaseEnvKeys.join(", ")}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card card soft-card">
          <h2>Checking session...</h2>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="landing-shell">
        <header className="topbar soft-card">
          <div>
            <p className="kicker">Planning made practical</p>
            <h1>daily tasks</h1>
          </div>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to moon mode" : "Switch to sun mode"}
            title={theme === "light" ? "Moon" : "Sun"}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
        </header>

        <main className="landing-grid">
          <section className="card soft-card landing-hero">
            <p className="kicker">Realtime personal planning</p>
            <h2>Plan each task list with title, timeline and completion flow.</h2>
            <p>
              Create task lists, assign date-time deadlines, and track completion with a clean interface built
              for daily execution.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={() => openAuth("signup")}>Start free</button>
              <button type="button" className="secondary-btn" onClick={() => openAuth("signin")}>Sign in</button>
            </div>
          </section>

          <section className="card soft-card landing-features">
            <h3>What this app does</h3>
            <div className="feature-grid">
              <article className="feature-box">
                <h4>Task Lists</h4>
                <p>Group tasks by context and edit titles any time.</p>
              </article>
              <article className="feature-box">
                <h4>Deadline Timeline</h4>
                <p>Set date-time targets and monitor due/overdue status clearly.</p>
              </article>
              <article className="feature-box">
                <h4>Secure Access</h4>
                <p>Sign in using Google or email/password with Firebase Auth.</p>
              </article>
              <article className="feature-box">
                <h4>Cross-device Ready</h4>
                <p>Architecture is ready for Firestore sync as the next upgrade.</p>
              </article>
            </div>
          </section>

          <section className="card soft-card landing-how">
            <h3>How to use</h3>
            <ol>
              <li>Create an account or sign in.</li>
              <li>Create a task list and set its deadline.</li>
              <li>Add tasks, mark done, and track timeline progress.</li>
            </ol>
          </section>

          <AuthCard
            authMode={authMode}
            setAuthMode={setAuthMode}
            identifier={identifier}
            setIdentifier={setIdentifier}
            password={password}
            setPassword={setPassword}
            displayName={displayName}
            setDisplayName={setDisplayName}
            authError={authError}
            isAuthLoading={isSubmittingAuth}
            onEmailAuth={handleEmailAuth}
            onGoogleAuth={handleGoogleAuth}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="kicker">Personal planner</p>
          <h1>daily tasks</h1>
          <p className="auth-user">{authUser.displayName || authUser.email}</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="theme-btn"
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to moon mode" : "Switch to sun mode"}
            title={theme === "light" ? "Moon" : "Sun"}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button type="button" className="secondary-btn logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="layout-grid">
        <aside className="sidebar card">
          <form className="inline-form" onSubmit={createTaskList}>
            <label htmlFor="task-list-title">New task title</label>
            <div className="input-row">
              <input
                id="task-list-title"
                type="text"
                value={newTaskListTitle}
                onChange={(event) => setNewTaskListTitle(event.target.value)}
                placeholder="Example: Work Sprint"
              />
              <button type="submit">Add</button>
            </div>
            <input
              type="datetime-local"
              value={newTaskListDeadline}
              onChange={(event) => setNewTaskListDeadline(event.target.value)}
            />
          </form>

          <section>
            <h2>Tasks ({sortedTaskLists.length})</h2>
            <ul className="list">
              {sortedTaskLists.map((taskList) => {
                const meta = deadlineMeta(taskList.deadlineAt);
                return (
                  <li key={taskList.id}>
                    <button
                      type="button"
                      className={`list-item ${taskList.id === activeTaskListId ? "active" : ""}`}
                      onClick={() => setActiveTaskListId(taskList.id)}
                    >
                      <div>
                        <span>{taskList.title}</span>
                        <small className={meta.overdue ? "overdue" : ""}>{meta.label}</small>
                      </div>
                      <small>{formatDate(taskList.createdAt)}</small>
                    </button>
                  </li>
                );
              })}
              {!sortedTaskLists.length && <li className="empty">No tasks yet.</li>}
            </ul>
          </section>

          <section>
            <h2>Timeline</h2>
            <ul className="timeline-list">
              {upcomingTimeline.map((item) => {
                const meta = deadlineMeta(item.deadlineAt);
                return (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <small className={meta.overdue ? "overdue" : ""}>{meta.label}</small>
                  </li>
                );
              })}
              {!upcomingTimeline.length && <li className="empty">No deadlines set yet.</li>}
            </ul>
          </section>
        </aside>

        <section className="content card">
          {activeTaskList ? (
            <>
              <div className="content-head">
                <div className="task-list-head">
                  <p className="kicker">Created {formatDate(activeTaskList.createdAt)}</p>
                  <input
                    type="text"
                    className="task-list-title-input"
                    value={activeTaskList.title}
                    onChange={(event) => renameTaskList(activeTaskList.id, event.target.value)}
                    placeholder="Untitled task"
                  />
                </div>
                <span className="pill">{activeTaskList.tasks.length} tasks</span>
              </div>

              <div className="inline-form">
                <label htmlFor="active-deadline">Task list deadline</label>
                <input
                  id="active-deadline"
                  type="datetime-local"
                  value={toDateTimeInputValue(activeTaskList.deadlineAt)}
                  onChange={(event) => updateTaskListDeadline(activeTaskList.id, event.target.value)}
                />
                <small className={deadlineMeta(activeTaskList.deadlineAt).overdue ? "overdue" : ""}>
                  {deadlineMeta(activeTaskList.deadlineAt).label}
                </small>
              </div>

              <form className="inline-form" onSubmit={addTask}>
                <label htmlFor="task-text">Add a task</label>
                <div className="input-row">
                  <input
                    id="task-text"
                    type="text"
                    value={newTaskText}
                    onChange={(event) => setNewTaskText(event.target.value)}
                    placeholder="Write your next task"
                  />
                  <button type="submit">Add task</button>
                </div>
              </form>

              <ul className="task-list">
                {activeTaskList.tasks.map((task) => (
                  <li key={task.id} className="task-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                      />
                      <span className={task.completed ? "done" : ""}>{task.text}</span>
                    </label>
                    <button type="button" onClick={() => deleteTask(task.id)}>
                      Remove
                    </button>
                  </li>
                ))}
                {!activeTaskList.tasks.length && (
                  <li className="empty">No tasks yet. Add your first one above.</li>
                )}
              </ul>
            </>
          ) : (
            <div className="empty-state">
              <h2>Create your first task</h2>
              <p>Use the sidebar input to start tracking.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="footbar">
        <p>Copyright © {new Date().getFullYear()} Daily Tasks. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
