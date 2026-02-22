import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./firebaseClient";

const STORAGE_KEY = "daily_tasks_v1";
const THEME_KEY = "daily_tasks_theme_v1";

const sampleTaskLists = [
  {
    id: crypto.randomUUID(),
    title: "Today Focus",
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    return parsed;
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

function LoginScreen({
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
    <div className="auth-shell">
      <div className="auth-card card">
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
            {isAuthLoading
              ? "Please wait..."
              : authMode === "signin"
                ? "Sign in"
                : "Create account"}
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

    const nextTaskList = {
      id: crypto.randomUUID(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tasks: [],
    };

    setTaskLists((prev) => [nextTaskList, ...prev]);
    setActiveTaskListId(nextTaskList.id);
    setNewTaskListTitle("");
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
        <div className="auth-card card">
          <h2>Firebase setup needed</h2>
          <p className="auth-copy">
            Add your Firebase keys to `.env` using `.env.example`, then restart `npm run dev`.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <h2>Checking session...</h2>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
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
          </form>

          <section>
            <h2>Tasks ({sortedTaskLists.length})</h2>
            <ul className="list">
              {sortedTaskLists.map((taskList) => (
                <li key={taskList.id}>
                  <button
                    type="button"
                    className={`list-item ${taskList.id === activeTaskListId ? "active" : ""}`}
                    onClick={() => setActiveTaskListId(taskList.id)}
                  >
                    <span>{taskList.title}</span>
                    <small>{formatDate(taskList.createdAt)}</small>
                  </button>
                </li>
              ))}
              {!sortedTaskLists.length && <li className="empty">No tasks yet.</li>}
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
