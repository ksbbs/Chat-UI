import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      // PDF parsing
      const pdf = (await import('pdf-parse')).default;
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      // Word document parsing
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      // Plain text or markdown - read directly
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Limit extracted text size to prevent overly large contexts
    const MAX_TEXT_LENGTH = 50000;
    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH) + '\n\n[Content truncated due to size limit]';
    }

    return NextResponse.json({
      fileName: file.name,
      fileContent: extractedText,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}