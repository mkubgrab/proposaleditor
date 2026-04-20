import { NextRequest, NextResponse } from "next/server";
import { GitHubBranchService } from "@/lib/githubService";

function serviceFrom(request: NextRequest, body?: Record<string, unknown>) {
  const token = String(body?.token ?? request.nextUrl.searchParams.get("token") ?? "");
  const owner = String(body?.owner ?? request.nextUrl.searchParams.get("owner") ?? "");
  const repo = String(body?.repo ?? request.nextUrl.searchParams.get("repo") ?? "");
  if (!token || !owner || !repo) {
    throw new Error("token, owner and repo are required");
  }
  return new GitHubBranchService(owner, repo, token);
}

export async function GET(request: NextRequest) {
  try {
    const service = serviceFrom(request);
    const branch = request.nextUrl.searchParams.get("branch");
    const path = request.nextUrl.searchParams.get("path");
    if (!branch) {
      return NextResponse.json({ error: "branch is required" }, { status: 400 });
    }
    if (path) {
      const file = await service.getFile(path, branch);
      return NextResponse.json(file);
    }
    const files = await service.listFiles(branch);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = serviceFrom(request, body);
    const action = String(body.action ?? "");

    if (action === "ensure-proposal-branches") {
      await service.ensureProposalBranches();
      return NextResponse.json({ ok: true });
    }

    if (action === "commit-file") {
      const commitSha = await service.commitFile({
        branch: body.branch,
        path: body.path,
        content: body.content,
        message: body.message ?? `Update ${body.path}`,
      });
      return NextResponse.json({ commitSha });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}

