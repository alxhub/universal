#!/usr/bin/env node_modules/.bin/ts-node

import minimist = require('minimist');
import * as fs from 'fs';

import {generateSwManifest} from '../lib/sw-manifest';

import {requiredArgs} from '../lib/common/args';
import {toAbsolute} from '../lib/common/util';

const args = minimist(process.argv.slice(2), {
  string: ['in', 'module', 'base-href', 'dist', 'lazy-root', 'index', 'out'],
});

requiredArgs(args, ['dist', 'module', 'lazy-root']);

const dist = toAbsolute(args['dist']);
const appModule = toAbsolute(args['module']);
const loadChildrenRoot = toAbsolute(args['lazy-root']);

const baseHref: string = args['base-href'] || '/';
const index = (baseHref.endsWith('/') ? baseHref : baseHref + '/') + (args['index'] || 'index.html');
const inFile: string|undefined = args['in'];

let manifest: string|undefined = undefined;
if (inFile) {
  manifest = toAbsolute(inFile);
}

generateSwManifest({
  appModule,
  baseHref,
  dist,
  index,
  loadChildrenRoot,
  manifest,
  routing: true,
  static: true,
})
  .then(manifest => JSON.stringify(manifest, null, 2))
  .then(manifest => {
    if (args['out']) {
      const out = toAbsolute(args['out']);
      fs.writeFileSync(out, manifest);
    } else {
      console.log(manifest);
    }
  });
