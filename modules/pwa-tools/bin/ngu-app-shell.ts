#!/usr/bin/env node_modules/.bin/ts-node

import minimist = require('minimist');
import {requiredArgs} from '../lib/common/args';
import {toAbsolute} from '../lib/common/util';
import {generateAppShell, GenerateAppShellArgs} from '../lib/app-shell';
import * as fs from 'fs';

const args = minimist(process.argv.slice(2), {
  string: ['module', 'index', 'lazy-root', 'pre-module', 'out'],
});
requiredArgs(args, ['module', 'index', 'lazy-root']);

const appModule = toAbsolute(args['module']);
const index = toAbsolute(args['index']);
const loadChildrenRoot = toAbsolute(args['lazy-root']);

let shellArgs: GenerateAppShellArgs = {appModule, index, loadChildrenRoot};
if (args['pre-module']) {
  shellArgs.beforeAppModule = toAbsolute(args['pre-module']);
}

generateAppShell(shellArgs)
  .then(html => {
    if (args['out']) {
      const out = toAbsolute(args['out']);
      fs.writeFileSync(out, html);
    } else {
      console.log(html);
    }
  });
