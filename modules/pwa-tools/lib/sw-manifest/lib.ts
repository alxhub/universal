import * as fs from 'fs';
import * as path from 'path';
import sha1_raw = require('sha1');

import {extractTerminals, matcherForTerminal} from '../ls-routes/lib';
import {loadNgModule} from '../common/ng';
import {recursiveListDir} from '../common/util';

function sha1(file: string): string {
  const raw = sha1_raw(fs.readFileSync(file), {asBytes: true}) as any as Array<number>;
  return Buffer.from(raw).toString('hex');
}

export interface StaticManifest {
  [url: string]: string;
}

export function genStaticManifest(dist: string, baseUrl: string = '/'): Promise<StaticManifest> {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  const manifest = recursiveListDir(dist)
    .reduce((manifest, entry) => {
      manifest[`${baseUrl}/${entry}`] = sha1(path.join(dist, entry));
      return manifest;
    }, {} as StaticManifest);
  return Promise.resolve(manifest);
}

export interface RoutingManifest {
  index: string;
  routes: RoutingManifestRoutes;
}

export interface RoutingManifestRoutes {
  [urlPattern: string]: {
    prefix?: boolean;
    match?: string;
  };
}

export function genRoutingManifest(index: string, modulePath: string, loadChildrenRoot?: string, baseUrl: string = '/'): Promise<RoutingManifest> {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  const module = loadNgModule(modulePath);
  return extractTerminals(module, loadChildrenRoot)
    .then(terminals => terminals.map(terminal => matcherForTerminal(terminal, baseUrl)))
    .then(matchers => matchers.reduce((routes, matcher) => {
      routes[matcher.pattern] = {match: matcher.match};
      return routes;
    }, {} as RoutingManifestRoutes))
    .then(routes => ({index, routes}));
}
