declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: string | null;
    version: string;
    text: string;
  }

  function pdf(data: Buffer): Promise<PDFData>;
  export default pdf;
}

declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(options: { buffer: Buffer }): Promise<ExtractResult>;
  export function convertToHtml(options: { buffer: Buffer }): Promise<{ value: string; messages: any[] }>;
}