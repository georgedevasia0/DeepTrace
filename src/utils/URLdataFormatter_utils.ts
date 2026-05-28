import browser from 'webextension-polyfill';
import { Endpoint, Location, Webpage, URLParserStorage, URLParserStorageItem } from '../constants/message_types';
import { shouldCaptureEndpoint, shouldCaptureSource, shouldCaptureWebpage } from './endpointFilter';

interface FormattedURLData {
  allEndpoints: Endpoint[];
  locations: Location[];
  webpages: Webpage[];
  hierarchy: {
    [webpage: string]: {
      mainPage: Endpoint[];
      jsFiles: {
        [jsFile: string]: Endpoint[];
      };
    };
  };
}

function mergeClassifications(
  first: Record<string, boolean>,
  second: Record<string, boolean>
): Record<string, boolean> {
  const merged = { ...first };

  Object.entries(second).forEach(([key, value]) => {
    merged[key] = Boolean(merged[key] || value);
  });

  return merged;
}

export async function formatURLData(): Promise<FormattedURLData> {
  const result = await browser.storage.local.get("URL-PARSER");
  const urlParserData = result["URL-PARSER"] as URLParserStorage;

  let allEndpoints: Endpoint[] = [];
  let locations: Location[] = [];
  let webpages: Webpage[] = [];
  let hierarchy: FormattedURLData['hierarchy'] = {};
  let captureIndex = 0;

  const buildUniqueEndpoints = (
    rawEndpoints: Array<{
      url: string;
      classifications: Record<string, boolean>;
    }>,
    foundAt: string,
    webpage: string
  ): Endpoint[] => {
    const uniqueByKey = new Map<string, Endpoint>();

    rawEndpoints.forEach((endpoint) => {
      if (!shouldCaptureEndpoint(endpoint.url)) {
        return;
      }

      const dedupeKey = `${foundAt}::${endpoint.url}`;
      const existing = uniqueByKey.get(dedupeKey);

      if (existing) {
        existing.classifications = mergeClassifications(
          existing.classifications,
          endpoint.classifications as Record<string, boolean>
        );
        return;
      }

      uniqueByKey.set(dedupeKey, {
        url: endpoint.url,
        foundAt,
        webpage,
        classifications: endpoint.classifications as Record<string, boolean>,
        captureIndex: ++captureIndex,
      });
    });

    return Array.from(uniqueByKey.values());
  };

  if (!urlParserData) {
    return {
      allEndpoints: [],
      locations: ['All'],
      webpages: ['All'],
      hierarchy: {}
    };
  }

  Object.entries(urlParserData).forEach(([key, value]) => {
    if (key !== "current" && typeof value !== 'string' && value !== undefined) {
      const webpage = decodeURIComponent(key);
      if (!shouldCaptureWebpage(webpage)) {
        return;
      }

      const item = value as URLParserStorageItem;
      
      locations.push(webpage);
      webpages.push(webpage);
      hierarchy[webpage] = { mainPage: [], jsFiles: {} };

      // Handle main page endpoints
      const mainPageEndpoints = buildUniqueEndpoints(
        item.currPage.map((endpoint) => ({
          url: endpoint.url,
          classifications: endpoint.classifications as unknown as Record<string, boolean>,
        })),
        webpage,
        webpage
      );
      allEndpoints.push(...mainPageEndpoints);
      hierarchy[webpage].mainPage = mainPageEndpoints;

      // Handle JS file endpoints
      Object.entries(item.externalJSFiles).forEach(([jsFile, endpoints]) => {
        const decodedJsFile = decodeURIComponent(jsFile);
        if (!shouldCaptureSource(decodedJsFile)) {
          return;
        }

        if (!locations.includes(decodedJsFile)) {
          locations.push(decodedJsFile);
        }
        
        const jsFileEndpoints = buildUniqueEndpoints(
          endpoints.map((endpoint) => ({
            url: endpoint.url,
            classifications: endpoint.classifications as unknown as Record<string, boolean>,
          })),
          decodedJsFile,
          webpage
        );
        allEndpoints.push(...jsFileEndpoints);
        hierarchy[webpage].jsFiles[decodedJsFile] = jsFileEndpoints;
      });
    }
  });

  const uniqueLocations = Array.from(new Set(['All', ...locations]));
  const uniqueWebpages = Array.from(new Set(['All', ...webpages]));

  return {
    allEndpoints,
    locations: uniqueLocations,
    webpages: uniqueWebpages,
    hierarchy
  };
}
