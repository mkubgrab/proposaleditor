import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiKey: string = body.apiKey;
  const userVersion: string = body.userVersion ?? "";
  const agentVersion: string = body.agentVersion ?? "";
  const model: string = body.model ?? "gpt-4o-mini";

  if (!userVersion && !agentVersion) {
    return NextResponse.json({ error: "At least one version is required" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({
      merged:
        `${userVersion}\n\n---\n\n${agentVersion}`.trim() ||
        "No AI key set. Add an API key to enable merge synthesis.",
      fallback: true,
    });
  }

  try {
    const response = await fetch(process.env.LLM_API_ENDPOINT ?? DEFAULT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You merge two proposal drafts. Keep factual detail from both versions and return one clean markdown draft only.",
          },
          {
            role: "user",
            content: `User Version:\n${userVersion}\n\nAgent Version:\n${agentVersion}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "LLM request failed");
    }

    const data = await response.json();
    const merged = data.choices?.[0]?.message?.content?.trim();
    if (!merged) {
      throw new Error("Model did not return merged text");
    }
    return NextResponse.json({ merged });
  } catch {
    return NextResponse.json({
      merged:
        `${userVersion}\n\n---\n\n${agentVersion}`.trim() ||
        "Merge unavailable. Please edit manually.",
      fallback: true,
    });
  }
}

