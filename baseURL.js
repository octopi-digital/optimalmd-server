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

module.exports = {
  production,
  baseURL,
  lyricURL,
  authorizedDotNetURL,
};
