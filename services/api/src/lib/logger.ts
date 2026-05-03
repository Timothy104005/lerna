import { pino, type Logger } from 'pino'
import { env } from '../env'

function createLogger(): Logger {
  if (env.NODE_ENV === 'test') {
    return pino({ level: 'silent' })
  }

  if (env.NODE_ENV === 'development') {
    return pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' }
      }
    })
  }

  return pino({ level: 'info' })
}

export const logger = createLogger()
