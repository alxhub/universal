import * as path from 'path';

import {Injector, NgModule, NgZone, ReflectiveInjector} from '@angular/core';
import {Route, Routes, ROUTES} from '@angular/router';
import {platformServer, ServerModule} from '@angular/platform-server';

import {jitCompiler, loadNgModule} from '../common/ng';

function resolveLoadChildren(loadChildren: string|Function, loadChildrenRoot: string): any {
  if (typeof loadChildren === 'function') {
    return loadChildren();
  } else {
    const [moduleFile, moduleName] = loadChildren.split('#');
    return loadNgModule(path.join(loadChildrenRoot, moduleFile), moduleName);
  }
}

function expandLazyChildrenOfRoute(route: Route, injector: Injector, loadChildrenRoot: string): Promise<Route> {
  if (!route.loadChildren) {
    return Promise.resolve(route);
  }
  const module = resolveLoadChildren(route['loadChildren'], loadChildrenRoot);
  return readRoutesForModule(module, injector)
    .then(childRoutes => {
      route.children = childRoutes;
      return route;
    });
}

function expandLazyChildren(routes: Routes, injector: Injector, loadChildrenRoot: string): Promise<Routes> {
  return Promise.all(routes
    .map(route => expandLazyChildrenOfRoute(route, injector, loadChildrenRoot))
  );
}

function flattenRoutes(routes: Route[][]): Route[] {
  return routes.reduce((acc, routes) => acc.concat(routes), [] as Route[]);
}

function readRoutesForModule(module: any, injector: Injector, loadChildrenRoot?: string): Promise<Routes> {  
  return jitCompiler()
    .compileModuleAsync(module)
    .then(factory => factory.create(injector))
    .then(ref => {
      const routes = flattenRoutes(ref.injector.get(ROUTES));
      if (loadChildrenRoot) {
        return expandLazyChildren(routes, ref.injector, loadChildrenRoot);
      } else {
        return routes;
      }
    });
}

export function extractRoutes(module: any, loadChildrenRoot?: string): Promise<Routes> {
  @NgModule({
    imports: [
      module,
      ServerModule,
    ],
  })
  class FakeServerModule {}

  const ngZone = new NgZone({enableLongStackTrace: false});
  const injector = ReflectiveInjector.resolveAndCreate([{provide: NgZone, useValue: ngZone}], platformServer().injector);

  return readRoutesForModule(FakeServerModule, injector, loadChildrenRoot);
}

export function extractTerminals(module: any, loadChildrenRoot?: string): Promise<TerminalRoute[]> {
  return extractRoutes(module, loadChildrenRoot)
    .then(routes => coalesceToTerminals(routes));
}

export interface TerminalRoute {
  path: string;
  prefix: boolean;
  loadChildren: string[];
}

function coalesceRouteToTerminals(route: Route, prefixSegments: string[], loadChildren: string[]): TerminalRoute[] {
  if (!route.children || route.children.length === 0) {
    // Route is a terminal.
    return [{
      path: prefixSegments
        .filter(seg => seg !== '')
        .concat([route.path])
        .join('/'),
      prefix: route.pathMatch === 'prefix',
      loadChildren,
    }];
  } else {
    // Route is non-terminal.
    const newSegments = prefixSegments.concat([route.path]);
    const loadChildrenDir = (typeof route.loadChildren === 'string') ? route.loadChildren : null;
    const newLoadChildren = loadChildrenDir !== null ? loadChildren.concat([loadChildrenDir]) : loadChildren;
    return route
      .children
      .map(child => coalesceRouteToTerminals(child, newSegments, newLoadChildren))
      .reduce((acc, terminals) => acc.concat(terminals), []);
  }
}

export function coalesceToTerminals(routes: Route[]): TerminalRoute[] {
  return routes
    .map(route => coalesceRouteToTerminals(route, [], []))
    .reduce((acc, terminals) => acc.concat(terminals), []);
}

function regexForSegment(segment: string): {segment: string, pure: boolean} {
  if (segment.startsWith(':')) {
    return {segment: '[^/]+', pure: false};
  } else if (segment === '**') {
    return {segment: '.*', pure: false};
  } else {
    return {segment, pure: true};
  }
}

export interface TerminalMatcher {
  pattern: string;
  match: 'exact'|'prefix'|'regex';
}

export function matcherForTerminal(route: TerminalRoute, baseUrl: string = '/'): TerminalMatcher {
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.substr(0, baseUrl.length - 1);
  }
  const body = route
    .path
    .split('/')
    .map(segment => regexForSegment(segment));
  let pattern = baseUrl + '/' + body.map(segment => segment.segment).join('/');
  if (body.every(segment => segment.pure)) {
    if (pattern.endsWith('/') && pattern !== '/') {
      pattern = pattern.substr(0, pattern.length - 1);
    }
    if (route.prefix) {
      return {pattern, match: 'prefix'};
    } else {
      return {pattern, match: 'exact'};
    }
  } else {
    const suffix = route.prefix ? '(/.*)?' : '';
    return {pattern: `^${pattern}${suffix}$`, match: 'regex'};
  }
}
