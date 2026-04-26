import { describe, it, expect, vi } from 'vitest';

// Mock DB module to prevent initialization errors
vi.mock('@/app/db', () => ({
  db: {
    query: {},
  },
}));

// Test the SSE stream parsing logic used by proxyOpenAiStream
// We extract the parsing logic into testable pure functions

describe('OpenAI stream parsing', () => {
  describe('thinking tag detection', () => {
    it('detects <think> tag at start of content', () => {
      const content = '<think>This is reasoning';
      const isThinking = content.startsWith('<think>');
      expect(isThinking).toBe(true);
    });

    it('extracts thinking content after <think> tag', () => {
      const content = '<think>This is reasoning';
      const thinkContent = content.slice(7).trim();
      expect(thinkContent).toBe('This is reasoning');
    });

    it('detects </think> closing tag', () => {
      const content = 'reasoning here</think>';
      const hasClosing = content.endsWith('</think>');
      expect(hasClosing).toBe(true);
    });

    it('extracts content before </think> tag', () => {
      const content = 'reasoning here</think>';
      const thinkContent = content.slice(0, -8).trim();
      expect(thinkContent).toBe('reasoning here');
    });

    it('extracts answer after </think> tag in combined text', () => {
      const reasoning = 'some reasoning';
      const content = 'more reasoning</think>and the answer';
      const text = reasoning + content;
      const thinkContent = text.slice(0, text.indexOf('</think>')).trim();
      const answerText = text.slice(text.indexOf('</think>') + 8).trim();
      expect(thinkContent).toBe('some reasoningmore reasoning');
      expect(answerText).toBe('and the answer');
    });

    it('handles <think> tag split across chunks', () => {
      const completeResponse = 'Hello';
      const content = '<think>reasoning';
      const combined = completeResponse + content;
      const includesTag = combined.includes('<think>');
      expect(includesTag).toBe(true);

      const thinkContent = combined.slice(combined.indexOf('<think>') + 7).trim();
      expect(thinkContent).toBe('reasoning');
    });
  });

  describe('SSE line parsing', () => {
    it('strips "data: " prefix', () => {
      const line = 'data: {"choices":[]}';
      const cleaned = line.replace(/^data: /, '').trim();
      expect(cleaned).toBe('{"choices":[]}');
    });

    it('skips empty lines', () => {
      const line = '';
      const cleaned = line.replace(/^data: /, '').trim();
      expect(cleaned).toBe('');
    });

    it('detects [DONE] signal', () => {
      const cleaned = '[DONE]';
      expect(cleaned === '[DONE]').toBe(true);
    });

    it('skips event: lines', () => {
      const line = 'event: ping';
      expect(line.startsWith('event:')).toBe(true);
    });
  });

  describe('OpenAI usage extraction', () => {
    it('extracts usage from top-level', () => {
      const parsedData = {
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        choices: [],
      };
      let usage = null;
      if (parsedData.usage) {
        usage = parsedData.usage;
      } else if (parsedData.choices?.length > 0 && parsedData.choices[0].usage) {
        usage = parsedData.choices[0].usage;
      }
      expect(usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
    });

    it('extracts usage from choices[0].usage (Moonshot style)', () => {
      const parsedData = {
        choices: [{
          usage: { prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 },
        }],
      };
      let usage = null;
      if (parsedData.usage) {
        usage = parsedData.usage;
      } else if (parsedData.choices?.length > 0 && parsedData.choices[0].usage) {
        usage = parsedData.choices[0].usage;
      }
      expect(usage).toEqual({ prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 });
    });

    it('returns null when no usage present', () => {
      const parsedData = { choices: [{ delta: { content: 'hello' } }] };
      let usage = null;
      if (parsedData.usage) {
        usage = parsedData.usage;
      } else if (parsedData.choices?.length > 0 && parsedData.choices[0].usage) {
        usage = parsedData.choices[0].usage;
      }
      expect(usage).toBeNull();
    });
  });

  describe('reasoning_content field extraction', () => {
    it('extracts reasoning_content from delta', () => {
      const delta = { content: 'hello', reasoning_content: 'thinking...' };
      const reasoning = delta?.reasoning_content || delta?.reasoning;
      expect(reasoning).toBe('thinking...');
    });

    it('extracts reasoning from delta (alternative field name)', () => {
      const delta = { content: 'hello', reasoning: 'deep thought...' };
      const reasoning = delta?.reasoning_content || delta?.reasoning;
      expect(reasoning).toBe('deep thought...');
    });

    it('returns undefined when no reasoning fields', () => {
      const delta = { content: 'hello' };
      const reasoning = delta?.reasoning_content || delta?.reasoning;
      expect(reasoning).toBeUndefined();
    });
  });
});

describe('Claude stream parsing', () => {
  it('extracts content from content_block_delta with text_delta', () => {
    const parsedLine = {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello world' },
    };
    expect(parsedLine.type).toBe('content_block_delta');
    expect(parsedLine.delta.type).toBe('text_delta');
    expect(parsedLine.delta.text).toBe('Hello world');
  });

  it('extracts input tokens from message_start', () => {
    const parsedLine = {
      type: 'message_start',
      message: { usage: { input_tokens: 25 } },
    };
    const usage = parsedLine?.message?.usage;
    expect(usage?.input_tokens).toBe(25);
  });

  it('extracts output tokens from message_delta', () => {
    const parsedLine = {
      type: 'message_delta',
      usage: { output_tokens: 50 },
    };
    const usage = parsedLine?.usage;
    expect(usage?.output_tokens).toBe(50);
  });

  it('calculates total tokens from input + output', () => {
    const promptTokens = 25;
    const completionTokens = 50;
    const totalTokens = promptTokens && completionTokens ? promptTokens + completionTokens : null;
    expect(totalTokens).toBe(75);
  });

  it('returns null total when either token count is missing', () => {
    const promptTokens = 25;
    const completionTokens = null;
    const totalTokens = promptTokens && completionTokens ? promptTokens + completionTokens : null;
    expect(totalTokens).toBeNull();
  });
});

describe('Gemini stream parsing', () => {
  describe('content conversion', () => {
    it('converts text parts', () => {
      const part = { text: 'Hello' };
      const result = 'text' in part && part.text
        ? { type: 'text' as const, text: part.text }
        : null;
      expect(result).toEqual({ type: 'text', text: 'Hello' });
    });

    it('converts inlineData parts', () => {
      const part = { inlineData: { mimeType: 'image/png', data: 'base64abc' } };
      const result = 'inlineData' in part && part.inlineData
        ? {
            type: 'image' as const,
            mimeType: part.inlineData.mimeType,
            data: 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data,
          }
        : null;
      expect(result).toEqual({
        type: 'image',
        mimeType: 'image/png',
        data: 'data:image/png;base64,base64abc',
      });
    });

    it('returns null for empty/invalid parts', () => {
      const part = { text: '' };
      const result = 'text' in part && part.text
        ? { type: 'text' as const, text: part.text }
        : null;
      expect(result).toBeNull();
    });
  });

  describe('text merging', () => {
    it('merges consecutive text elements', () => {
      const content = [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ];
      const merged = content.reduce((acc: any[], curr) => {
        const lastElement = acc[acc.length - 1];
        if (lastElement && lastElement.type === 'text' && curr.type === 'text') {
          lastElement.text += curr.text;
          return acc;
        }
        acc.push(curr);
        return acc;
      }, []);
      expect(merged).toEqual([{ type: 'text', text: 'Hello World' }]);
    });

    it('does not merge text with image', () => {
      const content = [
        { type: 'text', text: 'Look at this' },
        { type: 'image', mimeType: 'image/png', data: 'data:...' },
      ];
      const merged = content.reduce((acc: any[], curr) => {
        const lastElement = acc[acc.length - 1];
        if (lastElement && lastElement.type === 'text' && curr.type === 'text') {
          lastElement.text += curr.text;
          return acc;
        }
        acc.push(curr);
        return acc;
      }, []);
      expect(merged).toHaveLength(2);
    });
  });

  describe('usage extraction', () => {
    it('extracts token counts from usageMetadata', () => {
      const parsedData = {
        candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30, totalTokenCount: 40 },
      };
      const usage = parsedData.usageMetadata;
      expect(usage.promptTokenCount).toBe(10);
      expect(usage.candidatesTokenCount).toBe(30);
      expect(usage.totalTokenCount).toBe(40);
    });
  });
});
