/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import { schemas } from './lexicons.js'

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  dev: DevNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.dev = new DevNS(this)
  }
}

export class DevNS {
  _server: Server
  jakestout: DevJakestoutNS

  constructor(server: Server) {
    this._server = server
    this.jakestout = new DevJakestoutNS(server)
  }
}

export class DevJakestoutNS {
  _server: Server
  atguilds: DevJakestoutAtguildsNS

  constructor(server: Server) {
    this._server = server
    this.atguilds = new DevJakestoutAtguildsNS(server)
  }
}

export class DevJakestoutAtguildsNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}
