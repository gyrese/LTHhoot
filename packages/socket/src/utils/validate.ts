import type { z } from "zod"

// Validation des payloads socket. Les types TypeScript de `ClientToServerEvents`
// ne sont qu'une promesse du client : un client modifié (ou un vieux client en
// cache) peut envoyer n'importe quoi. Chaque handler sensible passe donc son
// payload par un schéma zod avant de toucher à l'état d'une partie.

// Retourne le payload typé, ou `null` s'il ne respecte pas le schéma.
export const parsePayload = <S extends z.ZodType>(
  schema: S,
  payload: unknown,
): z.infer<S> | null => {
  const result = schema.safeParse(payload)

  return result.success ? result.data : null
}

// Appelle l'ack s'il a réellement été fourni par le client : un emit sans
// callback (ancien client, client modifié) ne doit pas faire lever d'exception
// au handler.
export const replyAck = <T>(ack: unknown, response: T): void => {
  if (typeof ack === "function") {
    const callback = ack as (_res: T) => void
    callback(response)
  }
}
