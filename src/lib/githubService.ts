import { Octokit } from "@octokit/rest";

export const PROPOSAL_BRANCHES = {
  main: "main",
  userInput: "user-input",
  agentWork: "agent-work",
} as const;

type CommitFileInput = {
  branch: string;
  path: string;
  content: string;
  message: string;
};

export class GitHubBranchService {
  private octokit: Octokit;

  constructor(
    private owner: string,
    private repo: string,
    token: string,
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async ensureBranch(branch: string, fromBranch = PROPOSAL_BRANCHES.main): Promise<void> {
    try {
      await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
      });
      return;
    } catch {
      const base = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${fromBranch}`,
      });

      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branch}`,
        sha: base.data.object.sha,
      });
    }
  }

  async ensureProposalBranches(): Promise<void> {
    await this.ensureBranch(PROPOSAL_BRANCHES.userInput);
    await this.ensureBranch(PROPOSAL_BRANCHES.agentWork);
  }

  async listFiles(branch: string, path = ""): Promise<string[]> {
    const ref = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`,
    });
    const tree = await this.octokit.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: ref.data.object.sha,
      recursive: "true",
    });

    return (tree.data.tree ?? [])
      .map((item) => item.path)
      .filter((item): item is string => typeof item === "string")
      .filter((item) => (!path ? true : item.startsWith(path)));
  }

  async getFile(path: string, branch: string): Promise<{ content: string; sha: string }> {
    const file = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: branch,
    });

    if (!("content" in file.data)) {
      throw new Error(`Path ${path} is not a file`);
    }

    const decoded = Buffer.from(file.data.content, "base64").toString("utf-8");
    return { content: decoded, sha: file.data.sha };
  }

  async commitFile(input: CommitFileInput): Promise<string> {
    await this.ensureBranch(input.branch);
    let sha: string | undefined;
    try {
      sha = (await this.getFile(input.path, input.branch)).sha;
    } catch {
      sha = undefined;
    }

    const result = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      branch: input.branch,
      path: input.path,
      message: input.message,
      content: Buffer.from(input.content, "utf-8").toString("base64"),
      sha,
    });

    return result.data.commit.sha ?? "";
  }
}
