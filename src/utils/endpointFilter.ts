const IGNORED_EXACT_ENDPOINTS = new Set(['/', '/*', '//', '/$', '/**/', '/#', 'MM/dd/yyyy', 'yyyy/MM/dd','Gyy/MM/dd','dd.MM.yyyy','yyyy.MM.dd','Gyy.MM.dd','multipart/mixed','https://js.foundation/','http://www.json.org/','n/a','/..','//google-analytics.com','//googletagmanager.com']);
const IGNORED_ENDPOINT_PREFIXES = ['audio/', 'image/','jquery.','text/','video/','application/','http://www.w3.org/','http://jqueryui.com/','https://jquery.com/','https://jquery.org/','javascript:','https://www.googletagmanager.com','https://www.gstatic.com/'];
const IGNORED_ENDPOINT_SUFFIXES = ['.css'];

export function shouldCaptureEndpoint(endpoint: string): boolean {
  return (
    !IGNORED_EXACT_ENDPOINTS.has(endpoint) &&
    !IGNORED_ENDPOINT_PREFIXES.some(prefix => endpoint.startsWith(prefix)) &&
    !IGNORED_ENDPOINT_SUFFIXES.some(suffix => endpoint.endsWith(suffix))
  );
}

export function filterCapturedEndpoints(endpoints: Iterable<string>): string[] {
  return Array.from(endpoints).filter(shouldCaptureEndpoint);
}
