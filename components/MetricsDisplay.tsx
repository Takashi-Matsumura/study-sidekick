'use client';

import { GenerationMetrics } from '@/lib/types';

interface MetricsDisplayProps {
  metrics: GenerationMetrics;
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  const formatNumber = (num: number, decimals: number = 0) => {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
      {/* コンテキストウィンドウ使用量 */}
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Context:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                metrics.contextUsagePercent > 80
                  ? 'bg-red-500'
                  : metrics.contextUsagePercent > 50
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(metrics.contextUsagePercent, 100)}%` }}
            />
          </div>
          <span className="tabular-nums">
            {formatNumber(metrics.inputTokens + metrics.outputTokens)} / {formatNumber(metrics.contextWindowSize)}
          </span>
          <span className="text-zinc-400">({metrics.contextUsagePercent.toFixed(1)}%)</span>
        </div>
      </div>

      {/* 区切り線 */}
      <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-600" />

      {/* 入力/出力トークン */}
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">In:</span>
        <span className="tabular-nums">{formatNumber(metrics.inputTokens)}</span>
        <span className="text-zinc-400 dark:text-zinc-500 ml-1">Out:</span>
        <span className="tabular-nums">{formatNumber(metrics.outputTokens)}</span>
      </div>

      {/* 区切り線 */}
      <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-600" />

      {/* 生成速度 */}
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Speed:</span>
        <span className={`tabular-nums ${metrics.isGenerating ? 'text-green-600 dark:text-green-400' : ''}`}>
          {formatNumber(metrics.tokensPerSecond, 1)} tok/s
        </span>
        {metrics.isGenerating && (
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* 区切り線 */}
      <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-600" />

      {/* 生成時間 */}
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Time:</span>
        <span className="tabular-nums">{formatTime(metrics.totalTimeMs)}</span>
      </div>
    </div>
  );
}
