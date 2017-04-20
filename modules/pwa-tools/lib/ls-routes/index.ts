import {loadNgModule} from '../common/ng';
import {extractTerminals, matcherForTerminal, TerminalMatcher, TerminalRoute} from './lib';

export interface LsRoutesArgs {
  appModule: string;
  loadChildrenRoot?: string;
  baseHref: string;
}

export interface LsRoutesRoute {
  terminal: TerminalRoute;
  matcher?: TerminalMatcher;
}

export function lsRoutes(args: LsRoutesArgs): Promise<LsRoutesRoute[]> {
  const module = loadNgModule(args.appModule);
  return extractTerminals(module, args.loadChildrenRoot)
    .then(terminals => terminals.map(terminal => ({
      terminal,
      matcher: matcherForTerminal(terminal, args.baseHref),
    })));
}
