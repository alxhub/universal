import * as fs from 'fs';
import * as path from 'path';

import {extractTerminals, TerminalRoute} from '../ls-routes/lib';
import {loadNgModule} from '../common/ng';
import {recursiveListDir} from '../common/util';
import {ChunkMap, chunkMapForDist} from './cli';

import * as p5 from 'parse5';

interface FbJson {
  [key: string]: any;
  hosting?: FbJsonHosting;
}

interface FbJsonHosting {
  [key: string]: any;
  headers?: FbJsonHostingHeadersMatch[];
}

interface FbJsonHostingHeadersMatch {
  source: string;
  headers: FbJsonHostingHeader[];
}

interface FbJsonHostingHeader {
  key: string;
  value: string;
}

interface FbLinkHeader {
  url: string;
  rel: string;
  as: string;
  nopush?: boolean;
}

interface FbSourceWithLinks {
  source: string;
  link: FbLinkHeader[];
}

function isRouteFbCompatible(): boolean {
  return false;
}

interface FbTerminal {
  url: string;
  chunks: string[];
}

enum FbTerminalEvalState {
  PREFIX,
  SUFFIX,
}

function toFbCompatibleTerminal({path, loadChildren, prefix}: TerminalRoute, chunkMap: ChunkMap): FbTerminal|null {
  let state = FbTerminalEvalState.PREFIX;
  let url = path
    .split('/')
    .reduce((url, segment) => {
      if (url === null) {
        return null;
      }
      if (segment === '**' || segment.startsWith(':')) {
        if (state === FbTerminalEvalState.PREFIX) {
          url += url.endsWith('/') ? '*' : '/*';
        }
        state = FbTerminalEvalState.SUFFIX;
      } else {
        if (state === FbTerminalEvalState.SUFFIX) {
          return null;
        }
        url += '/' + segment;
      }
      return url;
    }, '');
  if (url === null) {
    return null;
  }
  if (state === FbTerminalEvalState.PREFIX && prefix) {
    url += url.endsWith('/') ? '*' : '/*';
  }
  if (url.endsWith('/') && url !== '/') {
    url = url.substr(0, url.length - 1);
  }
  const chunks = resolveLazyChunks(chunkMap, loadChildren);
  return {url, chunks};
}

function resolveLazyChunks(chunkMap: ChunkMap, loadChildren: string[]): string[] {
  return loadChildren
    .map(child => {
      const [modulePath] = child.split('#');
      const factoryPath = `${modulePath}.ngfactory`;
      if (!chunkMap[factoryPath]) {
        throw new Error(`No chunk found for module reference ${child}`);
      }
      return chunkMap[factoryPath];
    });
}

function getHeaderForLink(link: FbLinkHeader): string {
  return `<${link.url}>;rel=${link.rel};as=${link.as}${!!link.nopush ? ';nopush' : ''}`;
}

function terminalToFbLinkWithSource(terminal: FbTerminal, baseUrl: string): FbSourceWithLinks {
  const link = terminal
    .chunks
    .map(chunk => getLinkForFile(chunk, baseUrl));
  return {source: terminal.url, link};
}

function getLinkForFile(file: string, baseUrl: string): FbLinkHeader {
  return {
    url: `${baseUrl}/${file}`,
    as: file.endsWith('.css') ? 'style' : 'script',
    rel: 'preload',
  };
}

function getStaticLinks(dist: string, baseUrl: string = '/'): FbLinkHeader[] {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  return recursiveListDir(dist)
    .filter(file => file.endsWith('.bundle.js') || file.endsWith('.css'))
    .map(file => getLinkForFile(file, baseUrl));
}

interface P5Url {
  url: string;
  as: string;
}

function getAttr(node: any, attr: string): string|null {
  const matching = (node.attrs || [])
    .filter(entry => entry.name === attr)
    .map(entry => entry.value);
  if (matching.length === 0) {
    return null;
  } else if (matching.length > 1) {
    throw new Error('More than one attribute of given name!');
  } else {
    return matching[0];
  }
}

function getUrlFromNode(node: any): P5Url|null {
  if (!node.tagName) {
    return null;
  }
  switch (node.tagName) {
    case 'link': {
      const rel = getAttr(node, 'rel');
      if (!rel) {
        return null;
      }
      const url = getAttr(node, 'href');
      if (!url) {
        return null;
      }
      switch (rel) {
        case 'stylesheet':
          return {url, as: 'style'};
        case 'preload':
          const as = getAttr(node, 'as');
          if (!as) {
            return null;
          }
          return {url, as};
        default:
          return null;
      }
    }
    case 'script': {
      const url = getAttr(node, 'src');
      if (!url) {
        return null;
      }
      return {url, as: 'script'};
    }
    case 'img': {
      const url = getAttr(node, 'src');
      if (!url) {
        return null;
      }
      return {url, as: 'image'};
    }
    default:
      return null;
  }
}

function getUrlsFromNodes(nodes: any[]): P5Url[] {
  return nodes
    .map(node => [getUrlFromNode(node)]
      .filter(url => url !== null)
      .concat(node.childNodes ? getUrlsFromNodes(node.childNodes) : [])
    )
    .reduce((acc, urls) => acc.concat(urls), []);
}

function getUrlsFromIndex(index: string): P5Url[] {
  const contents = fs.readFileSync(index).toString();
  const doc = p5.parse(contents, {locationInfo: false});
  return getUrlsFromNodes([doc]);
}

function isAbsolute(url: string) {
  const lc = url.toLowerCase();
  return lc.startsWith('/') || lc.startsWith('http://') || lc.startsWith('https://');
}

export function getStaticLinksFromIndex(index: string, baseUrl: string = '/'): Promise<FbLinkHeader[]> {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  const result = getUrlsFromIndex(index)
    .map(entry => ({
      url: isAbsolute(entry.url) ? entry.url : `${baseUrl}/${entry.url}`,
      rel: 'preload',
      as: entry.as
    }));
  return Promise.resolve(result);
}

export function getDynamicLinksFromApp(dist: string, appModule: string, loadChildrenRoot?: string, baseUrl: string = '/'): Promise<FbSourceWithLinks[]> {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  const chunks = chunkMapForDist(dist);
  if (chunks === null) {
    throw new Error(`Cannot read chunk map from ${dist} - not a CLI project?`);
  }
  const module = loadNgModule(appModule);
  return extractTerminals(module, loadChildrenRoot)
    .then(terminals => terminals
      .map(terminal => toFbCompatibleTerminal(terminal, chunks))
      .filter(terminal => terminal !== null)
      .map(terminal => terminalToFbLinkWithSource(terminal, baseUrl))
      .reduce((acc, links) => acc.concat(links), [] as FbSourceWithLinks[])
    );
}

export function getFbHostingConfig(sources: FbSourceWithLinks[], staticLinks: FbLinkHeader[]): FbJsonHosting {
  return {
    headers: sources
      .map(source => {
        return {
          source: source.source,
          headers: [{
            key: 'Link',
            value: staticLinks
              .concat(source.link)
              .map(link => getHeaderForLink(link))
              .join(','),
          }],
        } as FbJsonHostingHeadersMatch
      }),
  };
}
