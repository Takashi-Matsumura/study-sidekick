'use client';

import { useEffect, useRef } from 'react';
import { Message, SearchResult } from '@/lib/types';
import { GraduationCapIcon, LinkIcon } from './Icons';

interface ChatOutputProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
}

export function ChatOutput({ messages, isLoading, streamingContent }: ChatOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500">
        <div className="mb-4">
          <GraduationCapIcon className="w-16 h-16" />
        </div>
        <h2 className="text-xl font-medium text-zinc-600 dark:text-zinc-400 mb-2">
          Study Sidekick
        </h2>
        <p className="text-sm text-center max-w-md">
          左側でモードを選んで、質問を入力してください。
          <br />
          高校生にもわかりやすく回答します！
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 space-y-1 p-4">
        {messages.map((message, index) => (
          <div key={index} className="flex items-start gap-3 py-2">
            {/* アイコン */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-700 text-white'
            }`}>
              {message.role === 'user' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                <GraduationCapIcon className="w-5 h-5" />
              )}
            </div>
            {/* メッセージ */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {message.role === 'user' ? 'あなた' : 'AI'}
                </span>
              </div>
              {message.role === 'user' ? (
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="text-zinc-700 dark:text-zinc-300">
                  <MarkdownContent content={message.content} />
                  {message.sources && message.sources.length > 0 && (
                    <SourceLinks sources={message.sources} />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ストリーミング中のコンテンツ */}
        {isLoading && streamingContent && (
          <div className="flex items-start gap-3 py-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-zinc-700 text-white flex items-center justify-center">
              <GraduationCapIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">AI</span>
              </div>
              <div className="text-zinc-700 dark:text-zinc-300">
                <MarkdownContent content={streamingContent} />
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              </div>
            </div>
          </div>
        )}

        {/* ローディング（ストリーミング前） */}
        {isLoading && !streamingContent && (
          <div className="flex items-start gap-3 py-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-zinc-700 text-white flex items-center justify-center">
              <GraduationCapIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">AI</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>考え中...</span>
              </div>
            </div>
          </div>
        )}

        {/* スクロール用のアンカー */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // 簡易的なMarkdownレンダリング
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // 見出し
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-lg font-bold mt-4 mb-2 text-blue-600 dark:text-blue-400">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-base font-semibold mt-3 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <h3 key={i} className="text-base font-semibold mt-3 mb-1 text-blue-600 dark:text-blue-400">
              {line.slice(2, -2)}
            </h3>
          );
        }

        // 箇条書き
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-blue-500">•</span>
              <span>{formatInlineText(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          const match = line.match(/^(\d+)\. (.*)$/);
          if (match) {
            return (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-blue-500 font-medium">{match[1]}.</span>
                <span>{formatInlineText(match[2])}</span>
              </div>
            );
          }
        }

        // 空行
        if (line.trim() === '') {
          return <div key={i} className="h-2" />;
        }

        // 通常テキスト
        return (
          <p key={i} className="leading-relaxed">
            {formatInlineText(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatInlineText(text: string): React.ReactNode {
  // **bold** と `code` の処理
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function SourceLinks({ sources }: { sources: SearchResult[] }) {
  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-1">
        <LinkIcon className="w-4 h-4" />
        参考リンク
      </h4>
      <ul className="space-y-1">
        {sources.map((source, i) => (
          <li key={i} className="text-sm">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {source.title || source.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
