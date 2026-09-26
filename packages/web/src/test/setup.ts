import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Sans `globals: true`, Testing Library ne démonte pas seul les rendus :
// on le fait explicitement pour isoler chaque test (portals compris).
afterEach(() => {
  cleanup()
})
