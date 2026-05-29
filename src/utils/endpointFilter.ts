import type { Endpoint } from '../constants/message_types';

const IGNORED_EXACT_ENDPOINTS = new Set(['/', '/*', '//', '/$', '/**/', '/#', 'MM/dd/yyyy', 'yyyy/MM/dd','Gyy/MM/dd','dd.MM.yyyy','yyyy.MM.dd','Gyy.MM.dd','multipart/mixed','https://js.foundation/','http://www.json.org/','n/a','/..','//google-analytics.com','//googletagmanager.com']);
const IGNORED_ENDPOINT_PREFIXES = ['audio/', 'image/','jquery.','text/','video/','application/','http://www.w3.org/','http://jqueryui.com/','https://jquery.com/','https://jquery.org/','javascript:','https://www.googletagmanager.com','https://www.gstatic.com/','Asia/','America/','Europe/','Africa/','Australia/','Antarctica/','Pacific/','Atlantic/','Arctic/','Etc/'];
const IGNORED_ENDPOINT_SUFFIXES = ['.css','set_cookie?','.woff2','.svg'];
const IGNORED_SOURCE_PREFIXES = ['https://www.googletagmanager.com'];
const IGNORED_WEBPAGE_SUBSTRINGS = ['bugcrowd.com'];

export function normalizeEndpointForDedupe(endpoint: string): string {
  return endpoint.trim();
}

export function getEndpointDedupeKey(endpoint: Pick<Endpoint, 'url'> | string): string {
  return normalizeEndpointForDedupe(typeof endpoint === 'string' ? endpoint : endpoint.url);
}

export function shouldCaptureEndpoint(endpoint: string): boolean {
  const normalizedEndpoint = normalizeEndpointForDedupe(endpoint);

  return (
    !IGNORED_EXACT_ENDPOINTS.has(normalizedEndpoint) &&
    !IGNORED_ENDPOINT_PREFIXES.some(prefix => normalizedEndpoint.startsWith(prefix)) &&
    !IGNORED_ENDPOINT_SUFFIXES.some(suffix => normalizedEndpoint.endsWith(suffix))
  );
}

export function shouldCaptureSource(source: string): boolean {
  return !IGNORED_SOURCE_PREFIXES.some(prefix => source.startsWith(prefix));
}

export function shouldCaptureWebpage(webpage: string): boolean {
  const normalizedWebpage = webpage.toLowerCase();
  return !IGNORED_WEBPAGE_SUBSTRINGS.some(substring => normalizedWebpage.includes(substring));
}

export function filterCapturedEndpoints(endpoints: Iterable<string>): string[] {
  return Array.from(endpoints).filter(shouldCaptureEndpoint);
}
