/**
 * Интерфейс AI-провайдера. Приложение зависит только от него,
 * поэтому смена модели или поставщика — это новый файл рядом, а не правка экранов.
 */

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface AIMessageInput {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AIRequest {
  system: string;
  messages: AIMessageInput[];
  tools?: AIToolDefinition[];
  maxTokens?: number;
}

export interface AIResponse {
  content: ContentBlock[];
  stopReason: string | null;
  model: string | null;
}

export interface AIProvider {
  readonly id: string;
  readonly capabilities: { tools: boolean; streaming: boolean };
  complete(request: AIRequest): Promise<AIResponse>;
}

export class AIError extends Error {
  constructor(message: string, readonly kind: 'offline' | 'not_configured' | 'server' | 'unknown') {
    super(message);
  }
}
