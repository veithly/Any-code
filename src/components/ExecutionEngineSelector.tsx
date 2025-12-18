/**
 * ExecutionEngineSelector Component
 *
 * Allows users to switch between Claude Code, Codex, and Gemini CLI execution engines
 * with appropriate configuration options for each.
 */

import React, { useState } from 'react';
import { Settings, Zap, Check, Monitor, Terminal, Sparkles, Brain, Star, Cpu, Rocket, FlaskConical, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { relaunchApp } from '@/lib/updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { useEngineStatus } from '@/hooks/useEngineStatus';
import type { CodexExecutionMode } from '@/types/codex';
import { cn } from '@/lib/utils';

// ============================================================================
// Model Definitions
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isDefault?: boolean;
}

/**
 * Codex models (GPT-5.1 series, GPT-5.1-Codex series, GPT-5.2 series)
 * Updated: December 2025
 */
export const CODEX_MODELS: ModelInfo[] = [
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    description: '最强推理模型，适合复杂任务',
    icon: <Sparkles className="h-4 w-4 text-purple-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '最新旗舰模型（2025年12月）',
    icon: <Star className="h-4 w-4 text-yellow-500" />,
    isDefault: true,
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    description: '代码编写优化，速度与质量平衡',
    icon: <Rocket className="h-4 w-4 text-green-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    description: '专注代码生成的基础版本',
    icon: <Cpu className="h-4 w-4 text-blue-500" />,
    isDefault: false,
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: '通用大语言模型',
    icon: <Brain className="h-4 w-4 text-orange-500" />,
    isDefault: false,
  },
];

/**
 * Gemini models (Gemini 3 series only)
 * Updated: December 2025
 */
export const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    description: '最新最快模型（2025年12月17日）',
    icon: <Gauge className="h-4 w-4 text-yellow-500" />,
    isDefault: true,
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    description: '最强推理和编码能力',
    icon: <Sparkles className="h-4 w-4 text-blue-500" />,
    isDefault: false,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: '实验性预览版本',
    icon: <FlaskConical className="h-4 w-4 text-purple-500" />,
    isDefault: false,
  },
  {
    id: 'gemini-3-flash-thinking',
    name: 'Gemini 3 Flash Thinking',
    description: '带思考链的快速模型',
    icon: <Brain className="h-4 w-4 text-green-500" />,
    isDefault: false,
  },
];

// ============================================================================
// Type Definitions
// ============================================================================

export type ExecutionEngine = 'claude' | 'codex' | 'gemini';
export type CodexRuntimeMode = 'auto' | 'native' | 'wsl';

export interface ExecutionEngineConfig {
  engine: ExecutionEngine;
  // Codex-specific config
  codexMode?: CodexExecutionMode;
  codexModel?: string;
  codexApiKey?: string;
  // Gemini-specific config
  geminiModel?: string;
  geminiApprovalMode?: 'auto_edit' | 'yolo' | 'default';
}

interface CodexModeConfig {
  mode: CodexRuntimeMode;
  wslDistro: string | null;
  actualMode: 'native' | 'wsl';
  nativeAvailable: boolean;
  wslAvailable: boolean;
  availableDistros: string[];
}

// Gemini WSL mode configuration (similar to Codex)
export type GeminiRuntimeMode = 'auto' | 'native' | 'wsl';

interface GeminiWslModeConfig {
  mode: GeminiRuntimeMode;
  wslDistro: string | null;
  wslAvailable: boolean;
  availableDistros: string[];
  wslEnabled: boolean;
  wslGeminiPath: string | null;
  wslGeminiVersion: string | null;
  nativeAvailable: boolean;
}

interface ExecutionEngineSelectorProps {
  value: ExecutionEngineConfig;
  onChange: (config: ExecutionEngineConfig) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ExecutionEngineSelector: React.FC<ExecutionEngineSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // 使用全局缓存的引擎状态（包括模式配置）
  const {
    codexAvailable,
    codexVersion,
    geminiInstalled: geminiAvailable,
    geminiVersion,
    codexModeConfig: cachedCodexModeConfig,
    geminiWslModeConfig: cachedGeminiWslModeConfig,
  } = useEngineStatus();

  // 本地状态用于跟踪用户修改（保存后立即更新 UI）
  const [localCodexModeConfig, setLocalCodexModeConfig] = useState<CodexModeConfig | null>(null);
  const [localGeminiWslModeConfig, setLocalGeminiWslModeConfig] = useState<GeminiWslModeConfig | null>(null);

  // 使用本地修改的值，如果没有则使用缓存的值
  const codexModeConfig: CodexModeConfig | null = localCodexModeConfig || cachedCodexModeConfig || null;
  const geminiWslModeConfig: GeminiWslModeConfig | null = localGeminiWslModeConfig || cachedGeminiWslModeConfig || null;

  const handleCodexRuntimeModeChange = async (mode: CodexRuntimeMode) => {
    if (!codexModeConfig) return;

    setSavingConfig(true);
    try {
      await api.setCodexModeConfig(mode, codexModeConfig.wslDistro);
      setLocalCodexModeConfig({ ...codexModeConfig, mode });
      // 使用 Tauri 原生对话框询问用户是否重启
      const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
        title: '重启应用',
        kind: 'info',
        okLabel: '立即重启',
        cancelLabel: '稍后重启',
      });
      if (shouldRestart) {
        try {
          await relaunchApp();
        } catch (restartError) {
          console.error('[ExecutionEngineSelector] Failed to restart:', restartError);
          await message('配置已保存，但自动重启失败。请手动重启应用以使更改生效。', {
            title: '提示',
            kind: 'warning',
          });
        }
      }
    } catch (error) {
      console.error('[ExecutionEngineSelector] Failed to save Codex mode config:', error);
      await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), {
        title: '错误',
        kind: 'error',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleWslDistroChange = async (distro: string) => {
    if (!codexModeConfig) return;

    const newDistro = distro === '__default__' ? null : distro;
    setSavingConfig(true);
    try {
      await api.setCodexModeConfig(codexModeConfig.mode, newDistro);
      setLocalCodexModeConfig({ ...codexModeConfig, wslDistro: newDistro });
      // 使用 Tauri 原生对话框询问用户是否重启
      const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
        title: '重启应用',
        kind: 'info',
        okLabel: '立即重启',
        cancelLabel: '稍后重启',
      });
      if (shouldRestart) {
        try {
          await relaunchApp();
        } catch (restartError) {
          console.error('[ExecutionEngineSelector] Failed to restart:', restartError);
          await message('配置已保存，但自动重启失败。请手动重启应用以使更改生效。', {
            title: '提示',
            kind: 'warning',
          });
        }
      }
    } catch (error) {
      console.error('[ExecutionEngineSelector] Failed to save WSL distro:', error);
      await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), {
        title: '错误',
        kind: 'error',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGeminiRuntimeModeChange = async (mode: GeminiRuntimeMode) => {
    if (!geminiWslModeConfig) return;

    setSavingConfig(true);
    try {
      await api.setGeminiWslModeConfig(mode, geminiWslModeConfig.wslDistro);
      setLocalGeminiWslModeConfig({ ...geminiWslModeConfig, mode });
      // 使用 Tauri 原生对话框询问用户是否重启
      const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
        title: '重启应用',
        kind: 'info',
        okLabel: '立即重启',
        cancelLabel: '稍后重启',
      });
      if (shouldRestart) {
        try {
          await relaunchApp();
        } catch (restartError) {
          console.error('[ExecutionEngineSelector] Failed to restart:', restartError);
          await message('配置已保存，但自动重启失败。请手动重启应用以使更改生效。', {
            title: '提示',
            kind: 'warning',
          });
        }
      }
    } catch (error) {
      console.error('[ExecutionEngineSelector] Failed to save Gemini WSL mode config:', error);
      await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), {
        title: '错误',
        kind: 'error',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGeminiWslDistroChange = async (distro: string) => {
    if (!geminiWslModeConfig) return;

    const newDistro = distro === '__default__' ? null : distro;
    setSavingConfig(true);
    try {
      await api.setGeminiWslModeConfig(geminiWslModeConfig.mode, newDistro);
      setLocalGeminiWslModeConfig({ ...geminiWslModeConfig, wslDistro: newDistro });
      // 使用 Tauri 原生对话框询问用户是否重启
      const shouldRestart = await ask('配置已保存。是否立即重启应用以使更改生效？', {
        title: '重启应用',
        kind: 'info',
        okLabel: '立即重启',
        cancelLabel: '稍后重启',
      });
      if (shouldRestart) {
        try {
          await relaunchApp();
        } catch (restartError) {
          console.error('[ExecutionEngineSelector] Failed to restart:', restartError);
          await message('配置已保存，但自动重启失败。请手动重启应用以使更改生效。', {
            title: '提示',
            kind: 'warning',
          });
        }
      }
    } catch (error) {
      console.error('[ExecutionEngineSelector] Failed to save Gemini WSL distro:', error);
      await message('保存配置失败: ' + (error instanceof Error ? error.message : String(error)), {
        title: '错误',
        kind: 'error',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleEngineChange = (engine: ExecutionEngine) => {
    if (engine === 'codex' && !codexAvailable) {
      alert('Codex CLI 未安装或不可用。请先安装 Codex CLI。');
      return;
    }

    if (engine === 'gemini' && !geminiAvailable) {
      alert('Gemini CLI 未安装或不可用。请运行 npm install -g @google/gemini-cli 安装。');
      return;
    }

    onChange({
      ...value,
      engine,
    });
  };

  const handleCodexModeChange = (mode: CodexExecutionMode) => {
    onChange({
      ...value,
      codexMode: mode,
    });
  };

  const handleCodexModelChange = (model: string) => {
    onChange({
      ...value,
      codexModel: model,
    });
  };

  const handleGeminiModelChange = (model: string) => {
    onChange({
      ...value,
      geminiModel: model,
    });
  };

  const handleGeminiApprovalModeChange = (mode: 'auto_edit' | 'yolo' | 'default') => {
    onChange({
      ...value,
      geminiApprovalMode: mode,
    });
  };

  // Get display name for current engine
  const getEngineDisplayName = () => {
    switch (value.engine) {
      case 'claude':
        return 'Claude Code';
      case 'codex':
        return 'Codex';
      case 'gemini':
        return 'Gemini';
      default:
        return 'Claude Code';
    }
  };

  return (
    <Popover
      open={showSettings}
      onOpenChange={setShowSettings}
      trigger={
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={showSettings}
          className={`justify-between ${className}`}
        >
          <div className="flex items-center gap-2">
            {value.engine === 'gemini' ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>{getEngineDisplayName()}</span>
            {value.engine === 'codex' && value.codexMode && (
              <span className="text-xs text-muted-foreground">
                ({value.codexMode === 'read-only' ? '只读' : value.codexMode === 'full-auto' ? '编辑' : '完全访问'})
              </span>
            )}
            {value.engine === 'gemini' && value.geminiApprovalMode && (
              <span className="text-xs text-muted-foreground">
                ({value.geminiApprovalMode === 'yolo' ? 'YOLO' : value.geminiApprovalMode === 'auto_edit' ? '自动编辑' : '默认'})
              </span>
            )}
          </div>
          <Settings className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      }
      content={
        <div className="space-y-4 p-4">
          {/* Engine Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">执行引擎</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={value.engine === 'claude' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => handleEngineChange('claude')}
              >
                <Check className={`mr-2 h-4 w-4 ${value.engine === 'claude' ? 'opacity-100' : 'opacity-0'}`} />
                Claude
              </Button>
              <Button
                variant={value.engine === 'codex' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => handleEngineChange('codex')}
                disabled={!codexAvailable}
              >
                <Check className={`mr-2 h-4 w-4 ${value.engine === 'codex' ? 'opacity-100' : 'opacity-0'}`} />
                Codex
              </Button>
              <Button
                variant={value.engine === 'gemini' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => handleEngineChange('gemini')}
                disabled={!geminiAvailable}
              >
                <Check className={`mr-2 h-4 w-4 ${value.engine === 'gemini' ? 'opacity-100' : 'opacity-0'}`} />
                Gemini
              </Button>
            </div>
          </div>

          {/* Codex-specific settings */}
          {value.engine === 'codex' && (
            <>
              <div className="h-px bg-border" />

              {/* Execution Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">执行模式</Label>
                <Select
                  value={value.codexMode || 'read-only'}
                  onValueChange={(v) => handleCodexModeChange(v as CodexExecutionMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read-only">
                      <div>
                        <div className="font-medium">只读模式</div>
                        <div className="text-xs text-muted-foreground">安全模式，只能读取文件</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="full-auto">
                      <div>
                        <div className="font-medium">编辑模式</div>
                        <div className="text-xs text-muted-foreground">允许编辑文件</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="danger-full-access">
                      <div>
                        <div className="font-medium text-destructive">完全访问模式</div>
                        <div className="text-xs text-muted-foreground">⚠️ 允许网络访问</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Model - Claude-style Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">模型</Label>
                <div className="space-y-1">
                  {CODEX_MODELS.map((model) => {
                    const isSelected = value.codexModel === model.id ||
                      (!value.codexModel && model.isDefault);
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleCodexModelChange(model.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-2.5 rounded-md transition-colors text-left group",
                          "hover:bg-accent border border-transparent",
                          isSelected && "bg-accent border-primary/20"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">{model.icon}</div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="truncate">{model.name}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                            {model.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                                推荐
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {model.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="rounded-md border p-2 bg-muted/50">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${codexAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{codexAvailable ? '已安装' : '未安装'}</span>
                  {codexVersion && <span className="text-muted-foreground">• {codexVersion}</span>}
                </div>
              </div>

              {/* WSL Mode Configuration (Windows only) */}
              {codexModeConfig && (codexModeConfig.nativeAvailable || codexModeConfig.wslAvailable) && (
                <>
                  <div className="h-px bg-border" />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      运行环境
                    </Label>
                    <Select
                      value={codexModeConfig.mode}
                      onValueChange={(v) => handleCodexRuntimeModeChange(v as CodexRuntimeMode)}
                      disabled={savingConfig}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div>
                            <div className="font-medium">自动检测</div>
                            <div className="text-xs text-muted-foreground">原生优先，WSL 后备</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="native" disabled={!codexModeConfig.nativeAvailable}>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-3 w-3" />
                            <div>
                              <div className="font-medium">Windows 原生</div>
                              <div className="text-xs text-muted-foreground">
                                {codexModeConfig.nativeAvailable ? '使用 Windows 版 Codex' : '未安装'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="wsl" disabled={!codexModeConfig.wslAvailable}>
                          <div className="flex items-center gap-2">
                            <Terminal className="h-3 w-3" />
                            <div>
                              <div className="font-medium">WSL</div>
                              <div className="text-xs text-muted-foreground">
                                {codexModeConfig.wslAvailable ? '使用 WSL 中的 Codex' : '未安装'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* WSL Distro Selection */}
                  {codexModeConfig.mode === 'wsl' && codexModeConfig.availableDistros.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">WSL 发行版</Label>
                      <Select
                        value={codexModeConfig.wslDistro || '__default__'}
                        onValueChange={handleWslDistroChange}
                        disabled={savingConfig}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">
                            <div className="text-muted-foreground">默认（自动选择）</div>
                          </SelectItem>
                          {codexModeConfig.availableDistros.map((distro) => (
                            <SelectItem key={distro} value={distro}>
                              {distro}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Current Runtime Status */}
                  <div className="rounded-md border p-2 bg-muted/30 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">当前运行环境:</span>
                      <span className="font-medium">
                        {codexModeConfig.actualMode === 'wsl' ? (
                          <span className="flex items-center gap-1">
                            <Terminal className="h-3 w-3" />
                            WSL
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            Windows 原生
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Gemini-specific settings */}
          {value.engine === 'gemini' && (
            <>
              <div className="h-px bg-border" />

              {/* Model Selection - Claude-style Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">模型</Label>
                <div className="space-y-1">
                  {GEMINI_MODELS.map((model) => {
                    const isSelected = value.geminiModel === model.id ||
                      (!value.geminiModel && model.isDefault);
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleGeminiModelChange(model.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-2.5 rounded-md transition-colors text-left group",
                          "hover:bg-accent border border-transparent",
                          isSelected && "bg-accent border-primary/20"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">{model.icon}</div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="truncate">{model.name}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                            {model.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                                推荐
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {model.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Approval Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">审批模式</Label>
                <Select
                  value={value.geminiApprovalMode || 'auto_edit'}
                  onValueChange={(v) => handleGeminiApprovalModeChange(v as 'auto_edit' | 'yolo' | 'default')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      <div>
                        <div className="font-medium">默认</div>
                        <div className="text-xs text-muted-foreground">每次操作需确认</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="auto_edit">
                      <div>
                        <div className="font-medium">自动编辑</div>
                        <div className="text-xs text-muted-foreground">自动批准文件编辑</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="yolo">
                      <div>
                        <div className="font-medium text-destructive">YOLO 模式</div>
                        <div className="text-xs text-muted-foreground">⚠️ 自动批准所有操作</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="rounded-md border p-2 bg-muted/50">
                <div className="flex items-center gap-2 text-xs">
                  <Sparkles className="h-3 w-3" />
                  <div className={`h-2 w-2 rounded-full ${geminiAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{geminiAvailable ? '已安装' : '未安装'}</span>
                  {geminiVersion && <span className="text-muted-foreground">• {geminiVersion}</span>}
                </div>
              </div>

              {/* WSL Mode Configuration (Windows only) */}
              {geminiWslModeConfig && (geminiWslModeConfig.nativeAvailable || geminiWslModeConfig.wslAvailable) && (
                <>
                  <div className="h-px bg-border" />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      运行环境
                    </Label>
                    <Select
                      value={geminiWslModeConfig.mode}
                      onValueChange={(v) => handleGeminiRuntimeModeChange(v as GeminiRuntimeMode)}
                      disabled={savingConfig}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div>
                            <div className="font-medium">自动检测</div>
                            <div className="text-xs text-muted-foreground">原生优先，WSL 后备</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="native" disabled={!geminiWslModeConfig.nativeAvailable}>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-3 w-3" />
                            <div>
                              <div className="font-medium">Windows 原生</div>
                              <div className="text-xs text-muted-foreground">
                                {geminiWslModeConfig.nativeAvailable ? '使用 Windows 版 Gemini' : '未安装'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="wsl" disabled={!geminiWslModeConfig.wslAvailable}>
                          <div className="flex items-center gap-2">
                            <Terminal className="h-3 w-3" />
                            <div>
                              <div className="font-medium">WSL</div>
                              <div className="text-xs text-muted-foreground">
                                {geminiWslModeConfig.wslAvailable ? '使用 WSL 中的 Gemini' : '未安装'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* WSL Distro Selection */}
                  {geminiWslModeConfig.mode === 'wsl' && geminiWslModeConfig.availableDistros.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">WSL 发行版</Label>
                      <Select
                        value={geminiWslModeConfig.wslDistro || '__default__'}
                        onValueChange={handleGeminiWslDistroChange}
                        disabled={savingConfig}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">
                            <div className="text-muted-foreground">默认（自动选择）</div>
                          </SelectItem>
                          {geminiWslModeConfig.availableDistros.map((distro) => (
                            <SelectItem key={distro} value={distro}>
                              {distro}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Current Runtime Status */}
                  <div className="rounded-md border p-2 bg-muted/30 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">当前运行环境:</span>
                      <span className="font-medium">
                        {geminiWslModeConfig.wslEnabled ? (
                          <span className="flex items-center gap-1">
                            <Terminal className="h-3 w-3" />
                            WSL
                            {geminiWslModeConfig.wslGeminiVersion && (
                              <span className="text-muted-foreground ml-1">({geminiWslModeConfig.wslGeminiVersion})</span>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            Windows 原生
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Claude-specific settings */}
          {value.engine === 'claude' && (
            <div className="text-sm text-muted-foreground">
              <p>Claude Code 配置请前往设置页面。</p>
            </div>
          )}
        </div>
      }
      className="w-96"
      align="start"
      side="top"
    />
  );
};

export default ExecutionEngineSelector;
