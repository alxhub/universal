import {getDynamicLinksFromApp, getFbHostingConfig, getStaticLinksFromIndex} from './lib';

export interface GenerateFbPushConfigArgs {
  appModule: string;
  loadChildrenRoot: string;
  dist: string;
  index: string;
  baseHref?: string;
}

export function generateFbPushConfig(args: GenerateFbPushConfigArgs): Promise<Object> {
  return Promise
    .all([
      getDynamicLinksFromApp(args.dist, args.appModule, args.loadChildrenRoot, args.baseHref),
      getStaticLinksFromIndex(args.index, args.baseHref),
    ])
    .then(([dynamicLinks, staticLinks]) => getFbHostingConfig(dynamicLinks, staticLinks));
}