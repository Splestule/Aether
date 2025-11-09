interface LogOptions {
  simple: string
  debug?: string
  details?: unknown[]
}

class Logger {
  private debugMode = false

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
    const modeLabel = enabled ? 'enabled' : 'disabled'
    this.write(`MODE Debug ${modeLabel.toUpperCase()}`)
  }

  isDebugMode() {
    return this.debugMode
  }

  private timestamp() {
    return new Date().toISOString()
  }

  private write(message: string, ...optional: unknown[]) {
    console.log(`[${this.timestamp()}] ${message}`, ...optional)
  }

  api(method: string, path: string, debugMessage?: string, ...details: unknown[]) {
    if (this.debugMode && debugMessage) {
      this.write(debugMessage, ...details)
      return
    }
    this.write(`API ${method.toUpperCase()} ${path}`)
  }

  action(simple: string, debugMessage?: string, ...details: unknown[]) {
    if (this.debugMode && debugMessage) {
      this.write(debugMessage, ...details)
      return
    }
    this.write(`ACTION ${simple}`)
  }

  info(message: string, ...details: unknown[]) {
    this.write(message, ...details)
  }

  debug(message: string, ...details: unknown[]) {
    if (!this.debugMode) {
      return
    }
    this.write(message, ...details)
  }

  error(code: string, message: string, error?: unknown) {
    if (this.debugMode && error instanceof Error) {
      this.write(`ERROR ${code}: ${message}`, error)
      return
    }
    if (this.debugMode && error) {
      this.write(`ERROR ${code}: ${message}`, error)
      return
    }
    this.write(`ERROR ${code}: ${message}`)
  }
}

export const logger = new Logger()

