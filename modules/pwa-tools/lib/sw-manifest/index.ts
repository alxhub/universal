import 'reflect-metadata';
import 'zone.js/dist/zone-node.js';

import * as fs from 'fs';
import {loadNgModule} from '../common/ng';
import {genRoutingManifest, genStaticManifest, RoutingManifest, StaticManifest} from './lib';

function mergeConfig(mergeTo: Object, mergeFrom: Object): void {
  Object.keys(mergeFrom).forEach(key => {
    const value = mergeFrom[key];
    if (mergeTo[key]) {
      if (Array.isArray(mergeTo[value])) {
        if (Array.isArray(value)) {
          mergeTo[key] = mergeTo[key].concat(value);
        } else {
          mergeTo[key].push(value);
        }
      } else if (typeof value === 'object') {
        mergeTo[key] = mergeConfig(mergeTo[key], value);
      } else {
        mergeTo[key] = value;
      }
    } else {
      mergeTo[key] = value;
    }
  });
}

export interface GenerateSwManifestArgs {
  appModule: string;
  loadChildrenRoot?: string;

  manifest?: string;

  static: boolean;
  dist?: string;

  routing: boolean;
  index?: string;
  baseHref?: string;
}

export function generateSwManifest(args: GenerateSwManifestArgs): Promise<Object> {
  let manifest = {};
  if (args.manifest) {
    manifest = JSON.parse(fs.readFileSync(args.manifest).toString());
  }

  let mRouting: Promise<RoutingManifest|null> = Promise.resolve(null);
  if (args.routing) {
    mRouting = genRoutingManifest(args.index || 'index.html', args.appModule, args.loadChildrenRoot, args.baseHref);
  }

  let mStatic: Promise<StaticManifest|null> = Promise.resolve(null);
  if (args.static) {
    mStatic = genStaticManifest(args.dist!, args.baseHref);
  }

  return Promise
    .all([mRouting, mStatic])
    .then(([cRouting, cStatic]) => {
      if (args.routing) {
        mergeConfig(manifest, {routing: cRouting});
      }
      if (args.static) {
        mergeConfig(manifest, {static: cStatic});
      }
      return manifest;
    });
}