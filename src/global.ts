// IIFE entry for the <script src="toolbar.global.js"> distribution: expose the API on
// window.Alkahest and auto-init from the script tag's data attributes.
import { autoInit, init } from "./index";

declare global {
  interface Window {
    Alkahest: { init: typeof init };
  }
}

window.Alkahest = { init };
autoInit();
