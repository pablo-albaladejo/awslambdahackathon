import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Message } from '../contexts/WebSocketContext';
import { usePerformance } from '../hooks/usePerformance';

interface VirtualizedMessageListProps {
  messages: Message[];
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

interface VirtualItem {
  index: number;
  message: Message;
  top: number;
  height: number;
}

// Memoized Message Item Component
const VirtualMessageItem = React.memo<{
  message: Message;
  style: React.CSSProperties;
}>(({ message, style }) => {
  const messageTime = useMemo(
    () => message.timestamp.toLocaleTimeString(),
    [message.timestamp]
  );

  return (
    <div style={style} className="message-item">
      <div
        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            message.isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-900 border border-gray-200'
          }`}
        >
          <p className="text-sm">{message.text}</p>
          <p
            className={`text-xs mt-1 ${
              message.isUser ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            {messageTime}
          </p>
        </div>
      </div>
    </div>
  );
});

VirtualMessageItem.displayName = 'VirtualMessageItem';

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  itemHeight = 80, // Estimated height of each message item
  containerHeight = 400,
  overscan = 5, // Number of items to render outside visible area
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightState, setContainerHeight] = useState(containerHeight);

  // Performance monitoring
  const { getPerformanceStats } = usePerformance('VirtualizedMessageList');

  // Calculate virtual items
  const virtualItems = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      messages.length - 1,
      Math.floor((scrollTop + containerHeightState) / itemHeight) + overscan
    );

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (messages[i]) {
        items.push({
          index: i,
          message: messages[i],
          top: i * itemHeight,
          height: itemHeight,
        });
      }
    }

    return items;
  }, [messages, scrollTop, itemHeight, containerHeightState, overscan]);

  // Calculate total height
  const totalHeight = useMemo(
    () => messages.length * itemHeight,
    [messages.length, itemHeight]
  );

  // Handle scroll events with throttling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Auto-scroll to bottom for new messages
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Effect to scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(scrollToBottom, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, scrollToBottom]);

  // Effect to update container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Performance monitoring effect
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getPerformanceStats();
      if (stats && stats.slowRenderPercentage > 15) {
        logger.warn('VirtualizedMessageList performance issues detected', {
          totalMessages: messages.length,
          visibleItems: virtualItems.length,
          slowRenderPercentage: stats.slowRenderPercentage,
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [getPerformanceStats, messages.length, virtualItems.length]);

  // Memoized container style
  const containerStyle = useMemo(
    () => ({
      height: containerHeightState,
      overflow: 'auto' as const,
      position: 'relative' as const,
    }),
    [containerHeightState]
  );

  // Memoized content style
  const contentStyle = useMemo(
    () => ({
      height: totalHeight,
      position: 'relative' as const,
    }),
    [totalHeight]
  );

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onScroll={handleScroll}
      className="virtualized-message-list"
    >
      <div style={contentStyle}>
        {virtualItems.map(item => (
          <VirtualMessageItem
            key={item.message.id}
            message={item.message}
            style={{
              position: 'absolute',
              top: item.top,
              height: item.height,
              width: '100%',
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Hook for dynamic item height calculation
export const useDynamicItemHeight = () => {
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(
    new Map()
  );
  const observerRef = useRef<ResizeObserver | null>(null);

  const measureItem = useCallback((element: HTMLElement, messageId: string) => {
    if (element) {
      const height = element.offsetHeight;
      setItemHeights(prev => {
        const newMap = new Map(prev);
        newMap.set(messageId, height);
        return newMap;
      });
    }
  }, []);

  const getAverageItemHeight = useCallback(() => {
    if (itemHeights.size === 0) return 80; // Default height

    const heights = Array.from(itemHeights.values());
    const average =
      heights.reduce((sum, height) => sum + height, 0) / heights.length;
    return Math.max(average, 40); // Minimum height of 40px
  }, [itemHeights]);

  useEffect(() => {
    // Clean up old observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const messageId = entry.target.getAttribute('data-message-id');
        if (messageId) {
          measureItem(entry.target as HTMLElement, messageId);
        }
      });
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [measureItem]);

  return {
    itemHeights,
    getAverageItemHeight,
    measureItem,
    observer: observerRef.current,
  };
};
