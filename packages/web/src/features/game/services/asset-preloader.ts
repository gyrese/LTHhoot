// Service de préchargement intelligent d'assets média (images, audios) en tâche de fond.
// Permet d'éliminer les temps de latence réseau lors de l'affichage d'une question.

type PreloadStats = {
  loaded: number
  failed: number
  total: number
  isComplete: boolean
}

class AssetPreloadManager {
  private static instance: AssetPreloadManager | null = null
  private cachedUrls: Set<string> = new Set()
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private imageCache: Map<string, HTMLImageElement> = new Map()
  private listeners: Set<(_stats: PreloadStats) => void> = new Set()
  private stats: PreloadStats = {
    loaded: 0,
    failed: 0,
    total: 0,
    isComplete: true,
  }

  static getInstance(): AssetPreloadManager {
    AssetPreloadManager.instance ||= new AssetPreloadManager()

    return AssetPreloadManager.instance
  }

  getStats(): PreloadStats {
    return { ...this.stats }
  }

  subscribe(listener: (_stats: PreloadStats) => void): () => void {
    this.listeners.add(listener)
    listener(this.getStats())

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const stats = this.getStats()
    for (const listener of this.listeners) {
      listener(stats)
    }
  }

  async preload(urls: string[]): Promise<PreloadStats> {
    if (!urls || urls.length === 0) {
      return this.stats
    }

    const uniqueNewUrls = urls.filter(
      (u) =>
        typeof u === "string" &&
        u.trim().length > 0 &&
        !this.cachedUrls.has(u.trim()),
    )

    if (uniqueNewUrls.length === 0) {
      return this.stats
    }

    this.stats = {
      loaded: 0,
      failed: 0,
      total: uniqueNewUrls.length,
      isComplete: false,
    }
    this.notify()

    const promises = uniqueNewUrls.map(async (url) => {
      const trimmed = url.trim()
      const isAudio = /\.(?:mp3|ogg|wav|m4a|aac)(?:[?#].*)?$/iu.test(trimmed)

      try {
        if (isAudio) {
          await this.preloadAudio(trimmed)
        } else {
          await this.preloadImage(trimmed)
        }
        this.cachedUrls.add(trimmed)
        this.stats.loaded += 1
      } catch (err) {
        console.warn(
          `[ASSET_PRELOAD] Échec de préchargement pour ${trimmed}`,
          err,
        )
        this.stats.failed += 1
      } finally {
        this.stats.isComplete =
          this.stats.loaded + this.stats.failed >= this.stats.total
        this.notify()
      }
    })

    await Promise.allSettled(promises)

    return this.getStats()
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.imageCache.set(url, img)
        resolve()
      }
      img.onerror = (e) => reject(e)
      img.src = url
    })
  }

  private preloadAudio(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio()
      audio.preload = "auto"
      audio.oncanplaythrough = () => {
        this.audioCache.set(url, audio)
        resolve()
      }
      audio.onerror = (e) => reject(e)
      audio.src = url
      // Déclencher le chargement
      audio.load()
    })
  }

  clear() {
    this.cachedUrls.clear()
    this.audioCache.clear()
    this.imageCache.clear()
    this.stats = { loaded: 0, failed: 0, total: 0, isComplete: true }
    this.notify()
  }
}

export const assetPreloader = AssetPreloadManager.getInstance()
