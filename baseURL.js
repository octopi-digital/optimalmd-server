export const production = false;
export const baseURL= production ? "https://optimalmd-server.vercel.app" : "http://localhost:5000";
export const lyricURL= production ? "https://clinic.optimal.md/go/api" : "https://staging.getlyric.com/go/api";
export const authorizedDotNetURL = production ? "https://api.authorize.net" : "https://apitest.authorize.net";