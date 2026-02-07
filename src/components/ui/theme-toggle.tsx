import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ThemeToggleProps {
  /**
   * Display mode: icon-only or with-text
   */
  variant?: 'icon-only' | 'with-text';
  /**
   * Button size
   */
  size?: 'sm' | 'default' | 'lg';
  /**
   * Custom class name
   */
  className?: string;
}

const themeModeLabels: Record<string, { zh: string; en: string }> = {
  light: { zh: '浅色', en: 'Light' },
  dark: { zh: '深色', en: 'Dark' },
  system: { zh: '跟随系统', en: 'System' },
};

const nextModeTooltips: Record<string, string> = {
  light: '切换到深色主题',
  dark: '切换到跟随系统',
  system: '切换到浅色主题',
};

/**
 * Theme toggle component
 * Supports light/dark/system theme cycling
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon-only',
  size = 'sm',
  className = '',
}) => {
  const { themeMode, toggleTheme } = useTheme();

  const renderIcon = () => {
    switch (themeMode) {
      case 'light':
        return <Sun className="h-3.5 w-3.5" strokeWidth={2} />;
      case 'dark':
        return <Moon className="h-3.5 w-3.5" strokeWidth={2} />;
      case 'system':
        return <Monitor className="h-3.5 w-3.5" strokeWidth={2} />;
      default:
        return <Sun className="h-3.5 w-3.5" strokeWidth={2} />;
    }
  };

  const button = (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={cn("transition-all duration-200 hover:scale-105 rounded-full", className)}
    >
      {renderIcon()}
      {variant === 'with-text' && <span className="ml-1.5">{themeModeLabels[themeMode]?.zh ?? themeMode}</span>}
    </Button>
  );

  // Show tooltip in icon-only mode
  if (variant === 'icon-only') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{nextModeTooltips[themeMode] ?? '切换主题'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
