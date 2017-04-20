import minimist = require('minimist');

import {requiredArgs} from '../lib/common/args';
import {generateAppShell, GenerateAppShellArgs} from '../lib/ng-pwa-shell';

const args = minimist(process.argv.slice(2), {
  string: ['module', 'index'],
});
requiredArgs(args, ['module', 'index']);

const {module, index} = args;

generateAppShell({
  appModule: module,
  index,
}).then(html => console.log(html));

