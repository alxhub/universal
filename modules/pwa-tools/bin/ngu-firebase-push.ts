#!/usr/bin/env node_modules/.bin/ts-node

import minimist = require('minimist');
import * as fs from 'fs';

import {generateFbPushConfig} from '../lib/firebase-push';

import {requiredArgs} from '../lib/common/args';
import {toAbsolute} from '../lib/common/util';

const args = minimist(process.argv.slice(2), {
  string: ['module', 'base-href', 'dist', 'lazy-root', 'index'],
});

requiredArgs(args, ['dist', 'module', 'lazy-root', 'index']);

const dist = toAbsolute(args['dist']);
const appModule = toAbsolute(args['module']);
const loadChildrenRoot = toAbsolute(args['lazy-root']);
const index = toAbsolute(args['index']);
const baseHref: string = args['base-href'] || '/';

generateFbPushConfig({appModule, baseHref, dist, index, loadChildrenRoot})
  .then(config => console.log(JSON.stringify(config, null, 2)));