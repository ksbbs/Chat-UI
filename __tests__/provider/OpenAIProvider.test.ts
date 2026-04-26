import { describe, it, expect, vi } from 'vitest';

// Mock the DB and server action modules to prevent initialization errors
vi.mock('@/app/db', () => ({
  db: {
    query: {},
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/app/utils/mcpToolsServer', () => ({
  callMCPTool: vi.fn(),
}));

vi.mock('@/app/chat/actions/chat', () => ({
  syncMcpTools: vi.fn(),
}));

import ChatGPTApi from '@/app/provider/OpenAIProvider';

describe('ChatGPTApi', () => {
  const api = new ChatGPTApi('openai');

  describe('prepareMessage', () => {
    it('formats string content messages', () => {
      const result = api.prepareMessage([
        { role: 'user', content: 'Hello' },
      ]);
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('formats multi-part content with text', () => {
      const result = api.prepareMessage([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('role', 'user');
    });

    it('formats image content', () => {
      const result = api.prepareMessage([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image', data: 'data:image/png;base64,abc123', mimeType: 'image/png' },
          ],
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('formats file content as text', () => {
      const result = api.prepareMessage([
        {
          role: 'user',
          content: [
            { type: 'file', fileName: 'test.pdf', fileContent: 'file content here' },
          ],
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('handles mixed content parts', () => {
      const result = api.prepareMessage([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            { type: 'image', data: 'data:image/jpeg;base64,xyz', mimeType: 'image/jpeg' },
            { type: 'file', fileName: 'doc.txt', fileContent: 'readme' },
          ],
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('returns empty string for unknown content type', () => {
      const result = api.prepareMessage([
        { role: 'user', content: 123 as any },
      ]);
      expect(result).toEqual([{ role: 'user', content: '' }]);
    });
  });

  describe('cleanToolCallArgs', () => {
    it('extracts JSON from code block in arguments', () => {
      const toolCall = {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'get_weather',
          arguments: '```json\n{"city": "Beijing"}\n```',
        },
      };
      // Access private method via bracket notation
      const result = (api as any).cleanToolCallArgs(toolCall);
      expect(result.function.arguments).toBe('{"city": "Beijing"}');
    });

    it('extracts JSON object from arguments without code block', () => {
      const toolCall = {
        id: 'call_2',
        type: 'function' as const,
        function: {
          name: 'search',
          arguments: 'some text before {"query": "test"} some text after',
        },
      };
      const result = (api as any).cleanToolCallArgs(toolCall);
      expect(result.function.arguments).toBe('{"query": "test"}');
    });

    it('handles already valid JSON arguments', () => {
      const toolCall = {
        id: 'call_3',
        type: 'function' as const,
        function: {
          name: 'calculate',
          arguments: '{"expression": "1+1"}',
        },
      };
      const result = (api as any).cleanToolCallArgs(toolCall);
      expect(result.function.arguments).toBe('{"expression": "1+1"}');
    });

    it('handles function call format in code block', () => {
      const toolCall = {
        id: 'call_4',
        type: 'function' as const,
        function: {
          name: 'set_value',
          arguments: '```\nset_value(key=hello, value=world)\n```',
        },
      };
      const result = (api as any).cleanToolCallArgs(toolCall);
      // Should convert to JSON format
      const parsed = JSON.parse(result.function.arguments);
      expect(parsed).toHaveProperty('key', 'hello');
      expect(parsed).toHaveProperty('value', 'world');
    });
  });
});
