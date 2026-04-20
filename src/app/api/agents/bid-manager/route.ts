import { NextRequest, NextResponse } from "next/server";
import { briefToTasks } from "@/lib/bidManager";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const projectId: string = body.projectId;
  const brief: string = body.brief;
  const overrides = Array.isArray(body.overrides) ? body.overrides : [];

  if (!projectId || !brief) {
    return NextResponse.json({ error: "projectId and brief are required" }, { status: 400 });
  }

  const context = await prisma.context.create({
    data: {
      projectId,
      initialBrief: brief,
      overrideHistory: overrides,
    },
  });

  const drafts = briefToTasks(brief);
  const createdTasks = await prisma.$transaction(
    drafts.map((task) =>
      prisma.task.create({
        data: {
          ...task,
          projectId,
          contextId: context.id,
        },
      }),
    ),
  );

  return NextResponse.json({ context, tasks: createdTasks }, { status: 201 });
}

