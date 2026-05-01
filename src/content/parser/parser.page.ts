import { REL_REGEX, ABS_REGEX, DOMAIN_REGEX } from '../../constants/regex_constants';
import { StorageService } from './storage.service';
import browser from 'webextension-polyfill';
import { URLParserStorageWithOptionalCurrent } from './parser.types';
import { URLClassification } from '../../background/classification/classifiers/classifier.types';
import { filterCapturedEndpoints } from '../../utils/endpointFilter';

export class PageParser {
  async parseCurrentPage(): Promise<Set<string>> {
    const pageContent = document.documentElement?.outerHTML || document.body?.outerHTML || '';
    const abPageURLs = Array.from(pageContent.matchAll(ABS_REGEX), match => match[1]);
    const relPageURLs = Array.from(pageContent.matchAll(REL_REGEX), match => match[1]);
    const pageDomains = Array.from(pageContent.matchAll(DOMAIN_REGEX), match => match[1]);
    const pageURLs = new Set(filterCapturedEndpoints([...abPageURLs, ...relPageURLs, ...pageDomains]));

    const currPage = encodeURIComponent(document.location.href);
    const mergedURLCount = await this.saveToBrowser(currPage, pageURLs);
    await StorageService.updateURLCount(mergedURLCount);

    return pageURLs;
  }

  private async saveToBrowser(currPage: string, pageURLs: Set<string>): Promise<number> {
    const result = await browser.storage.local.get('URL-PARSER');
    const urlParser = (result['URL-PARSER'] as URLParserStorageWithOptionalCurrent) || {};
    
    if (!urlParser[currPage]) {
      urlParser[currPage] = {
        currPage: Array.from(pageURLs).map(url => ({
          url,
          classifications: {} as URLClassification
        })),
        externalJSFiles: {}
      };
    }

    const existingPageData = urlParser[currPage];
    const existingURLs = Array.isArray(existingPageData?.currPage) ? existingPageData.currPage : [];
    const urlsByValue = new Map(existingURLs.map((entry) => [entry.url, entry]));

    Array.from(pageURLs).forEach((url) => {
      if (!urlsByValue.has(url)) {
        urlsByValue.set(url, {
          url,
          classifications: {} as URLClassification
        });
      }
    });

    urlParser[currPage].currPage = Array.from(urlsByValue.values());
    urlParser.current = currPage;
    await browser.storage.local.set({ 'URL-PARSER': urlParser });
    return urlParser[currPage].currPage.length;
  }

  getScriptFiles(): string[] {
    const scriptTags = document.getElementsByTagName('script');
    return Array.from(scriptTags).filter(script => script.src).map(script => script.src);
  }

  setupScriptObserver(onNewScripts: (newScripts: string[]) => void): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedScripts = Array.from(mutation.addedNodes)
            .filter((node): node is HTMLScriptElement => 
              node.nodeName === 'SCRIPT' && 
              node instanceof HTMLScriptElement && 
              node.src !== ''
            )
            .map(script => script.src);
          
          if (addedScripts.length > 0) {
            onNewScripts(addedScripts);
          }
        }
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    return observer;
  }
}
