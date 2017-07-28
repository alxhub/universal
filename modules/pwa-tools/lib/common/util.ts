import * as fs from 'fs';
import * as path from 'path';

function recursiveListDirHelper(dir: string, prefix: string): string[] {
  const entries = fs
    .readdirSync(dir)
    .map(entry => ({entry, isDir: fs.statSync(path.join(dir, entry)).isDirectory()}));
  return entries
    .filter(meta => !meta.isDir)
    .map(meta => meta.entry)
    .map(entry => prefix !== '' ? path.join(prefix, entry) : entry)
    .concat(entries
      .filter(meta => meta.isDir)
      .map(meta => meta.entry)
      .map(entry => recursiveListDirHelper(path.join(dir, entry), path.join(prefix, entry)))
      .reduce((acc, subDirs) => acc.concat(subDirs), [])
    )
    .map(entry => entry.replace(/\\/g, '/'));
}

export function recursiveListDir(dir: string): string[] {
  return recursiveListDirHelper(dir, '');
}

export function toAbsolute(file: string): string {
  if (path.isAbsolute(file)) {
    return file;
  }
  return path.normalize(path.join(process.cwd(), file));
}
