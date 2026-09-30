/* Build _browsercheck.html from the REAL index.html so the browser check runs
   against the real DOM and boot path. Regenerate after editing index.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (html.includes('browsercheck.js')) { console.log('already instrumented'); process.exit(0); }
const out = html.replace('</body>',
  '<div id="browsercheck-log" style="position:fixed;left:0;bottom:0;right:0;max-height:44vh;overflow:auto;'
  + 'background:rgba(0,0,0,.86);color:#c8f4ff;font:12px/1.45 monospace;padding:8px;z-index:9999;white-space:pre-wrap"></div>\n'
  + '<script src="test/browsercheck.js"></script>\n</body>');
fs.writeFileSync(path.join(root, '_browsercheck.html'), out);
console.log('wrote _browsercheck.html from index.html');
