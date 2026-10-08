// Serenis validation MVP — runtime configuration.
// Applications stay CLOSED (no data is sent anywhere) until BOTH `endpoint`
// and `contactEmail` are set. See README.md → "Go live".
window.SERENIS_CONFIG = {
  // Google Apps Script web-app URL (…/exec) from backend/Code.gs
  endpoint: "",
  // Public contact address for data-protection requests (required by GDPR Art. 13)
  contactEmail: "office@infinitylabz.org",
  controller: "LEX INC S.R.L.",
  // Optional but recommended: CUI and registered office of the controller
  controllerDetails: "CUI 52971871, cu sediul în Constanța, str. Unirii nr. 19B, România",
  // Prices (RON / person / confirmed date) randomly assigned per visit
  priceArms: [29, 39, 49],
};
