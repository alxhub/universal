import {ParsedArgs} from 'minimist';

export function requiredArgs(args: ParsedArgs, required: string[]): void {
  let allPresent = true;
  required.forEach(arg => {
    if (!args[arg]) {
      console.error(`Required flag --${arg} not set`);
      allPresent = false;
    }
  });
  if (!allPresent) {
    process.exit(1);
  }
}