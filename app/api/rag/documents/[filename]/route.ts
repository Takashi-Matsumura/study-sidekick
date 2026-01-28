import { NextRequest } from 'next/server';
import {
  getRAGDocumentContent,
  deleteRAGDocument,
} from '@/lib/rag/provider';

// GET: Get document content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const { searchParams } = new URL(request.url);
    const ragBaseUrl = searchParams.get('ragBaseUrl') || undefined;
    const content = await getRAGDocumentContent(filename, ragBaseUrl);

    return new Response(JSON.stringify(content), {
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

// DELETE: Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const { searchParams } = new URL(request.url);
    const ragBaseUrl = searchParams.get('ragBaseUrl') || undefined;
    await deleteRAGDocument(filename, ragBaseUrl);

    return new Response(
      JSON.stringify({ message: 'ドキュメントを削除しました' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
