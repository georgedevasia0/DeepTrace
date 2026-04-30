export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface StoredSecret {
  detectorId: string;
  detectorName: string;
  secret: string;
  context: string;
  lineNumber: number;
  confidence: number;
  severity: SecretSeverity;
  firstSeenAt: string;
}

export interface SecretFinding extends StoredSecret {
  foundAt: string;
  webpage: string;
  sourceType: 'page' | 'javascript';
  captureIndex: number;
}

export interface SecretParserStorageItem {
  currPage: StoredSecret[];
  externalJSFiles: {
    [key: string]: StoredSecret[];
  };
}

export type SecretParserStorage = {
  [key: string]: SecretParserStorageItem | string | undefined;
  current?: string;
};

