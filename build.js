const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/browser.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'DataGrid',
  outfile: path.join(__dirname, 'dist/datagrid.js'),
  sourcemap: true,
  minify: false,
  treeShaking: false,
  external: [],
}).catch(() => process.exit(1));
