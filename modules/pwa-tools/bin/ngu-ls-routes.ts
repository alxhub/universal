#!/usr/bin/env node

require('ts-node/register');

import minimist = require('minimist');

import {requiredArgs} from '../lib/common/args';
import {toAbsolute} from '../lib/common/util';

import {lsRoutes} from '../lib/ls-routes';

const args = minimist(process.argv.slice(2), {
  string: ['module', 'lazy-root', 'base-href', 'output'],
});

requiredArgs(args, ['module', 'lazy-root']);

const appModule = toAbsolute(args['module'])
const loadChildrenRoot = toAbsolute(args['lazy-root']);
const baseHref: string = args['base-href'] || '/';
const output: string = args['output'] || 'text';

lsRoutes({appModule, baseHref, loadChildrenRoot})
  .then(routes => {
    switch (output) {
      case 'json':
        console.log(JSON.stringify(routes, null, 2));
        break;
      case 'text':
        routes.forEach(({terminal, matcher}) => {
          let suffix = '';
          console.log(`Route: ${terminal.path || '(empty path)'}`);
          if (matcher) {
            switch (matcher.match) {
              case 'exact':
                console.log('  (matches exactly)');
                break;
              case 'prefix':
                console.log('  (matches prefix)');
                break;
              case 'regex':
                console.log('  Regex:', matcher.pattern);
                break;
            }
          }
          if (terminal.loadChildren && terminal.loadChildren.length > 0) {
            terminal.loadChildren.forEach(loadChild => console.log(`  Lazy loads: ${loadChild}`));
          }
        });
        break;
      default:
        console.error(`Unknown output format: ${output}`);
        process.exit(1);
    }
  })
  .catch(err => {
    console.error('An error occurred while attempting to read routes', err);
    process.exit(1);
  });
