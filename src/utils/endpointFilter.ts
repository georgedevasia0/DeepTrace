const IGNORED_EXACT_ENDPOINTS = new Set(['/', '/*', '//', '/$', '/**/', '/#', 'MM/dd/yyyy', 'yyyy/MM/dd','Gyy/MM/dd','dd.MM.yyyy','yyyy.MM.dd','Gyy.MM.dd','multipart/mixed','https://js.foundation/','http://www.json.org/','n/a','/..']);

export function shouldCaptureEndpoint(endpoint: string): boolean {
  return !IGNORED_EXACT_ENDPOINTS.has(endpoint);
}

export function filterCapturedEndpoints(endpoints: Iterable<string>): string[] {
  return Array.from(endpoints).filter(shouldCaptureEndpoint);
}
