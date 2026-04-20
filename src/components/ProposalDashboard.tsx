"use client";

import dynamic from "next/dynamic";
import { FormEvent, useMemo, useState } from "react";
import styles from "./ProposalDashboard.module.css";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.DiffEditor),
  { ssr: false },
);

const defaultPersonas = {
  bidManager: "Owns user briefing, task decomposition, and orchestration.",
  technicalManager: "Produces architecture and implementation deliverables.",
  projectManager: "Produces plans, milestones, and risk controls.",
  qualityManager: "Performs integration checks and controls merge approval.",
};

type Credentials = {
  owner: string;
  repo: string;
  githubToken: string;
  llmApiKey: string;
  personas: typeof defaultPersonas;
};

export function ProposalDashboard() {
  const [credentials, setCredentials] = useState<Credentials>({
    owner: "",
    repo: "",
    githubToken: "",
    llmApiKey: "",
    personas: defaultPersonas,
  });
  const [activeBranch, setActiveBranch] = useState("user-input");
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [userDraft, setUserDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState("");
  const [mergeDraft, setMergeDraft] = useState("");
  const [brief, setBrief] = useState("");
  const [projectId, setProjectId] = useState("");
  const [chat, setChat] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const canUseGithub = useMemo(
    () => Boolean(credentials.owner && credentials.repo && credentials.githubToken),
    [credentials],
  );

  async function bootstrapBranches() {
    if (!canUseGithub) return;
    await fetch("/api/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ensure-proposal-branches",
        owner: credentials.owner,
        repo: credentials.repo,
        token: credentials.githubToken,
      }),
    });
    await loadFiles(activeBranch);
  }

  async function loadFiles(branch = activeBranch) {
    if (!canUseGithub) return;
    const params = new URLSearchParams({
      branch,
      owner: credentials.owner,
      repo: credentials.repo,
      token: credentials.githubToken,
    });
    const response = await fetch(`/api/github?${params.toString()}`);
    const data = await response.json();
    setFiles(data.files ?? []);
  }

  async function loadFile(path: string) {
    if (!canUseGithub) return;
    const params = new URLSearchParams({
      branch: activeBranch,
      path,
      owner: credentials.owner,
      repo: credentials.repo,
      token: credentials.githubToken,
    });
    const response = await fetch(`/api/github?${params.toString()}`);
    const data = await response.json();
    setActiveFile(path);
    if (activeBranch === "agent-work") {
      setAgentDraft(data.content ?? "");
    } else {
      setUserDraft(data.content ?? "");
    }
  }

  async function saveToBranch(branch: "user-input" | "agent-work" | "main", content: string) {
    if (!canUseGithub || !activeFile) return;
    setPending(true);
    try {
      await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit-file",
          owner: credentials.owner,
          repo: credentials.repo,
          token: credentials.githubToken,
          branch,
          path: activeFile,
          content,
          message: `Update ${activeFile} on ${branch}`,
        }),
      });
      setChat((prev) => [`Committed ${activeFile} to ${branch}`, ...prev]);
    } finally {
      setPending(false);
    }
  }

  async function solveWithAi() {
    setPending(true);
    try {
      const response = await fetch("/api/ai/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: credentials.llmApiKey,
          userVersion: userDraft,
          agentVersion: agentDraft,
        }),
      });
      const data = await response.json();
      setMergeDraft(data.merged ?? "");
      setChat((prev) => ["Quality Manager prepared merge draft.", ...prev]);
    } finally {
      setPending(false);
    }
  }

  async function submitBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!brief.trim()) return;
    setPending(true);
    try {
      let selectedProjectId = projectId;
      if (!selectedProjectId) {
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl: `https://github.com/${credentials.owner}/${credentials.repo}`,
            metadata: { personas: credentials.personas },
          }),
        });
        const projectData = await projectResponse.json();
        selectedProjectId = projectData.project.id;
        setProjectId(selectedProjectId);
      }

      const response = await fetch("/api/agents/bid-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          brief,
          overrides: [`${new Date().toISOString()}: ${brief}`],
        }),
      });
      const data = await response.json();
      setChat((prev) => [
        `Bid Manager created ${data.tasks?.length ?? 0} tasks and queued Technical/Project Managers.`,
        ...prev,
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.dashboard}>
      <section className={styles.pane}>
        <div className={styles.section}>
          <div className={styles.title}>Management Panel</div>
          <div className={styles.row}>
            <input
              placeholder="GitHub owner"
              value={credentials.owner}
              onChange={(e) => setCredentials((prev) => ({ ...prev, owner: e.target.value }))}
            />
            <input
              placeholder="Repository"
              value={credentials.repo}
              onChange={(e) => setCredentials((prev) => ({ ...prev, repo: e.target.value }))}
            />
            <input
              placeholder="GitHub PAT"
              type="password"
              value={credentials.githubToken}
              onChange={(e) => setCredentials((prev) => ({ ...prev, githubToken: e.target.value }))}
            />
            <input
              placeholder="LLM API key"
              type="password"
              value={credentials.llmApiKey}
              onChange={(e) => setCredentials((prev) => ({ ...prev, llmApiKey: e.target.value }))}
            />
            <button className={styles.button} onClick={bootstrapBranches} disabled={!canUseGithub || pending}>
              Init Triple Branches
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.title}>Agent Personas</div>
          {Object.entries(credentials.personas).map(([key, value]) => (
            <div className={styles.row} key={key}>
              <label className={styles.smallText}>{key}</label>
              <textarea
                value={value}
                onChange={(e) =>
                  setCredentials((prev) => ({
                    ...prev,
                    personas: { ...prev.personas, [key]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.title}>File Explorer</div>
          <div className={styles.row}>
            <select value={activeBranch} onChange={(e) => setActiveBranch(e.target.value)}>
              <option value="user-input">user-input</option>
              <option value="agent-work">agent-work</option>
              <option value="main">main</option>
            </select>
            <button className={styles.button} onClick={() => loadFiles()} disabled={!canUseGithub}>
              Refresh files
            </button>
          </div>
          <ul className={styles.fileList}>
            {files.map((file) => (
              <li key={file}>
                <button
                  className={`${styles.fileButton} ${activeFile === file ? styles.fileButtonActive : ""}`}
                  onClick={() => loadFile(file)}
                >
                  {file}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.middlePane}>
        <div className={styles.section}>
          <div className={styles.title}>Markdown Editor / Diff</div>
          <p className={styles.smallText}>
            Human edits commit to <b>user-input</b>. Agent outputs commit to <b>agent-work</b>. QM prepares merge and
            user approves before promoting to <b>main</b>.
          </p>
        </div>

        <div className={styles.editorGrid}>
          <div>
            <div className={styles.smallText}>User Draft</div>
            <textarea className={styles.editor} value={userDraft} onChange={(e) => setUserDraft(e.target.value)} />
            <button
              className={styles.button}
              onClick={() => saveToBranch("user-input", userDraft)}
              disabled={pending || !activeFile}
            >
              Commit to user-input
            </button>
          </div>
          <div>
            <div className={styles.smallText}>Agent Draft</div>
            <textarea className={styles.editor} value={agentDraft} onChange={(e) => setAgentDraft(e.target.value)} />
            <button
              className={styles.button}
              onClick={() => saveToBranch("agent-work", agentDraft)}
              disabled={pending || !activeFile}
            >
              Commit to agent-work
            </button>
          </div>
        </div>

        <DiffEditor
          height="100%"
          language="markdown"
          original={userDraft}
          modified={mergeDraft || agentDraft}
          options={{ readOnly: false, minimap: { enabled: false } }}
        />

        <div className={styles.section}>
          <button className={styles.button} onClick={solveWithAi} disabled={pending}>
            Solve with AI
          </button>
          <button
            className={styles.button}
            disabled={pending || !mergeDraft || !activeFile}
            onClick={() => saveToBranch("main", mergeDraft)}
            style={{ marginLeft: 8 }}
            title="Final approval action: commit merged draft to main"
          >
            User Approve Merge to main
          </button>
        </div>
      </section>

      <section className={styles.pane}>
        <div className={styles.section}>
          <div className={styles.title}>Human Briefing Chat</div>
          <form onSubmit={submitBrief} className={styles.row}>
            <textarea
              className={styles.briefInput}
              placeholder="Describe the proposal objective, constraints, and priorities..."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
            <button className={styles.button} type="submit" disabled={pending}>
              Create/Override Tasks
            </button>
          </form>
        </div>
        <div className={styles.section}>
          <div className={styles.title}>Chat Activity</div>
          <ul className={styles.chatList}>
            {chat.map((entry, index) => (
              <li key={`${entry}-${index}`} className={styles.chatItem}>
                {entry}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
