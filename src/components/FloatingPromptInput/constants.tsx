import { Zap, Brain, Sparkles } from "lucide-react";
import { ModelConfig, ThinkingModeConfig } from "./types";
import { getCachedModelNames } from "@/lib/modelNameParser";

/**
 * Default model display names (used when no cache is available).
 * Intentionally version-less so they never go stale.
 */
const DEFAULT_MODEL_NAMES: Record<string, string> = {
  sonnet: "Claude Sonnet",
  opus: "Claude Opus",
};

/**
 * Get available models with dynamically updated display names.
 * Reads cached model names from localStorage (populated by stream init messages).
 * Falls back to version-less defaults if no cache exists yet.
 */
export function getModels(): ModelConfig[] {
  const cached = getCachedModelNames();
  const sonnetName = cached["sonnet"] || DEFAULT_MODEL_NAMES.sonnet;
  const opusName = cached["opus"] || DEFAULT_MODEL_NAMES.opus;
  const sonnet1mName = cached["sonnet"]
    ? `${cached["sonnet"]} 1M`
    : `${DEFAULT_MODEL_NAMES.sonnet} 1M`;

  return [
    {
      id: "sonnet",
      name: sonnetName,
      description: "Faster, efficient for most tasks",
      icon: <Zap className="h-4 w-4" />
    },
    {
      id: "sonnet1m",
      name: sonnet1mName,
      description: "Sonnet with 1 million token context",
      icon: <Brain className="h-4 w-4" />
    },
    {
      id: "opus",
      name: opusName,
      description: "Latest model with enhanced coding & reasoning capabilities",
      icon: <Sparkles className="h-4 w-4" />
    }
  ];
}

/**
 * Static model list for backward compatibility.
 * Prefer using getModels() for dynamic names.
 */
export const MODELS: ModelConfig[] = getModels();

/**
 * Thinking modes configuration
 * Simplified to on/off toggle (conforming to official Claude Code standard)
 * Default tokens when enabled: 31999 (balanced for most use cases)
 * 
 * Note: Names and descriptions are translation keys that will be resolved at runtime
 */
export const THINKING_MODES: ThinkingModeConfig[] = [
  {
    id: "off",
    name: "promptInput.thinkingModeOff",
    description: "promptInput.normalSpeed",
    level: 0,
    tokens: undefined // No extended thinking
  },
  {
    id: "on",
    name: "promptInput.thinkingModeOn",
    description: "promptInput.deepThinking",
    level: 1,
    tokens: 31999 // Default thinking tokens
  }
];

/**
 * Default thinking tokens when enabled
 * Can be adjusted via environment variable MAX_THINKING_TOKENS
 */
export const DEFAULT_THINKING_TOKENS = 31999;
