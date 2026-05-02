import browser from 'webextension-polyfill';
import { SecretScanProgress } from '../../constants/secret_types';
import { URLParserStorageWithOptionalCurrent, URLParserStorageItem } from './parser.types';
import { SecretScanner } from './secret.scanner';
import { StorageService } from './storage.service';

interface SecretScanTask {
  type: 'page' | 'javascript';
  webpageKey: string;
  encodedURL: string;
  url: string;
  capturedURLs: string[];
}

const SECRET_SCAN_PROGRESS_KEY = 'secretScanProgress';
const FETCH_TIMEOUT = 10000;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pauseForUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function fetchTextWithTimeout(url: string, controller: AbortController): Promise<string> {
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function buildScanText(content: string, capturedURLs: string[]): string {
  if (capturedURLs.length === 0) {
    return content;
  }

  return `${content}\n${capturedURLs.join('\n')}`;
}

export class SecretScanService {
  private running = false;
  private stopRequested = false;
  private activeFetchController: AbortController | null = null;

  async scanCapturedURLs(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopRequested = false;

    try {
      const startedAt = new Date().toISOString();

      await this.updateProgress({
        running: true,
        total: 0,
        completed: 0,
        failed: 0,
        current: 'Starting secret scan',
        startedAt,
      });

      const tasks = await this.getScanTasks();
      await browser.storage.local.set({
        'SECRET-PARSER': {},
        secretCount: 0,
      });

      let completed = 0;
      let failed = 0;

      await this.updateProgress({
        running: true,
        total: tasks.length,
        completed,
        failed,
        current: tasks.length > 0 ? 'Preparing secret scan' : 'No captured URLs to scan',
        startedAt,
      });

      for (const task of tasks) {
        if (this.stopRequested) {
          break;
        }

        await this.updateProgress({
          running: true,
          total: tasks.length,
          completed,
          failed,
          current: task.url,
          startedAt,
        });

        try {
          const content = await this.getTaskContent(task);

          if (this.stopRequested) {
            break;
          }

          const secrets = SecretScanner.scan(buildScanText(content, task.capturedURLs));

          if (task.type === 'page') {
            await StorageService.savePageSecrets(task.webpageKey, secrets);
          } else {
            await StorageService.saveJSFileSecretsForPage(task.webpageKey, task.encodedURL, secrets);
          }
        } catch (error) {
          if (this.stopRequested) {
            break;
          }

          failed += 1;
          console.error('Secret scan failed for URL:', task.url, error);
        }

        if (this.stopRequested) {
          break;
        }

        completed += 1;
        await this.updateProgress({
          running: true,
          total: tasks.length,
          completed,
          failed,
          current: task.url,
          startedAt,
        });
        await pauseForUI();
      }

      await this.updateProgress({
        running: false,
        total: tasks.length,
        completed,
        failed,
        current: this.stopRequested ? 'Secret scan stopped' : 'Secret scan complete',
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.updateProgress({
        running: false,
        total: 0,
        completed: 0,
        failed: 0,
        current: 'Secret scan failed',
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeFetchController = null;
      this.running = false;
      this.stopRequested = false;
    }
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.stopRequested = true;
    this.activeFetchController?.abort();
  }

  async getProgress(): Promise<SecretScanProgress> {
    const result = await browser.storage.local.get(SECRET_SCAN_PROGRESS_KEY);
    return (result[SECRET_SCAN_PROGRESS_KEY] as SecretScanProgress | undefined) || {
      running: false,
      total: 0,
      completed: 0,
      failed: 0,
      current: '',
    };
  }

  private async getScanTasks(): Promise<SecretScanTask[]> {
    const result = await browser.storage.local.get('URL-PARSER');
    const urlParser = (result['URL-PARSER'] as URLParserStorageWithOptionalCurrent) || {};
    const tasks: SecretScanTask[] = [];

    Object.entries(urlParser).forEach(([webpageKey, value]) => {
      if (webpageKey === 'current' || typeof value === 'string' || value === undefined) {
        return;
      }

      const item = value as URLParserStorageItem;
      const webpageURL = safeDecodeURIComponent(webpageKey);

      tasks.push({
        type: 'page',
        webpageKey,
        encodedURL: webpageKey,
        url: webpageURL,
        capturedURLs: item.currPage.map((endpoint) => endpoint.url),
      });

      Object.entries(item.externalJSFiles).forEach(([encodedJSURL, endpoints]) => {
        tasks.push({
          type: 'javascript',
          webpageKey,
          encodedURL: encodedJSURL,
          url: safeDecodeURIComponent(encodedJSURL),
          capturedURLs: endpoints.map((endpoint) => endpoint.url),
        });
      });
    });

    return tasks;
  }

  private async getTaskContent(task: SecretScanTask): Promise<string> {
    if (task.type === 'page' && task.url === document.location.href) {
      return document.documentElement?.outerHTML || document.body?.outerHTML || '';
    }

    this.activeFetchController = new AbortController();

    try {
      return await fetchTextWithTimeout(task.url, this.activeFetchController);
    } finally {
      this.activeFetchController = null;
    }
  }

  private async updateProgress(progress: SecretScanProgress): Promise<void> {
    await browser.storage.local.set({ [SECRET_SCAN_PROGRESS_KEY]: progress });
  }
}
