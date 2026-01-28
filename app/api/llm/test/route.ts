import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const models = data.data || data.models || [];
    const modelCount = models.length;
    const modelNames = models
      .slice(0, 3)
      .map((m: { id?: string; name?: string; model?: string }) =>
        m.id || m.name || m.model || 'unknown'
      );

    return NextResponse.json({
      success: true,
      modelCount,
      modelNames,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
