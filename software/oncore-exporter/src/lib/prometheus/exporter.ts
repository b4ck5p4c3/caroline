import { createServer, Server } from 'node:http'

import type { ExporterOptions } from './exports'
import type { MetricsFrame } from './frame'

export class MetricsExporter {
  private frames: Map<string, MetricsFrame> = new Map()
  private server: Server

  constructor (
    private readonly options: ExporterOptions = {}
  ) {
    this.server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/plain')
      switch (request.url) {
        case '/': {
          response.end('Motorola OnCore GNSS Prometheus Exporter\n')
          break
        }
        case '/metrics': {
          response.end(this.getMetrics())
          break
        }
        default: {
          response.statusCode = 404
          response.end('Not Found\n')
        }
      }
    })
  }

  addFrame (frame: MetricsFrame): void {
    this.frames.set(frame.id, frame)
  }

  async destroy (): Promise<void> {
    this.frames.clear()
    return new Promise((resolve, reject) => {
      this.server.close(error => {
        if (error) {
          return reject(error)
        }
        resolve()
      })
    })
  }

  getMetrics (): string {
    return [...this.frames.values()]
      .map((frame) => frame.render(this.options.globalLabels || {}))
      .filter((content) => content.length > 0)
      .join('\n\n')
  }

  listen (port: number, host?: string): void {
    this.server.listen(port, host)
  }
}
