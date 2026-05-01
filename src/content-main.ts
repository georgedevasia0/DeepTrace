import browser from 'webextension-polyfill';
import { Parser } from './content/urlParser';
import { Message, MessageResponse } from './constants/message_types';

let isAutoParserEnabled = false;
const parser = new Parser();

function scheduleAutoParse(reason: string): void {
  if (!isAutoParserEnabled) {
    return;
  }

  parser.parseURLs().catch((error) => {
    console.error(`Auto parser failed during ${reason}:`, error);
  });
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
    case 'getSecretScanProgress':
      parser.getSecretScanProgress().then(details => typedSendResponse({ success: true, details }));
      break;
    case 'getAutoParserState':
      typedSendResponse({ success: true, state: isAutoParserEnabled });
      break;
    case 'setAutoParserState':
      isAutoParserEnabled = typedMessage.state ?? false;
      if (isAutoParserEnabled) {
        scheduleAutoParse('toggle');
      }
      typedSendResponse({ success: true });
      break;
    case 'autoParserStateChanged':
      isAutoParserEnabled = typedMessage.state ?? false;
      if (isAutoParserEnabled) {
        parser.parseURLs().then(() => typedSendResponse({ success: true }));
      } else {
        typedSendResponse({ success: true });
      }
      break;
    case 'checkContentScriptInjected':
      typedSendResponse({ success: true });
      break;
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
  isAutoParserEnabled = Boolean(result.autoParserEnabled);
  scheduleAutoParse('document-start');
}).catch(() => {
  browser.runtime.sendMessage({ action: 'getAutoParserState' }).then((response: any) => {
    isAutoParserEnabled = response.state ?? false;
    scheduleAutoParse('background-state');
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scheduleAutoParse('dom-content-loaded'), { once: true });
} else {
  scheduleAutoParse('already-interactive');
}

window.addEventListener('load', () => scheduleAutoParse('load'), { once: true });
window.addEventListener('pageshow', () => scheduleAutoParse('pageshow'), { once: true });

document.addEventListener('readystatechange', () => {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    scheduleAutoParse(`ready-state-${document.readyState}`);
  }
});
