/**
 * usePluginSlashCommands Hook
 *
 * Loads plugin skills and commands as slash commands for the / menu.
 * Integrates with the backend's extension scanning system via:
 * - list_plugins: returns installed plugins with their component lists
 * - list_agent_skills: returns standalone skill files from .claude/skills/
 *
 * These are converted to SlashCommand format with 'plugin' category
 * so they appear in the slash command menu alongside built-in and custom commands.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SlashCommand } from '../slashCommands';

// ============================================================================
// Backend type mappings (matching Rust structs with camelCase serde rename)
// ============================================================================

/** Matches PluginComponentItem in extensions.rs */
interface PluginComponentItem {
  name: string;
  description: string | null;
}

/** Matches PluginComponents in extensions.rs */
interface PluginComponents {
  commands: number;
  agents: number;
  skills: number;
  hooks: number;
  mcpServers: number;
  commandList: PluginComponentItem[];
  skillList: PluginComponentItem[];
  agentList: PluginComponentItem[];
}

/** Matches PluginInfo in extensions.rs */
interface PluginInfo {
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  marketplace: string | null;
  path: string;
  enabled: boolean;
  components: PluginComponents;
}

/** Matches AgentSkillFile in extensions.rs */
interface AgentSkillFile {
  name: string;
  path: string;
  scope: string;
  description: string | null;
  content: string;
}

// ============================================================================
// Hook
// ============================================================================

interface UsePluginSlashCommandsOptions {
  /** Project path for project-scoped plugins/skills */
  projectPath?: string;
  /** Whether to enable loading (default: true) */
  enabled?: boolean;
}

interface UsePluginSlashCommandsReturn {
  /** Plugin-derived slash commands */
  pluginCommands: SlashCommand[];
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Manually refresh the plugin commands list */
  refresh: () => Promise<void>;
}

/**
 * Hook to load plugin skills and commands as slash commands for the / menu.
 *
 * Fetches data from two backend commands:
 * 1. list_plugins - installed plugins with their commands/skills/agents
 * 2. list_agent_skills - standalone SKILL.md files from .claude/skills/
 *
 * Converts them into SlashCommand[] with category 'plugin' for display
 * in the slash command menu.
 */
export function usePluginSlashCommands({
  projectPath,
  enabled = true,
}: UsePluginSlashCommandsOptions): UsePluginSlashCommandsReturn {
  const [pluginCommands, setPluginCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadPluginCommands = useCallback(async () => {
    if (!enabled) {
      setPluginCommands([]);
      return;
    }

    setIsLoading(true);
    try {
      // Load both plugin components and standalone skills in parallel.
      // Each call catches errors independently to ensure partial data is still usable.
      const [plugins, skills] = await Promise.all([
        invoke<PluginInfo[]>('list_plugins', {
          projectPath: projectPath || null,
        }).catch((err) => {
          console.debug('[PluginSlashCommands] list_plugins unavailable:', err);
          return [] as PluginInfo[];
        }),
        invoke<AgentSkillFile[]>('list_agent_skills', {
          projectPath: projectPath || null,
        }).catch((err) => {
          console.debug('[PluginSlashCommands] list_agent_skills unavailable:', err);
          return [] as AgentSkillFile[];
        }),
      ]);

      const commands: SlashCommand[] = [];
      // Track names to avoid duplicates between plugin skills and standalone skills
      const addedNames = new Set<string>();

      // Process installed plugins (only enabled ones)
      for (const plugin of plugins) {
        if (!plugin.enabled) {
          continue;
        }

        // Add plugin skills as slash commands (format: pluginName:skillName)
        if (plugin.components?.skillList) {
          for (const skill of plugin.components.skillList) {
            const commandName = `${plugin.name}:${skill.name}`;
            commands.push({
              name: commandName,
              description: skill.description || `Plugin skill from ${plugin.name}`,
              source: 'user',
              category: 'plugin',
              supportsNonInteractive: true,
            });
            addedNames.add(commandName);
          }
        }

        // Add plugin commands as slash commands (format: pluginName:commandName)
        if (plugin.components?.commandList) {
          for (const cmd of plugin.components.commandList) {
            const commandName = `${plugin.name}:${cmd.name}`;
            commands.push({
              name: commandName,
              description: cmd.description || `Plugin command from ${plugin.name}`,
              source: 'user',
              category: 'plugin',
              supportsNonInteractive: true,
            });
            addedNames.add(commandName);
          }
        }
      }

      // Add standalone skills from .claude/skills/ directories
      for (const skill of skills) {
        // Avoid duplicates: a standalone skill might share a name with a plugin skill
        if (addedNames.has(skill.name)) {
          continue;
        }

        commands.push({
          name: skill.name,
          description: skill.description || `Skill: ${skill.name}`,
          source: skill.scope === 'project' ? 'project' : 'user',
          category: 'plugin',
          supportsNonInteractive: true,
        });
        addedNames.add(skill.name);
      }

      setPluginCommands(commands);
    } catch (error) {
      console.error('[PluginSlashCommands] Failed to load plugin commands:', error);
      setPluginCommands([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, enabled]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadPluginCommands();
  }, [loadPluginCommands]);

  return {
    pluginCommands,
    isLoading,
    refresh: loadPluginCommands,
  };
}
