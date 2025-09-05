import mitt from 'mitt'
import { createReadStream, ReadStream } from 'node:fs'

import type { BbMessage, HaMessage, HnMessage } from './exports'

import { parseOncoreMessage } from './parser'

const PREAMBLE = '@@'
const POSTAMBLE = '\r\n'

// Assume that 1K is more than enough for a single message
const BUFFER_SIZE = 1 * 1024

export type OncoreStreamingEvents = {
  Bb: BbMessage;
  Ha: HaMessage;
  Hn: HnMessage;
}

export class OncoreStreamingParser {
  /**
   * Buffer for incoming data chunks
   */
  private buffer: Buffer = Buffer.allocUnsafe(0)

  /**
   * Read stream for telemetry messages
   */
  private stream: ReadStream

  /**
   * Local event bus for parsed messages
   */
  public readonly events = mitt<OncoreStreamingEvents>()

  constructor (
    path: string
  ) {
    this.stream = createReadStream(path, {
      flags: 'r',
      highWaterMark: 256,
    })

    this.stream.on('data', (chunk) => {
      chunk = chunk as Buffer

      // Check if new chunk would exceed buffer size limit
      this.buffer = (this.buffer.length + chunk.length > BUFFER_SIZE)
        ? chunk // Discard old buffer, start fresh with new chunk
        : Buffer.concat([this.buffer, chunk])

      let preamblePosition: number
      while ((preamblePosition = this.buffer.indexOf(Buffer.from(PREAMBLE))) >= 0) {
        const postamblePosition = this.buffer.indexOf(Buffer.from(POSTAMBLE), preamblePosition)
        if (postamblePosition === -1) break

        // Extract complete message
        const payload = this.buffer.subarray(preamblePosition, postamblePosition + POSTAMBLE.length)

        // Parse
        const message = parseOncoreMessage(payload)
        if (message) {
          this.events.emit(message.type, message.payload)
        }

        // Remove current message from buffer
        this.buffer = this.buffer.subarray(postamblePosition + POSTAMBLE.length)

        // If remaining buffer is empty, clear it completely
        if (this.buffer.length === 0) {
          this.buffer = Buffer.allocUnsafe(0)
          break
        }
      }
    })
  }

  async destroy (): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.close(error => {
        if (error) {
          return reject(error)
        }

        this.reset()
        resolve()
      })
    })
  }

  reset (): void {
    this.buffer = Buffer.allocUnsafe(0)
    this.events.all.clear()
  }
}
