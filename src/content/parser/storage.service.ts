import browser from 'webextension-polyfill';
import { URLParserStorageWithOptionalCurrent, URLParserStorageItem } from './parser.types';
import { URLClassification } from '../../background/classification/classifiers/classifier.types';
import { decode } from 'punycode';
import { shouldCaptureEndpoint } from '../../utils/endpointFilter';
import { SecretParserStorage, SecretParserStorageItem, StoredSecret } from '../../constants/secret_types';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export class StorageService {
  static async getConcurrencySetting(): Promise<number> {
    const result = await browser.storage.local.get('requests');
    return (result.requests as number) || 1;
  }

  static async isInScope(host: string): Promise<boolean> {
    const result = await browser.storage.local.get('scope');
    const scopes: string[] = result.scope as string[] || [];
    const baseDomain: string = host.split('.').slice(-2).join('.');
    return scopes.length === 0 || scopes.some(scope => 
      baseDomain === scope.toLowerCase() || host === scope.toLowerCase()
    );
  }

  static async saveToStorage(encodedURL: string, urls: string[]): Promise<void> {
    const result = await browser.storage.local.get('URL-PARSER');
    const urlParser = (result['URL-PARSER'] as URLParserStorageWithOptionalCurrent) || {};
    const currentURL = urlParser.current || '';
    const decodedURL = decodeURIComponent(encodedURL);
    
    if (!urlParser[currentURL]) {
      urlParser[currentURL] = { 
        currPage: [],
        externalJSFiles: {}
      };
    }
    
    if (!urlParser[currentURL].externalJSFiles) {
      urlParser[currentURL].externalJSFiles = {};
    }

    urlParser[currentURL].externalJSFiles[encodedURL] = urls
      .map(safeDecodeURIComponent)
      .filter(shouldCaptureEndpoint)
      .map(url => ({
        url,
        classifications: {} as URLClassification
      }));

    await browser.storage.local.set({ 'URL-PARSER': urlParser });
  }

  static async savePageSecrets(encodedPageURL: string, secrets: StoredSecret[]): Promise<void> {
    const result = await browser.storage.local.get('SECRET-PARSER');
    const secretParser = (result['SECRET-PARSER'] as SecretParserStorage) || {};

    if (!secretParser[encodedPageURL] || typeof secretParser[encodedPageURL] === 'string') {
      secretParser[encodedPageURL] = {
        currPage: [],
        externalJSFiles: {}
      };
    }

    const currentPageData = secretParser[encodedPageURL] as SecretParserStorageItem;
    currentPageData.currPage = this.mergeSecrets(currentPageData.currPage, secrets);
    secretParser.current = encodedPageURL;

    await browser.storage.local.set({ 'SECRET-PARSER': secretParser });
    await this.updateSecretCount(await this.countCurrentSecrets(secretParser));
  }

  static async saveJSFileSecrets(encodedURL: string, secrets: StoredSecret[]): Promise<void> {
    const result = await browser.storage.local.get('SECRET-PARSER');
    const secretParser = (result['SECRET-PARSER'] as SecretParserStorage) || {};
    const currentURL = secretParser.current || '';

    if (!currentURL) {
      return;
    }

    if (!secretParser[currentURL] || typeof secretParser[currentURL] === 'string') {
      secretParser[currentURL] = {
        currPage: [],
        externalJSFiles: {}
      };
    }

    const currentPageData = secretParser[currentURL] as SecretParserStorageItem;
    const existingSecrets = currentPageData.externalJSFiles[encodedURL] || [];
    currentPageData.externalJSFiles[encodedURL] = this.mergeSecrets(existingSecrets, secrets);

    await browser.storage.local.set({ 'SECRET-PARSER': secretParser });
    await this.updateSecretCount(await this.countCurrentSecrets(secretParser));
  }


  static async updateURLCount(count: number): Promise<void> {
    await browser.storage.local.set({ urlCount: count });
  }

  static async updateJSFileCount(count: number): Promise<void> {
    await browser.storage.local.set({ jsFileCount: count });
  }

  static async updateSecretCount(count: number): Promise<void> {
    await browser.storage.local.set({ secretCount: count });
  }

  private static mergeSecrets(existingSecrets: StoredSecret[], newSecrets: StoredSecret[]): StoredSecret[] {
    const bySecret = new Map<string, StoredSecret>();

    existingSecrets.forEach((secret) => {
      bySecret.set(this.getSecretDedupeKey(secret), secret);
    });

    newSecrets.forEach((secret) => {
      const key = this.getSecretDedupeKey(secret);
      if (!bySecret.has(key)) {
        bySecret.set(key, secret);
      }
    });

    return Array.from(bySecret.values());
  }

  private static getSecretDedupeKey(secret: StoredSecret): string {
    return `${secret.detectorId}:${secret.secret}`;
  }

  private static async countCurrentSecrets(secretParser: SecretParserStorage): Promise<number> {
    const currentURL = secretParser.current;
    if (!currentURL) {
      return 0;
    }

    const currentPageData = secretParser[currentURL];
    if (!currentPageData || typeof currentPageData === 'string') {
      return 0;
    }

    return currentPageData.currPage.length +
      Object.values(currentPageData.externalJSFiles).reduce((total, secrets) => total + secrets.length, 0);
  }
}
