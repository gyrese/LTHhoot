// Acknowledgements confirm a snapshot, never edits made after it was sent.
export class SaveSession {
  private revision = 0
  private pending: number | null = null
  private confirmed = 0

  change() {
    this.revision += 1
  }
  get dirty() {
    return this.revision !== this.confirmed
  }
  get saving() {
    return this.pending !== null
  }

  begin(): number | null {
    if (this.saving) {
      return null
    }
    this.pending = this.revision
    return this.pending
  }

  complete(sent: number, replayed = false): boolean {
    if (this.pending !== sent) {
      return false
    }
    this.pending = null
    if (!replayed) {
      this.confirmed = sent
    }
    return !replayed && !this.dirty
  }

  fail() {
    this.pending = null
  }
}
