const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'DataGrid',
  outfile: path.join(__dirname, 'dist/datagrid.esm.js'),
  sourcemap: true,
  minify: false,
}).catch(() => process.exit(1));
