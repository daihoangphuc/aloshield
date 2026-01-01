// Auto-detect API URL if not set in production
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // In browser, check if we're on production domain
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('aloshield.phucndh.site') || host !== 'localhost') {
      // Assume backend is on same domain with /api prefix
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${host}${port}/api`;
    }
  }
  
  return "http://localhost:3001/api";
};

const getWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  
  // In browser, check if we're on production domain
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('aloshield.phucndh.site') || host !== 'localhost') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${host}${port}`;
    }
  }
  
  return "http://localhost:3001";
};

export const config = {
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
};

// Warn in console if using auto-detected URLs (helpful for debugging)
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL not set, using auto-detected:', config.apiUrl);
}




