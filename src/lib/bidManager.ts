import { AgentRole, TaskStatus } from "@prisma/client";

export type TaskDraft = {
  title: string;
  description: string;
  assignedRole: AgentRole;
  status: TaskStatus;
  branch: string;
};

const technicalKeywords = [
  "architecture",
  "api",
  "database",
  "integration",
  "security",
  "frontend",
  "backend",
];

export function briefToTasks(brief: string): TaskDraft[] {
  const lines = brief
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const items = lines.length > 0 ? lines : brief.split(".").map((sentence) => sentence.trim()).filter(Boolean);

  return items.map((item, index) => {
    const lowered = item.toLowerCase();
    const assignedRole = technicalKeywords.some((keyword) => lowered.includes(keyword))
      ? AgentRole.TECHNICAL_MANAGER
      : AgentRole.PROJECT_MANAGER;

    return {
      title: `Task ${index + 1}`,
      description: item,
      assignedRole,
      status: TaskStatus.TODO,
      branch: "agent-work",
    };
  });
}

