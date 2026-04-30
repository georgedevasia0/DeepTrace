import { useEffect, useMemo, useState } from 'react';
import browser from 'webextension-polyfill';
import { SecretFinding } from '../constants/secret_types';
import { formatSecretData } from '../utils/secretDataFormatter_utils';

export function useSecretData(
  selectedLocation: string,
  selectedWebpage: string,
  searchQuery: string,
  severityFilter: string,
  sortOption: string
) {
  const [secrets, setSecrets] = useState<SecretFinding[]>([]);
  const [locations, setLocations] = useState<string[]>(['All']);
  const [webpages, setWebpages] = useState<string[]>(['All']);

  useEffect(() => {
    const fetchData = async () => {
      const { allSecrets, locations: nextLocations, webpages: nextWebpages } = await formatSecretData();
      setSecrets(allSecrets);
      setLocations(nextLocations);
      setWebpages(nextWebpages);
    };

    fetchData();

    const handleStorageChange = (changes: { [key: string]: browser.Storage.StorageChange }) => {
      if (changes['SECRET-PARSER']) {
        fetchData();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const filteredSecrets = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return secrets
      .filter((secret) => {
        const matchesLocation = selectedLocation === 'All' || secret.foundAt === selectedLocation;
        const matchesWebpage = selectedWebpage === 'All' || secret.webpage === selectedWebpage;
        const matchesSeverity = severityFilter === 'All' || secret.severity === severityFilter;
        const matchesQuery =
          secret.secret.toLowerCase().includes(query) ||
          secret.detectorName.toLowerCase().includes(query) ||
          secret.context.toLowerCase().includes(query) ||
          secret.foundAt.toLowerCase().includes(query);

        return matchesLocation && matchesWebpage && matchesSeverity && matchesQuery;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'confidence-desc':
            return b.confidence - a.confidence;
          case 'severity-desc':
            return severityWeight(b.severity) - severityWeight(a.severity);
          case 'captured-desc':
            return b.captureIndex - a.captureIndex;
          case 'source-asc':
            return a.foundAt.localeCompare(b.foundAt) || a.detectorName.localeCompare(b.detectorName);
          case 'captured-asc':
          default:
            return a.captureIndex - b.captureIndex;
        }
      });
  }, [secrets, selectedLocation, selectedWebpage, searchQuery, severityFilter, sortOption]);

  return {
    secrets,
    filteredSecrets,
    locations,
    webpages,
  };
}

function severityWeight(severity: SecretFinding['severity']): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

