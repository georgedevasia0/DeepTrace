import browser from 'webextension-polyfill';
import {
  SecretFinding,
  SecretParserStorage,
  SecretParserStorageItem,
  StoredSecret,
} from '../constants/secret_types';

interface FormattedSecretData {
  allSecrets: SecretFinding[];
  locations: string[];
  webpages: string[];
}

function buildFinding(
  secret: StoredSecret,
  foundAt: string,
  webpage: string,
  sourceType: SecretFinding['sourceType'],
  captureIndex: number
): SecretFinding {
  return {
    ...secret,
    foundAt,
    webpage,
    sourceType,
    captureIndex,
  };
}

export async function formatSecretData(): Promise<FormattedSecretData> {
  const result = await browser.storage.local.get('SECRET-PARSER');
  const secretParserData = result['SECRET-PARSER'] as SecretParserStorage | undefined;

  if (!secretParserData) {
    return {
      allSecrets: [],
      locations: ['All'],
      webpages: ['All'],
    };
  }

  const allSecrets: SecretFinding[] = [];
  const locations: string[] = [];
  const webpages: string[] = [];
  let captureIndex = 0;

  Object.entries(secretParserData).forEach(([key, value]) => {
    if (key === 'current' || typeof value === 'string' || value === undefined) {
      return;
    }

    const webpage = decodeURIComponent(key);
    const item = value as SecretParserStorageItem;
    locations.push(webpage);
    webpages.push(webpage);

    item.currPage.forEach((secret) => {
      allSecrets.push(buildFinding(secret, webpage, webpage, 'page', ++captureIndex));
    });

    Object.entries(item.externalJSFiles).forEach(([jsFile, secrets]) => {
      const decodedJsFile = decodeURIComponent(jsFile);
      locations.push(decodedJsFile);

      secrets.forEach((secret) => {
        allSecrets.push(buildFinding(secret, decodedJsFile, webpage, 'javascript', ++captureIndex));
      });
    });
  });

  return {
    allSecrets,
    locations: Array.from(new Set(['All', ...locations])),
    webpages: Array.from(new Set(['All', ...webpages])),
  };
}

