import 'reflect-metadata';
import 'zone.js/dist/zone-node.js';

import * as fs from 'fs';

import {getDynamicLinksFromApp, getFbHostingConfig, getStaticLinksFromIndex} from './lib';

export interface GenerateFbPushConfigArgs {
  appModule: string;
  loadChildrenRoot: string;
  dist: string;
  index: string;
  baseHref?: string;

  config?: string;
}

export function generateFbPushConfig(args: GenerateFbPushConfigArgs): Promise<Object> {
  return Promise
    .all([
      getDynamicLinksFromApp(args.dist, args.appModule, args.loadChildrenRoot, args.baseHref),
      getStaticLinksFromIndex(args.index, args.baseHref),
    ])
    .then(([dynamicLinks, staticLinks]) => getFbHostingConfig(dynamicLinks, staticLinks))
    .then(hosting => {
      let result: Object = hosting;
      if (args.config) {
        result = JSON.parse(fs.readFileSync(args.config).toString());
        if (!result['hosting']) {
          result['hosting'] = hosting;
        } else {
          result['hosting']['headers'] = hosting.headers;
        }
      }
      return result;
    });
}