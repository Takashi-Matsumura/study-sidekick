import { NextRequest } from 'next/server';
import {
  listRAGDocuments,
  uploadRAGDocument,
} from '@/lib/rag/provider';

// GET: List documents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;

    const documents = await listRAGDocuments(category);

    return new Response(JSON.stringify({ documents }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST: Upload document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename, category } = body;

    if (!content || !filename) {
      return new Response(
        JSON.stringify({ error: 'content と filename は必須です' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await uploadRAGDocument(content, filename, category);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
