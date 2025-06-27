declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
  interface Window {
    awsRum?: {
      recordEvent: (level: string, data: any) => void;
    };
  }
}

const isProd =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.MODE === 'production';

function sendRumEvent(level: string, message: string, data?: unknown) {
  if (typeof window !== 'undefined' && window.awsRum) {
    window.awsRum.recordEvent(level, {
      message,
      data,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

export const logger = {
  info: (message: string, data?: unknown) => {
    if (isProd && sendRumEvent('info', message, data)) return;
    console.log(`[INFO] ${message}`, data);
  },
  error: (message: string, data?: unknown) => {
    if (isProd && sendRumEvent('error', message, data)) return;
    console.error(`[ERROR] ${message}`, data);
  },
  warn: (message: string, data?: unknown) => {
    if (isProd && sendRumEvent('warn', message, data)) return;
    console.warn(`[WARN] ${message}`, data);
  },
  debug: (message: string, data?: unknown) => {
    if (isProd && sendRumEvent('debug', message, data)) return;
    console.debug(`[DEBUG] ${message}`, data);
  },
};
