import { useState, useEffect, useMemo } from 'react';
import { Endpoint, Location, Webpage } from '../constants/message_types';
import { formatURLData } from '../utils/URLdataFormatter_utils';
import browser from 'webextension-polyfill';
import { ClassificationMapping } from '../constants/defaultview_contants';

function getEndpointDedupeKey(endpoint: Endpoint): string {
  return `${endpoint.foundAt}::${endpoint.url}`;
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

function dedupeEndpointsBySource(endpoints: Endpoint[]): Endpoint[] {
  const uniqueBySource = new Map<string, Endpoint>();

  endpoints.forEach((endpoint) => {
    const dedupeKey = getEndpointDedupeKey(endpoint);
    const existing = uniqueBySource.get(dedupeKey);

    if (existing) {
      existing.classifications = mergeClassifications(existing.classifications, endpoint.classifications);
      existing.captureIndex = Math.min(existing.captureIndex, endpoint.captureIndex);
      return;
    }

    uniqueBySource.set(dedupeKey, { ...endpoint });
  });

  return Array.from(uniqueBySource.values());
}

export function useURLData(
  selectedLocation: string,
  selectedWebpage: string,
  searchQuery: string,
  _startIndex: number,
  _visibleUrlSize: number,
  selectedCategories: Record<string, boolean>,
  sortOption: string,
) {
  const [urls, setURLs] = useState<Endpoint[]>([]);
  const [jsFiles, setJSFiles] = useState<Location[]>([]);
  const [webpages, setWebpages] = useState<Location[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { allEndpoints, locations, webpages } = await formatURLData();
      setURLs(allEndpoints);
      setJSFiles(locations);
      setWebpages(webpages);
    };

    fetchData();

    const handleStorageChange = (changes: { [key: string]: browser.Storage.StorageChange }) => {
      if (changes["URL-PARSER"]) {
        fetchData();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const filteredURLs = useMemo(() => {
    const filtered = urls.filter(endpoint => {
      const matchesLocation = selectedLocation === 'All' || endpoint.foundAt === selectedLocation;
      const matchesWebpage = selectedWebpage === 'All' || endpoint.webpage === selectedWebpage;
      const matchesQuery = endpoint.url.toLowerCase().includes(searchQuery.toLowerCase());

      // Updated category matching logic
      const matchesCategories = Object.keys(selectedCategories).some(category => {
        if (!selectedCategories[category]) return false;
        
        // Find the classification key that maps to this category
        const classificationKey = Object.entries(ClassificationMapping)
          .find(([_, value]) => value === category)?.[0];
        
        return classificationKey ? endpoint.classifications[classificationKey] : true;
      });

      return matchesLocation && matchesQuery && matchesWebpage && (matchesCategories || Object.values(selectedCategories).every(value => value));
    });

    return dedupeEndpointsBySource(filtered).sort((a, b) => {
      switch (sortOption) {
        case 'captured-asc':
          return a.captureIndex - b.captureIndex;
        case 'captured-desc':
          return b.captureIndex - a.captureIndex;
        case 'url-desc':
          return b.url.localeCompare(a.url);
        case 'source-asc':
          return a.foundAt.localeCompare(b.foundAt) || a.url.localeCompare(b.url);
        case 'source-desc':
          return b.foundAt.localeCompare(a.foundAt) || a.url.localeCompare(b.url);
        case 'webpage-asc':
          return a.webpage.localeCompare(b.webpage) || a.url.localeCompare(b.url);
        case 'webpage-desc':
          return b.webpage.localeCompare(a.webpage) || a.url.localeCompare(b.url);
        case 'url-asc':
        default:
          return a.url.localeCompare(b.url);
      }
    });
  }, [urls, selectedLocation, selectedWebpage, searchQuery, selectedCategories, sortOption]);

  return {
    urls,
    jsFiles,
    filteredURLs,
    visibleUrls: filteredURLs,
    webpages,
    selectedCategories
  };
}
