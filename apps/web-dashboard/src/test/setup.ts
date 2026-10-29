import '@testing-library/jest-dom/vitest'

// Mock WebSocket in test environment to prevent tests from connecting to real background daemons
class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  readyState = MockWebSocket.OPEN
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  url: string

  constructor(url: string) {
    this.url = url
    setTimeout(() => {
      this.onopen?.(new Event('open'))
    }, 0)
  }

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
  close() {
    this.readyState = MockWebSocket.CLOSED
  }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
