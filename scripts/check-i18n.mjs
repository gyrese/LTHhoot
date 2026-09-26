#!/usr/bin/env node
// Vérifie la parité des traductions : pour chaque fichier de référence
// packages/web/src/locales/fr/*.json, liste les clés absentes (et en trop)
// dans les autres langues. Sans dépendance, code de sortie 1 s'il manque des clés.
//
// Pluriels i18next (_zero, _one, _two, _few, _many, _other) : une clé plurielle
// est considérée présente dès que la langue possède la forme `_other` ; les
// formes propres à une langue (ex. `_many` en espagnol) ne sont pas « en trop ».
//
// Usage : node scripts/check-i18n.mjs   (ou `pnpm i18n:check`)

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const LOCALES_DIR = join(ROOT, "packages/web/src/locales")
const REFERENCE = "fr"
const LANGUAGES = ["en", "de", "es", "it"]
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/u

// Aplati un objet JSON imbriqué en clés pointées : { a: { b: "x" } } → ["a.b"].
// Les tableaux et valeurs scalaires sont des feuilles.
const flatten = (value, prefix = "", keys = new Set()) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, keys)
    }
  } else if (prefix) {
    keys.add(prefix)
  }

  return keys
}

const readKeys = (file) => {
  try {
    return flatten(JSON.parse(readFileSync(file, "utf8")))
  } catch (error) {
    throw new Error(
      `${relative(ROOT, file)} : JSON invalide (${error.message})`,
    )
  }
}

// Base d'une forme plurielle (`count_one` → `count`), ou null si la clé n'est
// pas une forme plurielle. On n'exige pas que la base existe ailleurs : la
// présence du suffixe suffit, `_other` étant la forme de référence.
const pluralBase = (key) =>
  PLURAL_SUFFIX.test(key) ? key.replace(PLURAL_SUFFIX, "") : null

// Clés « attendues » d'une langue : les clés simples telles quelles, et une
// entrée `base_other` par groupe pluriel (quelles que soient ses formes).
const expectedKeys = (keys) => {
  const expected = new Set()

  for (const key of keys) {
    const base = pluralBase(key)
    expected.add(base === null ? key : `${base}_other`)
  }

  return expected
}

const referenceDir = join(LOCALES_DIR, REFERENCE)
const namespaces = readdirSync(referenceDir)
  .filter((file) => file.endsWith(".json"))
  .sort()

let missingTotal = 0
let extraTotal = 0

for (const namespace of namespaces) {
  const referenceKeys = readKeys(join(referenceDir, namespace))
  const expected = expectedKeys(referenceKeys)
  const pluralBases = new Set(
    [...referenceKeys].map(pluralBase).filter((base) => base !== null),
  )

  for (const lang of LANGUAGES) {
    const file = join(LOCALES_DIR, lang, namespace)
    const label = `${lang}/${namespace}`

    if (!existsSync(file)) {
      console.log(`\n✗ ${label} : fichier absent (${expected.size} clés)`)
      missingTotal += expected.size
      continue
    }

    const keys = readKeys(file)
    const missing = [...expected].filter((key) => !keys.has(key))
    const extra = [...keys].filter((key) => {
      const base = pluralBase(key)

      // Forme plurielle d'une clé plurielle de la référence : légitime.
      if (base !== null && pluralBases.has(base)) {
        return false
      }

      return !referenceKeys.has(key)
    })

    if (missing.length === 0 && extra.length === 0) {
      continue
    }

    console.log(`\n${missing.length > 0 ? "✗" : "⚠"} ${label}`)

    for (const key of missing) {
      console.log(`    - manquante : ${key}`)
    }

    for (const key of extra) {
      console.log(`    + en trop   : ${key}`)
    }

    missingTotal += missing.length
    extraTotal += extra.length
  }
}

const summary = `${namespaces.length} fichiers × ${LANGUAGES.length} langues (référence : ${REFERENCE})`

if (missingTotal > 0) {
  console.log(
    `\n✗ ${missingTotal} clé(s) manquante(s), ${extraTotal} en trop — ${summary}`,
  )
  process.exit(1)
}

console.log(
  `✓ Traductions complètes${extraTotal > 0 ? ` (${extraTotal} clé(s) en trop, non bloquant)` : ""} — ${summary}`,
)
