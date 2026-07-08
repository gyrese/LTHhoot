import { fileURLToPath } from "url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@rahoot/web": fileURLToPath(new URL("../web/src", import.meta.url)),
      "@rahoot/common": fileURLToPath(
        new URL("../common/src", import.meta.url),
      ),
      "@rahoot/socket": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
