// src/constants/index.ts

export const VISIBLE_URL_SIZE = 100;

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'OPTIONS'] as const;

export const FETCH_TIMEOUT = 5000; // 5 seconds

export const DEBOUNCE_DELAY = 300; // 300 milliseconds

export const MODAL_NAMES = {
    generateReport: 'generateReport',
    viewCode: 'viewCode',
    seeResponse: 'seeResponse',
  } as const;

export const LOCAL_STORAGE_KEYS = {
  URL_PARSER: 'URL-PARSER',
} as const;

export const CSS_CLASSES = {
  BUTTON: 'px-4 py-2 bg-black text-white rounded hover:bg-blue-600',
  INPUT: 'px-2 border-2 border-gray-300 bg-transparent text-lg w-full pb-3 pt-3 rounded-md cursor-pointer text-gray-300 hover:border-gray-500 outline-none focus:border-gray-500 transition-all duration-400',
  MODAL_OVERLAY: 'fixed inset-0 flex items-center justify-center bg-[#141e24] bg-opacity-50',
  MODAL_CONTENT: 'bg-[#141e24] opacity-85 p-5 rounded-lg shadow-lg',
  API_ENDPOINT: 'inline-flex items-center rounded-full border border-[#1f5b4b] bg-[linear-gradient(135deg,#10342d,#16453b)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8de0c4]',
  URL_DATA_ACCESS: 'inline-flex items-center rounded-full border border-[#244b68] bg-[linear-gradient(135deg,#102b3b,#183e55)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86c9f5]',
  DATABASE_OPERATION: 'inline-flex items-center rounded-full border border-[#58408b] bg-[linear-gradient(135deg,#2b1d49,#3b2962)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c8b1ff]',
  SENSITIVE_DATA: 'inline-flex items-center rounded-full border border-[#7a3d4a] bg-[linear-gradient(135deg,#3d1921,#562530)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb4c1]',
  UNSECURED_API: 'inline-flex items-center rounded-full border border-[#87403f] bg-[linear-gradient(135deg,#481b1a,#632a28)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb3a8]',
  AUTHENTICATION_ENDPOINT: 'inline-flex items-center rounded-full border border-[#28587f] bg-[linear-gradient(135deg,#143351,#1b476e)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a8dbff]',
  DATA_TRANSFER: 'inline-flex items-center rounded-full border border-[#8a6a1b] bg-[linear-gradient(135deg,#46370d,#614c12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffe08a]',
  ADMIN_PANEL: 'inline-flex items-center rounded-full border border-[#2d6a45] bg-[linear-gradient(135deg,#163625,#1f4a32)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9fe0b8]',
  PAYMENT_PROCESSING: 'inline-flex items-center rounded-full border border-[#4a6282] bg-[linear-gradient(135deg,#243449,#334863)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#bfd5f1]',
  FILE_ACCESS: 'inline-flex items-center rounded-full border border-[#8a4d29] bg-[linear-gradient(135deg,#4a2612,#64361c)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffc39a]',
  LEGACY_ENDPOINT: 'inline-flex items-center rounded-full border border-[#56616f] bg-[linear-gradient(135deg,#2c333b,#404b56)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4dde7]',
  DYNAMIC_CONTENT: 'inline-flex items-center rounded-full border border-[#6f3a85] bg-[linear-gradient(135deg,#351848,#4d2465)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e1b8ff]',
  WEBSOCKET: 'inline-flex items-center rounded-full border border-[#7c6b25] bg-[linear-gradient(135deg,#41370f,#584b16)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f3e199]',
  INTERNAL_NETWORK: 'inline-flex items-center rounded-full border border-[#4d6b37] bg-[linear-gradient(135deg,#293616,#374a20)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#caea9a]',
  THIRD_PARTY_INTEGRATION: 'inline-flex items-center rounded-full border border-[#4f73b7] bg-[linear-gradient(135deg,#2a3f6d,#3c5a97)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4e1ff]',
  DEBUG_ENDPOINT: 'inline-flex items-center rounded-full border border-[#64727f] bg-[linear-gradient(135deg,#313840,#434f59)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d7e0e7]',
  POTENTIALLY_VULNERABLE: 'inline-flex items-center rounded-full border border-[#8a4b3f] bg-[linear-gradient(135deg,#4a221c,#673028)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffc1b2]',
  PARAMETERIZED_ENDPOINT: 'inline-flex items-center rounded-full border border-[#9a611f] bg-[linear-gradient(135deg,#52310d,#714314)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffd089]',
  NON_STANDARD_PORT: 'inline-flex items-center rounded-full border border-[#7b3636] bg-[linear-gradient(135deg,#421616,#5b2222)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb0b0]',
  BASE64_ENCODED_SEGMENT: 'inline-flex items-center rounded-full border border-[#426f9a] bg-[linear-gradient(135deg,#1c3951,#27506f)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#aad9ff]'
} as const;

export const FILTER_CATEGORIES = {
  API_ENDPOINT: "text-green-500",
  URL_DATA_ACCESS: "text-blue-500",
  DATABASE_OPERATION: "text-purple-500",
  SENSITIVE_DATA: "text-red-500",
  UNSECURED_API: "text-red-600",
  AUTHENTICATION_ENDPOINT: "text-blue-900",
  DATA_TRANSFER: "text-yellow-500",
  ADMIN_PANEL: "text-green-700",
  PAYMENT_PROCESSING: "text-indigo-700",
  FILE_ACCESS: "text-orange-600",
  LEGACY_ENDPOINT: "text-gray-500",
  DYNAMIC_CONTENT: "text-purple-700",
  WEBSOCKET: "text-yellow-800",
  INTERNAL_NETWORK: "text-green-600",
  THIRD_PARTY_INTEGRATION: "text-blue-400",
  DEBUG_ENDPOINT: "text-gray-600",
  POTENTIALLY_VULNERABLE: "text-orange-700",
  PARAMETERIZED_ENDPOINT: "text-orange-600",
  NON_STANDARD_PORT: "text-red-800",
  BASE64_ENCODED_SEGMENT: "text-blue-600",
};

export enum ClassificationType {
  API_ENDPOINT = 'API_ENDPOINT',
  URL_DATA_ACCESS = 'URL_DATA_ACCESS',
  DATABASE_OPERATION = 'DATABASE_OPERATION',
  SENSITIVE_DATA = 'SENSITIVE_DATA',
  UNSECURED_API = 'UNSECURED_API',
  AUTHENTICATION_ENDPOINT = 'AUTHENTICATION_ENDPOINT',
  DATA_TRANSFER = 'DATA_TRANSFER',
  ADMIN_PANEL = 'ADMIN_PANEL',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  FILE_ACCESS = 'FILE_ACCESS',
  LEGACY_ENDPOINT = 'LEGACY_ENDPOINT',
  DYNAMIC_CONTENT = 'DYNAMIC_CONTENT',
  WEBSOCKET = 'WEBSOCKET',
  INTERNAL_NETWORK = 'INTERNAL_NETWORK',
  THIRD_PARTY_INTEGRATION = 'THIRD_PARTY_INTEGRATION',
  DEBUG_ENDPOINT = 'DEBUG_ENDPOINT',
  POTENTIALLY_VULNERABLE = 'POTENTIALLY_VULNERABLE',
  PARAMETERIZED_ENDPOINT = 'PARAMETERIZED_ENDPOINT',
  NON_STANDARD_PORT = 'NON_STANDARD_PORT',
  BASE64_ENCODED_SEGMENT = 'BASE64_ENCODED_SEGMENT'
}

export const ClassificationMapping: Record<string, ClassificationType> = {
  isAPIEndpoint: ClassificationType.API_ENDPOINT,
  isUserDataAccess: ClassificationType.URL_DATA_ACCESS,
  isDatabaseOperation: ClassificationType.DATABASE_OPERATION,
  isSensitiveData: ClassificationType.SENSITIVE_DATA,
  isUnsecuredAPI: ClassificationType.UNSECURED_API,
  isAuthEndpoint: ClassificationType.AUTHENTICATION_ENDPOINT,
  isDataTransfer: ClassificationType.DATA_TRANSFER,
  isAdminPanel: ClassificationType.ADMIN_PANEL,
  isPaymentProcessing: ClassificationType.PAYMENT_PROCESSING,
  isFileAccess: ClassificationType.FILE_ACCESS,
  isLegacyEndpoint: ClassificationType.LEGACY_ENDPOINT,
  isDynamicContent: ClassificationType.DYNAMIC_CONTENT,
  isWebSocket: ClassificationType.WEBSOCKET,
  isInternalNetwork: ClassificationType.INTERNAL_NETWORK,
  isThirdPartyIntegration: ClassificationType.THIRD_PARTY_INTEGRATION,
  isDebugEndpoint: ClassificationType.DEBUG_ENDPOINT,
  isPotentiallyVulnerable: ClassificationType.POTENTIALLY_VULNERABLE,
  isParameterizedEndpoint: ClassificationType.PARAMETERIZED_ENDPOINT,
  isNonStandardPort: ClassificationType.NON_STANDARD_PORT,
  isBase64EncodedSegment: ClassificationType.BASE64_ENCODED_SEGMENT
};
