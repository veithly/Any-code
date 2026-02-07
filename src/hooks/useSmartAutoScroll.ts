/**
 * 智能自动滚动 Hook
 *
 * 从 ClaudeCodeSession 提取（原 166-170 状态，305-435 逻辑）
 * 提供智能滚动管理：用户手动滚动检测、自动滚动到底部、流式输出滚动
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface SmartAutoScrollConfig {
  /** 可显示的消息列表（用于触发滚动） */
  displayableMessages: ClaudeStreamMessage[];
  /** 是否正在加载（流式输出时） */
  isLoading: boolean;
}

/**
 * 计算消息的内容哈希，用于检测内容变化
 */
function getLastMessageContentHash(messages: ClaudeStreamMessage[]): string {
  if (messages.length === 0) return '';
  const lastMsg = messages[messages.length - 1];
  // 简单地使用内容长度和类型作为哈希
  const contentLength = JSON.stringify(lastMsg.message?.content || '').length;
  return `${messages.length}-${lastMsg.type}-${contentLength}`;
}

interface SmartAutoScrollReturn {
  /** 滚动容器 ref */
  parentRef: React.RefObject<HTMLDivElement>;
  /** 用户是否手动滚动离开底部 */
  userScrolled: boolean;
  /** 设置用户滚动状态 */
  setUserScrolled: (scrolled: boolean) => void;
  /** 设置自动滚动状态 */
  setShouldAutoScroll: (should: boolean) => void;
}

/**
 * 智能自动滚动 Hook
 *
 * @param config - 配置对象
 * @returns 滚动管理对象
 *
 * @example
 * const { parentRef, userScrolled, setUserScrolled, shouldAutoScroll, setShouldAutoScroll } =
 *   useSmartAutoScroll({
 *     displayableMessages,
 *     isLoading
 *   });
 */
export function useSmartAutoScroll(config: SmartAutoScrollConfig): SmartAutoScrollReturn {
  const { displayableMessages, isLoading } = config;

  // Scroll state
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const lastScrollPositionRef = useRef(0);
  const isAutoScrollingRef = useRef(false); // Track if scroll was initiated by code
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timer for resetting auto-scroll flag
  const prevMessageCountRef = useRef(0); // Track previous message count for new message detection

  // 计算最后一条消息的内容哈希，用于检测内容变化
  const lastMessageHash = useMemo(
    () => getLastMessageContentHash(displayableMessages),
    [displayableMessages]
  );

  // Helper to perform auto-scroll safely
  const performAutoScroll = (behavior: ScrollBehavior = 'smooth') => {
    if (parentRef.current) {
      const scrollElement = parentRef.current;
      // Check if we actually need to scroll to avoid unnecessary events
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const targetScrollTop = scrollHeight - clientHeight;

      if (Math.abs(scrollTop - targetScrollTop) > 1) { // Small tolerance
        // Set the flag and use a timeout to reset it, avoiding race conditions
        // where a single scrollTo triggers multiple scroll events
        isAutoScrollingRef.current = true;
        if (autoScrollTimerRef.current) {
          clearTimeout(autoScrollTimerRef.current);
        }
        // Use longer timeout for smooth scrolling to cover the animation duration (~300ms),
        // preventing false "user scrolled" detections from animation-triggered scroll events.
        // Use shorter timeout for instant scrolling to allow quick user scroll detection.
        const flagTimeout = behavior === 'smooth' ? 300 : 80;
        autoScrollTimerRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false;
          autoScrollTimerRef.current = null;
        }, flagTimeout);

        scrollElement.scrollTo({
          top: targetScrollTop,
          behavior
        });
      }
    }
  };

  // Smart scroll detection - detect when user manually scrolls
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      // 1. Check if this scroll event was triggered by our auto-scroll
      // The flag is now reset via timeout, so all events within the timeout window are ignored
      if (isAutoScrollingRef.current) {
        lastScrollPositionRef.current = scrollElement.scrollTop;
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollElement;

      // 2. Calculate distance from bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Use a forgiving threshold (150px) to account for virtualizer measurement errors
      const isAtBottom = distanceFromBottom <= 150;

      // 3. Determine user intent
      // If user is not at bottom, they are viewing history -> Stop auto scroll
      if (!isAtBottom) {
        setUserScrolled(true);
        setShouldAutoScroll(false);
      } else {
        // User is at bottom (or scrolled back to bottom) -> Resume auto scroll
        setUserScrolled(false);
        setShouldAutoScroll(true);
      }

      lastScrollPositionRef.current = scrollTop;
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, []); // Empty deps - event listener only needs to be registered once

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, []);

  // Track message count changes and auto-enable scroll when new messages appear
  useEffect(() => {
    const currentCount = displayableMessages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = currentCount;

    // When new messages arrive (count increased) and we were near the bottom, re-enable auto-scroll
    if (currentCount > prevCount && prevCount > 0) {
      if (parentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        // If user was within a generous range of the bottom, re-enable auto-scroll
        if (distanceFromBottom <= 300) {
          setUserScrolled(false);
          setShouldAutoScroll(true);
        }
      }
    }
  }, [displayableMessages.length]);

  // Smart auto-scroll for new messages (initial load or update)
  // Uses lastMessageHash instead of displayableMessages.length to ensure
  // content changes during streaming also trigger scrolling
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        // Use rAF to ensure scroll happens after DOM updates are painted
        requestAnimationFrame(() => performAutoScroll());
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [lastMessageHash, shouldAutoScroll, userScrolled]);

  // Enhanced streaming scroll - use requestAnimationFrame for smoother
  // rendering-synced scrolling instead of raw setInterval.
  // rAF ensures scroll operations align with the browser's paint cycle,
  // reducing jank and improving coordination with the virtualizer.
  useEffect(() => {
    if (isLoading && shouldAutoScroll && !userScrolled) {
      // Immediate scroll on update
      performAutoScroll('auto');

      // rAF-based loop throttled to ~100ms for rendering-synced scroll updates
      let rafId: number;
      let lastScrollTime = 0;

      const tick = (timestamp: number) => {
        if (timestamp - lastScrollTime >= 100) {
          performAutoScroll('auto');
          lastScrollTime = timestamp;
        }
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(rafId);
    }
  }, [isLoading, shouldAutoScroll, userScrolled]);

  // 当消息内容变化时触发额外滚动（确保流式输出时跟踪最新内容）
  // 进入历史会话/初次渲染时，虚拟列表的测量会在短时间内不断修正高度，导致首次滚动不到真正的底部。
  // 在非流式状态下提供一个短暂的"粘底"窗口，确保最终停在最新消息处。
  useEffect(() => {
    if (isLoading) return;
    if (!shouldAutoScroll || userScrolled || displayableMessages.length === 0) return;

    let ticks = 0;
    const intervalId = setInterval(() => {
      ticks += 1;
      // Use rAF to sync scroll with the rendering cycle, ensuring the
      // virtualizer's height re-measurements are applied before scrolling
      requestAnimationFrame(() => performAutoScroll('auto'));
      if (ticks >= 8) {
        clearInterval(intervalId);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [lastMessageHash, isLoading, shouldAutoScroll, userScrolled, displayableMessages.length]);

  useEffect(() => {
    if (shouldAutoScroll && !userScrolled && displayableMessages.length > 0) {
      // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
      const frameId = requestAnimationFrame(() => {
        performAutoScroll();
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [lastMessageHash]);

  return {
    parentRef,
    userScrolled,
    setUserScrolled,
    setShouldAutoScroll
  };
}
