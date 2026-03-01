/**
 * @fileoverview Application footer with disclaimer text.
 */

import React from "react";

/**
 * Static footer displaying regulatory disclaimers.
 * F-028: Updated date disclaimer.
 * @returns {React.ReactElement}
 */
const Footer = React.memo(() => (
  <footer className="text-center text-xs text-gray-700 py-4 border-t border-gray-800 mt-6">
    <p>
      ⚠️ For educational and simulation purposes only. Not financial advice.
    </p>
    <p className="mt-1">
      Charge rates as of {new Date().getFullYear()} (post-Oct 2024 STT
      revision). Lot sizes per latest SEBI circulars. Verify with your broker.
    </p>
  </footer>
));

Footer.displayName = "Footer";

export default Footer;
