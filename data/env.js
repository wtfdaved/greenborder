// ============================================
// PUBLIC RUNTIME CONFIG
// ============================================
// Loaded before the data services so window.ENV is available everywhere
// credentials are looked up (airtableSync, dispensaries-config).
//
// NOTE: everything in this file ships to every visitor's browser. The
// Airtable token below must stay a READ-ONLY personal access token scoped
// to the dispensary base only (data.records:read). Never put a token with
// write access or broader base access here.
//
// A host-injected window.ENV (set by a <script> before this one) takes
// precedence over these defaults.
window.ENV = Object.assign(
  {
    AIRTABLE_API_KEY: 'patbOUnX9WVkiLdBW.a3842b45bb4add2d41f8d72ed89e7d9fc8efdb56027a442764c71ebe4e0cfad9'
  },
  window.ENV || {}
);
