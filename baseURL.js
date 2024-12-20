const production = false;
const baseURL = production
  ? "https://optimalmd-server.vercel.app"
  : "http://localhost:5000";
const lyricURL = production
  ? "https://clinic.optimal.md/go/api"
  : "https://staging.getlyric.com/go/api";
const authorizedDotNetURL = production
  ? "https://api.authorize.net"
  : "https://apitest.authorize.net";

// const frontendBaseURL = production ?  "https://optimalmd.vercel.app" : "http://localhost:5173"
const frontendBaseURL =  "https://optimalmd.vercel.app"

module.exports = {
  production,
  baseURL,
  lyricURL,
  authorizedDotNetURL,
  frontendBaseURL
};
