/**
 * Site-only settings (separate from the product catalog in store.js).
 *
 * Enquiry forms use Web3Forms (https://web3forms.com): create a free access key
 * for the inbox that should receive submissions (e.g. tanvitindustrialsolutions@gmail.com),
 * paste it below, then redeploy or refresh the site.
 */
window.TanvitSiteConfig = {
  web3formsAccessKey: "d180b514-75a7-40ed-8334-161b95cf046c",
  // Leave empty when the public site and Node server share the same origin (default: npm start).
  // Only set if catalog is served from another URL (advanced split-host setups).
  catalogUrl: "",
  // Production should keep this false.
  // Set true in test/staging when you want to show operations notice in shop.
  showOpsNotice: false,
  // When true, all product prices are hidden site-wide (quote-only mode).
  hideAllPrices: true
};
