import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { js as beautifyJs, html as beautifyHtml, css as beautifyCss } from 'js-beautify';
import { MessageResponse } from '../constants/message_types';
import '../DevTool/index.css';

const SOURCE_CHUNK_SIZE = 65000;
const CHUNKS_PER_FRAME = 1;
const SOURCE_TAB_LOAD_TIMEOUT = 20000;
const AI_AUTOMATION_DELAY = 3500;
const AI_ANALYSIS_PROMPT = 'Analyze this file and find if there are any vulnerabilities or security issues in the file';
const AI_TOOLS = [
  { name: 'ChatGPT', icon: 'chatgpt', url: 'https://chatgpt.com/', automation: 'browser' },
  { name: 'Claude', icon: 'claude', url: 'https://claude.ai/new', automation: 'browser' },
  { name: 'Grok', icon: 'grok', url: 'https://grok.com/', automation: 'browser' },
];

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

function sanitizeDownloadFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'source.txt';
}

function getDownloadFileName(sourceUrl: string, contentType: string): string {
  const fallbackByKind: Record<SourceKind, string> = {
    javascript: 'source.js',
    html: 'source.html',
    css: 'source.css',
    text: 'source.txt',
  };

  try {
    const url = new URL(sourceUrl);
    const pathName = url.pathname.split('/').filter(Boolean).pop();

    if (pathName) {
      return sanitizeDownloadFileName(decodeURIComponent(pathName));
    }
  } catch {
    // Fall through to a content-aware default.
  }

  return sanitizeDownloadFileName(fallbackByKind[getSourceKind(sourceUrl, contentType)]);
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"
      />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
      viewBox="0 0 640 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M320 0c17.7 0 32 14.3 32 32V64H472c39.8 0 72 32.2 72 72V376c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V136c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c8.8 0 16-7.2 16-16V304H416v64c0 8.8 7.2 16 16 16s16-7.2 16-16V256c0-35.3-28.7-64-64-64H256c-35.3 0-64 28.7-64 64V368c0 8.8 7.2 16 16 16zm16-128c0-17.7 14.3-32 32-32H384c17.7 0 32 14.3 32 32v16H224V256zM48 224H64V352H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v32c0 26.5-21.5 48-48 48H576V224h16z"
      />
    </svg>
  );
}

function AiProviderIcon({ icon }: { icon: string }) {
  if (icon === 'chatgpt') {
    return (
      <svg aria-hidden="true" focusable="false" className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="currentColor"
          d="M21.6 10.2c.5-1.5.3-3.2-.5-4.6-1.2-2-3.5-3-5.7-2.6A6.2 6.2 0 0 0 10.6.6C8.2.6 6.1 2 5.1 4.1a6.1 6.1 0 0 0-4 3C0 9.2.2 11.7 1.6 13.5c-.5 1.5-.3 3.2.5 4.6 1.2 2 3.5 3 5.7 2.6a6.2 6.2 0 0 0 4.8 2.4c2.4 0 4.5-1.4 5.5-3.5a6.1 6.1 0 0 0 4-3c1.1-2.1.9-4.6-.5-6.4Zm-9 11.3c-1.2 0-2.4-.5-3.2-1.4l.2-.1 5.4-3.1c.3-.2.5-.5.5-.9V8.4l2.3 1.3v6.5c0 2.9-2.3 5.3-5.2 5.3ZM3.4 17.3c-.6-1-.8-2.3-.5-3.5l.2.1 5.4 3.1c.3.2.7.2 1 0l6.6-3.8v2.7l-5.6 3.2c-2.5 1.5-5.7.6-7.1-1.8ZM2.6 8c.6-1.1 1.6-1.9 2.8-2.2V12c0 .4.2.7.5.9l6.6 3.8-2.3 1.3-5.6-3.2C2.1 13.4 1.2 10.2 2.6 8Zm15.5 3.1-6.6-3.8 2.3-1.3 5.6 3.2c2.5 1.5 3.4 4.7 1.9 7.2-.6 1.1-1.6 1.9-2.8 2.2v-6.2c.1-.5-.1-.9-.4-1.1Zm3-1.4-.2-.1-5.4-3.1c-.3-.2-.7-.2-1 0L7.9 10.3V7.6l5.6-3.2c2.5-1.5 5.7-.6 7.1 1.9.7 1 .9 2.2.5 3.4ZM8.5 15.6l-2.3-1.3V7.8c0-2.9 2.3-5.3 5.2-5.3 1.2 0 2.4.5 3.2 1.4l-.2.1L9 7.1c-.3.2-.5.5-.5.9v7.6Zm-.6-3.9 2.9-1.7 2.9 1.7v3.4l-2.9 1.7-2.9-1.7v-3.4Z"
        />
      </svg>
    );
  }

  if (icon === 'claude') {
    return (
      <svg aria-hidden="true" focusable="false" className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="currentColor"
          d="M12 2.2 22 19.8h-5.1l-1.7-3.2H8.8l-1.7 3.2H2L12 2.2Zm0 6.3-2.3 4.3h4.6L12 8.5Z"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" focusable="false" className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M4.2 3h4.1l4.1 5.3L16.9 3h4.6l-6.9 8 7.2 10h-4.1l-4.7-6.5L7.3 21H2.7l8.1-9.3L4.2 3Zm3.1 1.7 10.9 14.6h.8L8.1 4.7h-.8Z"
      />
    </svg>
  );
}

function saveTextFile(fileName: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

async function automateAiAnalysis(tabId: number, toolName: string, fileName: string, sourceText: string, contentType: string): Promise<void> {
  const automateAiTool = async (
    providerName: string,
    uploadFileName: string,
    uploadSourceText: string,
    uploadContentType: string,
    prompt: string,
  ) => {
    const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    const waitForElement = async <T extends Element>(selector: string, timeout = 30000): Promise<T> => {
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeout) {
        const element = document.querySelector<T>(selector);

        if (element) {
          return element;
        }

        await wait(250);
      }

      throw new Error(`${providerName} automation could not find ${selector}`);
    };

    const findButtonByText = (patterns: RegExp[], root: ParentNode = document) => {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));

      return buttons.find((button) => {
        const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''} ${button.textContent || ''}`;
        return patterns.some((pattern) => pattern.test(label));
      });
    };

    const setNativeValue = (element: HTMLTextAreaElement | HTMLInputElement, value: string) => {
      const prototype = Object.getPrototypeOf(element);
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    await waitForElement('body');

    const promptTarget = await waitForElement<HTMLElement>('textarea, [contenteditable="true"], [role="textbox"], div.ProseMirror');
    const composerRoot = promptTarget.closest('form') || promptTarget.parentElement?.parentElement?.parentElement || document;
    let input = document.querySelector<HTMLInputElement>('input[type="file"]');

    if (!input) {
      const addFileButton = findButtonByText([/attach/i, /upload/i, /add/i, /file/i, /\+/], composerRoot);
      addFileButton?.click();
      input = await waitForElement<HTMLInputElement>('input[type="file"]');
    }

    const uploadFile = new File([uploadSourceText], uploadFileName, { type: uploadContentType || 'text/plain' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(uploadFile);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    promptTarget.scrollIntoView({ block: 'center' });
    (promptTarget as HTMLElement).focus();

    if (promptTarget instanceof HTMLTextAreaElement || promptTarget instanceof HTMLInputElement) {
      setNativeValue(promptTarget, prompt);
    } else {
      promptTarget.textContent = '';
      document.execCommand('insertText', false, prompt);
      promptTarget.dispatchEvent(new InputEvent('input', { bubbles: true, data: prompt, inputType: 'insertText' }));
    }

    const waitForFileAttachment = async (timeout = 12000) => {
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeout) {
        if (document.body.innerText.includes(uploadFileName)) {
          return true;
        }

        await wait(500);
      }

      return false;
    };

    if (!(await waitForFileAttachment())) {
      const dropTarget = composerRoot instanceof Element ? composerRoot : promptTarget;
      ['dragenter', 'dragover', 'drop'].forEach((eventName) => {
        dropTarget.dispatchEvent(new DragEvent(eventName, {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }));
      });
    }

    if (!(await waitForFileAttachment(18000))) {
      throw new Error(`${providerName} did not accept the source file upload.`);
    }

    await wait(750);

    const sendButton = findButtonByText([/send/i, /submit/i]) || Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`;
      const disabled = button.disabled || button.getAttribute('aria-disabled') === 'true';

      return !disabled && (/arrow-up/i.test(label) || /send/i.test(label));
    });

    if (!sendButton || sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') {
      throw new Error(`${providerName} automation prepared the prompt and file, but the send button was not ready.`);
    }

    sendButton.click();
  };

  const scripting = (browser as any).scripting;

  if (scripting?.executeScript) {
    await scripting.executeScript({
      target: { tabId },
      func: automateAiTool,
      args: [toolName, fileName, sourceText, contentType, AI_ANALYSIS_PROMPT],
    });
    return;
  }

  throw new Error(`${toolName} automation requires the browser scripting API.`);
}

async function ensureHostPermission(): Promise<boolean> {
  const permissions = { origins: ['<all_urls>'] };

  try {
    if (await browser.permissions.contains(permissions)) {
      return true;
    }

    return browser.permissions.request(permissions);
  } catch (error) {
    console.warn('Failed to request access to all websites:', error);
    return false;
  }
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

async function waitForTabLoad(tabId: number): Promise<void> {
  const tab = await browser.tabs.get(tabId);

  if (tab.status === 'complete') {
    return;
  }

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
  const [sourceText, setSourceText] = useState('');
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [totalChunks, setTotalChunks] = useState(0);
  const [renderedChunks, setRenderedChunks] = useState<RenderedChunk[]>([]);
  const cancelledRef = useRef(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

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
        setSourceText(sourceText);
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
        setSourceText('');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load source.');
      }
    };

    renderSource();

    return () => {
      cancelledRef.current = true;
    };
  }, [sourceUrl, retryToken]);

  useEffect(() => {
    if (!showAiMenu) return;

    const closeAiMenu = (event: MouseEvent) => {
      if (aiMenuRef.current?.contains(event.target as Node)) return;
      setShowAiMenu(false);
    };

    const closeAiMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAiMenu(false);
    };

    document.addEventListener('mousedown', closeAiMenu);
    document.addEventListener('keydown', closeAiMenuWithEscape);

    return () => {
      document.removeEventListener('mousedown', closeAiMenu);
      document.removeEventListener('keydown', closeAiMenuWithEscape);
    };
  }, [showAiMenu]);

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
    setSourceText('');
    setAiStatusMessage('');
    setTotalChunks(0);
    setRenderedChunks([]);
    setStatus('loading');
    setRetryToken(0);
    setSourceUrl(nextSourceUrl);
    setManualSourceUrl('');
  };

  const handleGrantPermissionAndRetry = async () => {
    try {
      const granted = await browser.permissions.request({ origins: ['<all_urls>'] });

      if (!granted) {
        setErrorMessage('Access to all websites was not granted.');
        return;
      }

      setErrorMessage('');
      setRetryToken((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to request source permission.');
    }
  };

  const handleDownloadSource = () => {
    if (!sourceText) return;

    saveTextFile(getDownloadFileName(sourceUrl, contentType), sourceText, contentType || 'text/plain;charset=utf-8');
  };

  const handleSendToAi = async (tool: typeof AI_TOOLS[number]) => {
    if (!sourceText) return;

    const sourceFileName = getDownloadFileName(sourceUrl, contentType);

    setShowAiMenu(false);
    setAiStatusMessage(`Opening ${tool.name}...`);

    try {
      if (tool.automation === 'browser') {
        const hasPermission = await ensureHostPermission();

        if (!hasPermission) {
          setAiStatusMessage(`${tool.name} automation failed: Access to all websites was not granted.`);
          return;
        }

        const tab = await browser.tabs.create({ url: tool.url, active: true });

        if (typeof tab.id !== 'number') {
          throw new Error(`Could not open ${tool.name} tab.`);
        }

        await waitForTabLoad(tab.id);
        await new Promise((resolve) => window.setTimeout(resolve, AI_AUTOMATION_DELAY));
        setAiStatusMessage(`Attaching file and submitting prompt in ${tool.name}...`);
        await automateAiAnalysis(tab.id, tool.name, sourceFileName, sourceText, contentType || 'text/plain;charset=utf-8');
        setAiStatusMessage(`Sent to ${tool.name}.`);
        return;
      }
    } catch (error) {
      if (tool.automation === 'browser') {
        const message = error instanceof Error ? error.message : `${tool.name} automation failed.`;
        setAiStatusMessage(`${tool.name} automation failed: ${message}`);
        return;
      }

      try {
        window.open(tool.url, '_blank', 'noopener,noreferrer');
        setAiStatusMessage(`Opened ${tool.name}.`);
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : `Failed to send to ${tool.name}.`;
        setAiStatusMessage(message);
      }
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
                  {aiStatusMessage && <span className="text-[#66d4c1]">{aiStatusMessage}</span>}
                </div>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative" ref={aiMenuRef}>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#355a67] bg-[#13252d] text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setShowAiMenu((value) => !value)}
                disabled={!sourceText}
                aria-label="Send source file to AI"
                title="Send source file to AI"
              >
                <AiIcon />
              </button>
              {showAiMenu && (
                <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-[#355a67] bg-[#101c21] py-1 shadow-2xl shadow-black/40">
                  {AI_TOOLS.map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:bg-[#17313a] hover:text-white"
                      onClick={() => handleSendToAi(tool)}
                    >
                      <span>{tool.name}</span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#355a67] text-[#7fb8cb]">
                        <AiProviderIcon icon={tool.icon} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#355a67] bg-[#13252d] text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleDownloadSource}
              disabled={!sourceText}
              aria-label="Download source file"
              title="Download source file"
            >
              <DownloadIcon />
            </button>
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
