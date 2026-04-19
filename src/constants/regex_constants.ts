// Capture quoted relative paths and asset-like strings, including token placeholders such as `%s`.
export const REL_REGEX = /["']((\/|(\w+\/))[^"'`\s<>{}()]*)["']/g;
export const ABS_REGEX = /(https?:\/\/[^\s'"){}(]+)/g;
