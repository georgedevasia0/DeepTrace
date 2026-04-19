// Capture quoted relative paths and asset-like strings, including token placeholders such as `%s`.
export const REL_REGEX = /["']((\/|(\w+\/))[^"'`\s<>{}()]*)["']/g;
export const ABS_REGEX = /(https?:\/\/[^\s'"){}(]+)/g;
// Capture quoted bare domains/hostnames such as `.chemistwarehouse.com.au`, `translate.googleusercontent.com`, and `localhost`.
export const DOMAIN_REGEX = /["']((?:\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)|(?:[a-z0-9-]+(?:\.[a-z0-9-]+){2,})|(?:localhost))(?:["'])/gi;
