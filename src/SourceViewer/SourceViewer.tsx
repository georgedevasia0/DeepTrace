import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { js as beautifyJs, html as beautifyHtml, css as beautifyCss } from 'js-beautify';
import { MessageResponse } from '../constants/message_types';
import '../DevTool/index.css';

const SOURCE_CHUNK_SIZE = 65000;
const CHUNKS_PER_FRAME = 1;
const SOURCE_TAB_LOAD_TIMEOUT = 20000;

type ViewerStatus = 'loading' | 'rendering' | 'complete' | 'error';
type SourceKind = ReturnType<typeof getSourceKind>;
type RenderedChunk = {
  code: string;
  startLine: number;
};

function getSourceUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('source') || '';
}

function getSourceOriginPattern(sourceUrl: string): string | null {
  try {
    return `${new URL(sourceUrl).origin}/*`;
  } catch {
    return null;
  }
}

function splitIntoChunks(source: string): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < source.length; index += SOURCE_CHUNK_SIZE) {
    chunks.push(source.slice(index, index + SOURCE_CHUNK_SIZE));
  }

  return chunks.length > 0 ? chunks : [''];
}

function getSourceKind(sourceUrl: string, contentType: string): 'javascript' | 'html' | 'css' | 'text' {
  const normalizedUrl = sourceUrl.toLowerCase().split('?')[0];
  const normalizedType = contentType.toLowerCase();

  if (normalizedType.includes('javascript') || normalizedUrl.endsWith('.js') || normalizedUrl.endsWith('.mjs')) {
    return 'javascript';
  }

  if (normalizedType.includes('html') || normalizedUrl.endsWith('.html') || normalizedUrl.endsWith('.htm')) {
    return 'html';
  }

  if (normalizedType.includes('css') || normalizedUrl.endsWith('.css')) {
    return 'css';
  }

  return 'text';
}

function beautifyChunk(chunk: string, sourceKind: SourceKind): string {
  const options = {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 2,
    preserve_newlines: true,
    wrap_line_length: 0,
    end_with_newline: false,
  };

  try {
    if (sourceKind === 'javascript') {
      return beautifyJs(chunk, options);
    }

    if (sourceKind === 'html') {
      return beautifyHtml(chunk, options);
    }

    if (sourceKind === 'css') {
      return beautifyCss(chunk, options);
    }
  } catch (error) {
    console.warn('Failed to beautify source chunk, rendering raw chunk:', error);
  }

  return chunk;
}

function countLines(source: string): number {
  if (!source) return 1;
  return source.split('\n').length;
}

function getTokenClass(token: string, previousToken: string, nextToken: string): string {
  const keywordPattern = /^(await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|switch|throw|try|typeof|var|void|while|with|yield)$/;
  const literalPattern = /^(true|false|null|undefined|NaN|Infinity)$/;
  const globalPattern = /^(window|document|location|navigator|console|JSON|Math|Array|Object|String|Number|Boolean|Promise|Set|Map|Date|RegExp|XMLHttpRequest|fetch)$/;

  if (/^\/\//.test(token) || /^\/\*/.test(token)) return 'text-[#6f7f86]';
  if (/^(['"`])/.test(token) && nextToken === ':') return 'text-[#ff5fbf]';
  if (/^(['"`])/.test(token)) return 'text-[#8ae234]';
  if (/^\d/.test(token)) return 'text-[#ffb86c]';
  if (keywordPattern.test(token)) return 'text-[#00b7ff]';
  if (literalPattern.test(token)) return 'text-[#ff5fbf]';
  if (globalPattern.test(token)) return 'text-[#62d6ff]';
  if (/^[{}()[\]]+$/.test(token)) return 'text-[#f8f8f2]';
  if (/^[.,;:?]+$/.test(token)) return 'text-[#b8c7cc]';
  if (/^[=!<>+\-*/%&|~^]+$/.test(token)) return 'text-[#ff4fb8]';
  if (previousToken === '.') return 'text-[#ff5fbf]';

  return 'text-[#f8f8f2]';
}

function highlightLine(line: string): JSX.Element[] {
  const tokenPattern = /(\/\/.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[{}()[\].,;:?]|[=!<>+\-*/%&|~^]+)/g;
  const tokenMatches = Array.from(line.matchAll(tokenPattern));
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let previousToken = '';

  tokenMatches.forEach((match, tokenIndex) => {
    const token = match[0];
    const nextToken = tokenMatches[tokenIndex + 1]?.[0] || '';

    if (match.index > lastIndex) {
      parts.push(<span key={`${match.index}-space`}>{line.slice(lastIndex, match.index)}</span>);
    }

    parts.push(
      <span key={`${match.index}-${token}`} className={getTokenClass(token, previousToken, nextToken)}>
        {token}
      </span>
    );

    previousToken = token.trim() || previousToken;
    lastIndex = match.index + token.length;
  });

  if (lastIndex < line.length) {
    parts.push(<span key="tail">{line.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key="empty">{'\u00A0'}</span>];
}

const CodeChunk = React.memo(function CodeChunk({ chunk }: { chunk: RenderedChunk }) {
  const lines = useMemo(() => chunk.code.split('\n'), [chunk.code]);
  const gutterWidth = `${Math.max(String(chunk.startLine + lines.length - 1).length, 3) + 5}ch`;

  return (
    <div className="border-b border-[#142932] last:border-b-0">
      {lines.map((line, index) => (
        <div key={index} className="flex w-full items-start font-mono text-[13px] leading-6">
          <div
            className="shrink-0 select-none border-r border-[#10252d] bg-[#020607] pl-3 pr-5 text-right text-[#4f6870]"
            style={{ width: gutterWidth, minWidth: gutterWidth }}
          >
            {chunk.startLine + index}
          </div>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-all px-4 text-[#f8f8f2]">
            {highlightLine(line)}
          </div>
        </div>
      ))}
    </div>
  );
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fetchSourceThroughBackground(sourceUrl: string): Promise<{ body: string; contentType: string }> {
  const response = await browser.runtime.sendMessage({
    action: 'sendRequest',
    method: 'GET',
    endpoint: {
      url: sourceUrl,
      foundAt: sourceUrl,
      webpage: sourceUrl,
      classifications: {},
      captureIndex: 0,
    },
    customRequest: {
      url: sourceUrl,
      method: 'GET',
      headers: {},
    },
  }) as MessageResponse;

  if (!response?.success || typeof response.body !== 'string') {
    throw new Error(response?.error || response?.statusText || 'Failed to fetch source through background request handler.');
  }

  return {
    body: response.body,
    contentType: response.headers?.['content-type'] || response.headers?.['Content-Type'] || '',
  };
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out while opening source tab.'));
    }, SOURCE_TAB_LOAD_TIMEOUT);

    const listener = (updatedTabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        window.clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

async function extractSourceWithInjectedScript(tabId: number): Promise<{ body: string; contentType: string }> {
  const extractSource = () => {
    const preText = document.querySelector('pre')?.textContent || '';
    const bodyText = document.body?.innerText || '';
    const documentText = document.documentElement?.textContent || '';
    const documentMarkup = document.documentElement?.outerHTML || '';

    return {
      body: preText || bodyText || documentText || documentMarkup,
      contentType: document.contentType || ''
    };
  };

  const scripting = (browser as any).scripting;

  if (scripting?.executeScript) {
    const results = await scripting.executeScript({
      target: { tabId },
      func: extractSource,
    }) as Array<{ result?: { body: string; contentType: string } }>;
    const extracted = results?.[0]?.result;

    if (extracted?.body) {
      return extracted;
    }
  }

  const tabs = browser.tabs as any;

  if (tabs.executeScript) {
    const code = `(${extractSource.toString()})();`;
    const results = await tabs.executeScript(tabId, { code }) as Array<{ body: string; contentType: string }>;
    const extracted = results?.[0];

    if (extracted?.body) {
      return extracted;
    }
  }

  throw new Error('No source text was available in the opened source tab.');
}

async function fetchSourceThroughRenderedTab(sourceUrl: string): Promise<{ body: string; contentType: string }> {
  const tab = await browser.tabs.create({ url: sourceUrl, active: false });
  const tabId = tab.id;

  if (typeof tabId !== 'number') {
    throw new Error('Could not open a temporary tab for the source.');
  }

  try {
    await waitForTabLoad(tabId);

    try {
      const response = await browser.tabs.sendMessage(tabId, { action: 'extractSourceContent' }) as MessageResponse;

      if (response?.success && typeof response.body === 'string') {
        return {
          body: response.body,
          contentType: response.headers?.['content-type'] || response.headers?.['Content-Type'] || '',
        };
      }
    } catch (error) {
      console.warn('Content script extraction failed, trying injected extraction:', error);
    }

    return extractSourceWithInjectedScript(tabId);
  } finally {
    browser.tabs.remove(tabId).catch(() => undefined);
  }
}

async function loadSource(sourceUrl: string): Promise<{ body: string; contentType: string; strategy: string }> {
  try {
    const source = await fetchSourceThroughBackground(sourceUrl);
    return { ...source, strategy: 'background fetch' };
  } catch (error) {
    console.warn('Background source fetch failed, trying rendered tab extraction:', error);
  }

  const source = await fetchSourceThroughRenderedTab(sourceUrl);
  return { ...source, strategy: 'rendered tab extraction' };
}

function SourceViewerApp() {
  const [sourceUrl, setSourceUrl] = useState(getSourceUrl);
  const [manualSourceUrl, setManualSourceUrl] = useState('');
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [contentType, setContentType] = useState('');
  const [loadStrategy, setLoadStrategy] = useState('');
  const [showSourceDetails, setShowSourceDetails] = useState(true);
  const [sourceSize, setSourceSize] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [renderedChunks, setRenderedChunks] = useState<RenderedChunk[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const renderSource = async () => {
      if (!sourceUrl) {
        setStatus('loading');
        setErrorMessage('');
        setRenderedChunks([]);
        return;
      }

      try {
        setStatus('loading');
        const { body: sourceText, contentType: responseContentType, strategy } = await loadSource(sourceUrl);
        const sourceKind = getSourceKind(sourceUrl, responseContentType);
        const chunks = splitIntoChunks(sourceText);

        if (cancelledRef.current) return;

        setContentType(responseContentType || sourceKind);
        setLoadStrategy(strategy);
        setSourceSize(sourceText.length);
        setTotalChunks(chunks.length);
        setRenderedChunks([]);
        setStatus('rendering');

        let index = 0;
        let nextStartLine = 1;

        const renderNextBatch = () => {
          if (cancelledRef.current) return;

          const nextChunks: RenderedChunk[] = [];
          const endIndex = Math.min(index + CHUNKS_PER_FRAME, chunks.length);

          for (; index < endIndex; index += 1) {
            const code = beautifyChunk(chunks[index], sourceKind);
            nextChunks.push({
              code,
              startLine: nextStartLine,
            });
            nextStartLine += countLines(code);
          }

          setRenderedChunks((current) => [...current, ...nextChunks]);

          if (index < chunks.length) {
            window.setTimeout(renderNextBatch, 0);
          } else {
            setStatus('complete');
          }
        };

        window.setTimeout(renderNextBatch, 0);
      } catch (error) {
        if (cancelledRef.current) return;

        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load source.');
      }
    };

    renderSource();

    return () => {
      cancelledRef.current = true;
    };
  }, [sourceUrl, retryToken]);

  const handleOpenManualSource = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSourceUrl = manualSourceUrl.trim();

    if (!nextSourceUrl) {
      setErrorMessage('Enter a source URL.');
      return;
    }

    try {
      new URL(nextSourceUrl);
    } catch {
      setErrorMessage('Enter a valid absolute URL, including http:// or https://.');
      return;
    }

    const nextSearch = `?source=${encodeURIComponent(nextSourceUrl)}`;
    window.history.pushState(null, '', `${window.location.pathname}${nextSearch}`);
    setErrorMessage('');
    setContentType('');
    setLoadStrategy('');
    setShowSourceDetails(true);
    setSourceSize(0);
    setTotalChunks(0);
    setRenderedChunks([]);
    setStatus('loading');
    setRetryToken(0);
    setSourceUrl(nextSourceUrl);
    setManualSourceUrl('');
  };

  const handleGrantPermissionAndRetry = async () => {
    const originPattern = getSourceOriginPattern(sourceUrl);

    if (!originPattern) {
      setErrorMessage('Cannot request permission for this source URL.');
      return;
    }

    try {
      const granted = await browser.permissions.request({ origins: [originPattern] });

      if (!granted) {
        setErrorMessage(`Permission was not granted for ${originPattern}`);
        return;
      }

      setErrorMessage('');
      setRetryToken((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to request source permission.');
    }
  };

  const renderedCount = renderedChunks.length;
  const progressPercent = totalChunks > 0 ? Math.round((renderedCount / totalChunks) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0b1418] text-[#e7f7fb]">
      <header className={`sticky top-0 z-10 bg-[#0b1418]/95 px-6 py-4 backdrop-blur ${showSourceDetails ? 'border-b border-[#29424d]' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7fb8cb]">DeepTrace Source Viewer</div>
            {showSourceDetails && (
              <>
                <h1 className="mt-2 break-all text-base font-semibold leading-6 text-white">{sourceUrl || 'No source selected'}</h1>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#9fc1cc]">
                  <span>{contentType || 'Detecting type'}</span>
                  <span>{loadStrategy || 'Loading source'}</span>
                  <span>{formatBytes(sourceSize)}</span>
                  <span>{renderedCount}/{totalChunks || 0} chunks rendered</span>
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-2xl border border-[#355a67] bg-[#13252d] px-4 py-2 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7]"
              onClick={() => setShowSourceDetails((value) => !value)}
            >
              {showSourceDetails ? 'Hide Details' : 'View Details'}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-[#355a67] bg-[#13252d] px-4 py-2 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7]"
              onClick={() => window.close()}
            >
              Close
            </button>
          </div>
        </div>
        {showSourceDetails && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#15272f]">
            <div className="h-full bg-[#66d4c1] transition-all duration-200" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </header>

      <section className="px-6 py-5">
        {!sourceUrl && (
          <form
            onSubmit={handleOpenManualSource}
            className="mx-auto mt-10 max-w-3xl rounded-lg border border-[#29424d] bg-[#101c21] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <label htmlFor="source-url" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7fb8cb]">
              Source URL
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="source-url"
                type="url"
                value={manualSourceUrl}
                onChange={(event) => {
                  setManualSourceUrl(event.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="https://example.com/app.js"
                className="min-h-[46px] min-w-0 flex-1 rounded-2xl border border-[#355a67] bg-[#0b1418] px-4 py-2 text-sm text-white outline-none transition-all duration-200 placeholder:text-[#58707a] focus:border-[#7ad4e7]"
                autoFocus
              />
              <button
                type="submit"
                className="min-h-[46px] rounded-2xl border border-[#66d4c1] bg-[#173d45] px-5 py-2 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#aaf6ea]"
              >
                Open Source
              </button>
            </div>
            {errorMessage && <div className="mt-3 text-sm text-[#ffd6d6]">{errorMessage}</div>}
          </form>
        )}

        {status === 'loading' && (
          sourceUrl ? (
            <div className="rounded-lg border border-[#29424d] bg-[#101c21] p-5 text-sm text-[#9fc1cc]">Fetching source...</div>
          ) : null
        )}

        {sourceUrl && status === 'error' && (
          <div className="rounded-lg border border-[#6f3434] bg-[#251819] p-5 text-sm text-[#ffd6d6]">
            <div>{errorMessage}</div>
            {errorMessage.toLowerCase().includes('host permission') && (
              <button
                type="button"
                className="mt-4 rounded-2xl border border-[#714545] bg-[#321d1f] px-4 py-2 text-sm font-semibold text-[#ffe5e5] transition-all duration-200 hover:border-[#b56262]"
                onClick={handleGrantPermissionAndRetry}
              >
                Grant permission and retry
              </button>
            )}
          </div>
        )}

        {sourceUrl && status !== 'loading' && status !== 'error' && (
          <div className="overflow-x-hidden overflow-y-auto rounded-lg border border-[#29424d] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {renderedChunks.map((chunk, index) => (
              <CodeChunk key={index} chunk={chunk} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<SourceViewerApp />);
}
