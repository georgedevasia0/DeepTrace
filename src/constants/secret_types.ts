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

export interface SecretScanProgress {
  running: boolean;
  total: number;
  completed: number;
  failed: number;
  current: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
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
