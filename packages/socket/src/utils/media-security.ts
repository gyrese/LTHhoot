import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const blocked = new BlockList()
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4")
}
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")
blocked.addSubnet("2001::", 23, "ipv6")
blocked.addSubnet("2001:db8::", 32, "ipv6")
blocked.addSubnet("2002::", 16, "ipv6")

export const isPublicAddress = (address: string): boolean => {
  const family = isIP(address)

  if (family === 4) {
    return !blocked.check(address, "ipv4")
  }

  return (
    family === 6 &&
    globalV6.check(address, "ipv6") &&
    !blocked.check(address, "ipv6")
  )
}

// Resolve once, validate every answer, then connect to the validated IP.
// Redirects are rejected so no later hop can bypass destination validation.
export async function downloadRemoteImage(rawUrl: string): Promise<Buffer> {
  const url = new URL(rawUrl)

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Lien HTTP(S) sans identifiants requis")
  }

  const hostname = url.hostname.replace(/^\[|\]$/gu, "")
  const addresses = await lookup(hostname, { all: true, verbatim: true })

  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error("Les adresses internes ou réservées sont interdites")
  }

  const [destination] = addresses

  return new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest
    const req = request(
      {
        protocol: url.protocol,
        hostname: destination.address,
        family: destination.family,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        servername: isIP(hostname) ? undefined : hostname,
        headers: { host: url.host, accept: "image/*" },
        agent: false,
      },
      async (response) => {
        try {
          if (response.statusCode !== 200) {
            throw new Error("Source refusée (redirections non autorisées)")
          }

          if (!response.headers["content-type"]?.startsWith("image/")) {
            throw new Error("La source ne contient pas une image")
          }

          if (Number(response.headers["content-length"]) > MAX_IMAGE_BYTES) {
            throw new Error("Image trop volumineuse (20 Mo maximum)")
          }

          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of response) {
            size += chunk.length

            if (size > MAX_IMAGE_BYTES) {
              throw new Error("Image trop volumineuse (20 Mo maximum)")
            }

            chunks.push(Buffer.from(chunk))
          }
          resolve(Buffer.concat(chunks, size))
        } catch (error) {
          response.destroy()
          reject(error)
        } finally {
          clearTimeout(timer)
        }
      },
    )
    const timer = setTimeout(
      () => req.destroy(new Error("Délai de téléchargement dépassé")),
      15_000,
    )
    req.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    req.end()
  })
}
