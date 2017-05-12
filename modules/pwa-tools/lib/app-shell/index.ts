import 'reflect-metadata';
import 'zone.js/dist/zone-node.js';

import {enableProdMode, Provider, NgModule, NgModuleFactory, NgModuleFactoryLoader, ReflectiveInjector} from '@angular/core';
import {COMPILER_PROVIDERS, JitCompiler, ResourceLoader} from '@angular/compiler';
import {ServerModule, renderModuleFactory} from '@angular/platform-server';
import {CookieXSRFStrategy, HttpModule, XSRFStrategy, Request} from '@angular/http';
import {jitCompiler, loadNgModule} from '../common/ng';
import {toAbsolute} from '../common/util';

import * as fs from 'fs';
import * as path from 'path';

export class FakeXsrfStrategy implements XSRFStrategy {
  configureRequest(req: Request): void {}
}

export interface GenerateAppShellArgs {
  appModule: string;
  index: string;

  beforeAppModule?: string;
  afterAppModule?:  string;

  loadChildrenRoot?: string;
  url?: string;
}

function makeServerModule(args: GenerateAppShellArgs): any {
  const AppModule = loadNgModule(args.appModule);

  let imports = [];
  if (args.beforeAppModule) {
    imports.push(loadNgModule(args.beforeAppModule));
  }
  imports.push(AppModule);
  if (args.afterAppModule) {
    imports.push(loadNgModule(args.afterAppModule));
  }
  imports.push(ServerModule);
  imports.push(HttpModule);

  let providers: Provider[] = [
    {provide: XSRFStrategy, useClass: FakeXsrfStrategy},
  ];

  if (args.loadChildrenRoot) {
    providers.push({
      provide: NgModuleFactoryLoader,
      useValue: new RequireNgModuleFactoryLoader(args.loadChildrenRoot),
    });
  }

  const annotations: any = Reflect.getMetadata('annotations', AppModule)[0];
  const bootstrap = annotations.bootstrap;

  @NgModule({bootstrap, imports, providers})
  class ServerAppModule {}

  return ServerAppModule;
}

export function generateAppShell(args: GenerateAppShellArgs): Promise<string> {
  const AppShellModule = makeServerModule(args);
  const indexHtml = fs.readFileSync(args.index).toString();
  return jitCompiler()
    .compileModuleAsync(AppShellModule)
    .then(factory => renderModuleFactory(factory, {url: args.url || '/', document: indexHtml}))
}

class RequireNgModuleFactoryLoader implements NgModuleFactoryLoader {
  constructor(private root: string) {}

  load(pathAndHash: string): Promise<NgModuleFactory<any>> {
    const [modPath, exportName] = pathAndHash.split('#');
    const reqModPath = path.join(this.root, modPath);
    const module = require(reqModPath)[exportName];
    return jitCompiler().compileModuleAsync(module);
  }
}
