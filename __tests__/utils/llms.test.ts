import { describe, it, expect, vi } from 'vitest';

// Mock DB module before importing llms
vi.mock('@/app/db', () => ({
  db: {
    query: {
      llmSettingsTable: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { completeEndpoint } from '@/app/utils/llms';

describe('completeEndpoint', () => {
  describe('default endpoints (no inputUrl)', () => {
    it('returns OpenAI default endpoint', async () => {
      expect(await completeEndpoint('openai', 'openai')).toBe(
        'https://api.openai.com/v1/chat/completions'
      );
    });

    it('returns Claude default endpoint', async () => {
      expect(await completeEndpoint('claude', 'claude')).toBe(
        'https://api.anthropic.com/v1/messages'
      );
    });

    it('returns DeepSeek default endpoint', async () => {
      expect(await completeEndpoint('deepseek', 'openai')).toBe(
        'https://api.deepseek.com/v1/chat/completions'
      );
    });

    it('returns Gemini default endpoint', async () => {
      expect(await completeEndpoint('gemini', 'openai')).toBe(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      );
    });

    it('returns Qwen default endpoint', async () => {
      expect(await completeEndpoint('qwen', 'openai')).toBe(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
      );
    });

    it('returns Ollama default endpoint', async () => {
      expect(await completeEndpoint('ollama', 'openai')).toBe(
        'http://127.0.0.1:11434/v1/chat/completions'
      );
    });

    it('returns OpenRouter default endpoint', async () => {
      expect(await completeEndpoint('openrouter', 'openai')).toBe(
        'https://openrouter.ai/api/v1/chat/completions'
      );
    });

    it('returns undefined for unknown provider with no inputUrl', async () => {
      expect(await completeEndpoint('unknown_provider', 'openai')).toBeUndefined();
    });
  });

  describe('Claude URL completion', () => {
    it('passes through URL ending with /v1/messages', async () => {
      expect(await completeEndpoint('claude', 'claude', 'https://proxy.example.com/v1/messages'))
        .toBe('https://proxy.example.com/v1/messages');
    });

    it('appends /messages to URL ending with /v1', async () => {
      expect(await completeEndpoint('claude', 'claude', 'https://proxy.example.com/v1'))
        .toBe('https://proxy.example.com/v1/messages');
    });

    it('appends v1/messages to URL ending with /', async () => {
      expect(await completeEndpoint('claude', 'claude', 'https://proxy.example.com/'))
        .toBe('https://proxy.example.com/v1/messages');
    });

    it('appends /messages to URL with no trailing slash', async () => {
      expect(await completeEndpoint('claude', 'claude', 'https://proxy.example.com'))
        .toBe('https://proxy.example.com/messages');
    });
  });

  describe('OpenAI URL completion', () => {
    it('passes through URL ending with completions', async () => {
      expect(await completeEndpoint('openai', 'openai', 'https://api.example.com/v1/chat/completions'))
        .toBe('https://api.example.com/v1/chat/completions');
    });

    it('appends /chat/completions to URL ending with v1', async () => {
      expect(await completeEndpoint('openai', 'openai', 'https://api.example.com/v1'))
        .toBe('https://api.example.com/v1/chat/completions');
    });

    it('appends v1/chat/completions to URL ending with /', async () => {
      expect(await completeEndpoint('openai', 'openai', 'https://api.example.com/'))
        .toBe('https://api.example.com/v1/chat/completions');
    });

    it('appends /chat/completions to URL with no trailing slash', async () => {
      expect(await completeEndpoint('openai', 'openai', 'https://api.example.com'))
        .toBe('https://api.example.com/chat/completions');
    });
  });

  describe('OpenAI Response API completion', () => {
    it('passes through URL ending with /responses', async () => {
      expect(await completeEndpoint('openai', 'openai_response', 'https://api.example.com/v1/responses'))
        .toBe('https://api.example.com/v1/responses');
    });

    it('appends /responses to URL ending with /v1', async () => {
      expect(await completeEndpoint('openai', 'openai_response', 'https://api.example.com/v1'))
        .toBe('https://api.example.com/v1/responses');
    });
  });

  describe('null/undefined inputUrl handling', () => {
    it('returns default endpoint when inputUrl is null', async () => {
      expect(await completeEndpoint('openai', 'openai', null)).toBe(
        'https://api.openai.com/v1/chat/completions'
      );
    });

    it('returns default endpoint when inputUrl is "null" string', async () => {
      expect(await completeEndpoint('openai', 'openai', 'null')).toBe(
        'https://api.openai.com/v1/chat/completions'
      );
    });
  });
});
