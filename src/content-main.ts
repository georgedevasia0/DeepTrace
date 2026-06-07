import browser from 'webextension-polyfill';
import { Parser } from './content/urlParser';
import { Message, MessageResponse } from './constants/message_types';

let isAutoParserEnabled = false;
const parser = new Parser();
let autoParseObserver: MutationObserver | null = null;
let autoParseTimer: ReturnType<typeof setTimeout> | null = null;

const AUTO_PARSE_DELAY = 750;
const PARSER_PROGRESS_ID = 'parsing-progress-container';

function extractRenderedSourceText(): { body: string; contentType: string } {
  const preText = document.querySelector('pre')?.textContent || '';
  const bodyText = document.body?.innerText || '';
  const documentText = document.documentElement?.textContent || '';
  const documentMarkup = document.documentElement?.outerHTML || '';

  return {
    body: preText || bodyText || documentText || documentMarkup,
    contentType: document.contentType || '',
  };
}

function scheduleAutoParse(reason: string): void {
  if (!isAutoParserEnabled) {
    return;
  }

  parser.parseURLs().catch((error) => {
    console.error(`Auto parser failed during ${reason}:`, error);
  });
}

function queueAutoParse(reason: string): void {
  if (!isAutoParserEnabled || autoParseTimer) {
    return;
  }

  autoParseTimer = setTimeout(() => {
    autoParseTimer = null;
    scheduleAutoParse(reason);
  }, AUTO_PARSE_DELAY);
}

function isParserProgressMutation(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  if (target?.closest(`#${PARSER_PROGRESS_ID}`)) {
    return true;
  }

  const changedNodes = mutation.type === 'childList'
    ? [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
    : [];

  return changedNodes.length > 0 &&
    changedNodes.every((node) =>
      node instanceof Element && (node.id === PARSER_PROGRESS_ID || Boolean(node.closest(`#${PARSER_PROGRESS_ID}`)))
    );
}

function startAutoParseObserver(): void {
  if (autoParseObserver || !isAutoParserEnabled || !document.documentElement) {
    return;
  }

  autoParseObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !isParserProgressMutation(mutation))) {
      queueAutoParse('dom-mutation');
    }
  });

  autoParseObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'action'],
  });
}

function stopAutoParseObserver(): void {
  autoParseObserver?.disconnect();
  autoParseObserver = null;

  if (autoParseTimer) {
    clearTimeout(autoParseTimer);
    autoParseTimer = null;
  }
}

function setAutoParserEnabled(enabled: boolean, reason: string): void {
  isAutoParserEnabled = enabled;

  if (enabled) {
    startAutoParseObserver();
    scheduleAutoParse(reason);
  } else {
    stopAutoParseObserver();
  }
}

// Set up message listener for content script
browser.runtime.onMessage.addListener((message: unknown, sender: browser.Runtime.MessageSender, sendResponse: (response: unknown) => void) => {
  console.log('Content script received message:', message);

  const typedMessage = message as Message;
  const typedSendResponse = (response: MessageResponse) => sendResponse(response);

  switch (typedMessage.action) {
    case 'parseURLs':
      parser.parseURLs().then(() => typedSendResponse({ success: true }));
      break;
    case 'reparse':
      parser.reparse().then(() => typedSendResponse({ success: true }));
      break;
    case 'countURLs':
      Parser.countURLs().then(count => typedSendResponse({ success: true, count }));
      break;
    case 'countJSFiles':
      Parser.countJSFiles().then(count => typedSendResponse({ success: true, count }));
      break;
    case 'scanSecrets':
      parser.scanSecrets();
      typedSendResponse({ success: true });
      break;
    case 'stopSecretScan':
      parser.stopSecretScan();
      typedSendResponse({ success: true });
      break;
    case 'getSecretScanProgress':
      parser.getSecretScanProgress().then(details => typedSendResponse({ success: true, details }));
      break;
    case 'getAutoParserState':
      typedSendResponse({ success: true, state: isAutoParserEnabled });
      break;
    case 'setAutoParserState':
      setAutoParserEnabled(typedMessage.state ?? false, 'toggle');
      typedSendResponse({ success: true });
      break;
    case 'autoParserStateChanged':
      setAutoParserEnabled(typedMessage.state ?? false, 'state-change');
      typedSendResponse({ success: true });
      break;
    case 'checkContentScriptInjected':
      typedSendResponse({ success: true });
      break;
    case 'extractSourceContent': {
      const source = extractRenderedSourceText();
      typedSendResponse({
        success: Boolean(source.body),
        body: source.body,
        headers: {
          'content-type': source.contentType,
        },
        error: source.body ? undefined : 'No rendered source text found',
      });
      break;
    }
    case 'clearURLs':
      browser.storage.local.set({
        "URL-PARSER": {},
        "SECRET-PARSER": {},
        secretCount: 0,
        secretScanProgress: {
          running: false,
          total: 0,
          completed: 0,
          failed: 0,
          current: '',
        }
      }).then(() => typedSendResponse({ success: true }));
      break;
    default:
      typedSendResponse({ success: false, error: 'Unknown action' });
  }

  return true; // Keeps the message channel open for asynchronous responses
});

// Initialize as early as possible. Reading storage directly is faster than waiting
// on a background round-trip during very short redirect documents.
browser.storage.local.get('autoParserEnabled').then((result) => {
  setAutoParserEnabled(Boolean(result.autoParserEnabled), 'document-start');
}).catch(() => {
  browser.runtime.sendMessage({ action: 'getAutoParserState' }).then((response: any) => {
    setAutoParserEnabled(response.state ?? false, 'background-state');
  });
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.autoParserEnabled) {
    setAutoParserEnabled(Boolean(changes.autoParserEnabled.newValue), 'storage-change');
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    startAutoParseObserver();
    scheduleAutoParse('dom-content-loaded');
  }, { once: true });
} else {
  startAutoParseObserver();
  scheduleAutoParse('already-interactive');
}

window.addEventListener('load', () => scheduleAutoParse('load'), { once: true });
window.addEventListener('pageshow', () => scheduleAutoParse('pageshow'), { once: true });

document.addEventListener('readystatechange', () => {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    scheduleAutoParse(`ready-state-${document.readyState}`);
  }
});

window.addEventListener('popstate', () => queueAutoParse('history-navigation'));
window.addEventListener('hashchange', () => queueAutoParse('hash-navigation'));
