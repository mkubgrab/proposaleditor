import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      tasks: true,
      contexts: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      repoUrl: body.repoUrl,
      metadata: body.metadata ?? {},
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}

