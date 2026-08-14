import { Client, Connection } from '@temporalio/client'

let clientPromise: Promise<Client> | undefined

/**
 * One lazily-opened client for the process.
 *
 * `/leads/verify-emails` opens and closes a fresh connection per request; that is a gRPC handshake
 * per click for no benefit. New code shares this one.
 */
export const getTemporalClient = (): Promise<Client> => {
  clientPromise ??= Connection.connect({ address: 'localhost:7233' }).then(
    (connection) => new Client({ connection, namespace: 'default' })
  )

  return clientPromise
}
