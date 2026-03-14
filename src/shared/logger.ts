const IS_DEV = typeof process !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : !('update_url' in chrome.runtime.getManifest()); // no update_url = unpacked extension

const PREFIX = '[PlotArmor]';

export const logger = {
  log: (...args: unknown[]) => IS_DEV && console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => IS_DEV && console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args), // always log errors
  group: (label: string) => IS_DEV && console.group(`${PREFIX} ${label}`),
  groupEnd: () => IS_DEV && console.groupEnd(),
};
