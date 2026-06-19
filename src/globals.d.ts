declare module '@angular/ssr/node' {
  export class AngularNodeAppEngine {
    constructor();
    handle(req: any): Promise<any>;
  }
  export function writeResponseToNodeResponse(response: any, nodeResponse: any): Promise<void>;
}
