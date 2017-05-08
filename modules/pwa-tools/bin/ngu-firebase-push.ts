#!/usr/bin/env node_modules/.bin/ts-node

import minimist = require('minimist');
import * as fs from 'fs';

import {generateFbPushConfig, GenerateFbPushConfigArgs} from '../lib/firebase-push';

import {requiredArgs} from '../lib/common/args';
import {toAbsolute} from '../lib/common/util';

const args = minimist(process.argv.slice(2), {
  string: ['module', 'base-href', 'dist', 'lazy-root', 'index', 'in', 'out'],
});

requiredArgs(args, ['dist', 'module', 'lazy-root', 'index']);

const dist = toAbsolute(args['dist']);
const appModule = toAbsolute(args['module']);
const loadChildrenRoot = toAbsolute(args['lazy-root']);
const index = toAbsolute(args['index']);
const baseHref: string = args['base-href'] || '/';

let config: GenerateFbPushConfigArgs = {
  appModule,
  baseHref,
  dist,
  index,
  loadChildrenRoot,
};

if (args['in']) {
  config.config = toAbsolute(args['in']);
}

generateFbPushConfig(config)
  .then(config => JSON.stringify(config, null, 2))
  .then(config => {
    if (args['out']) {
      const out = toAbsolute(args['out']);
      fs.writeFileSync(out, config);
    } else {
      console.log(config);
    }
  });