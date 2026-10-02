// Converts the challenge's Starling XML ship atlas into the JSON format PixiJS loads.
// Usage: node scripts/convert-ships-atlas.mjs <ships_miscellaneous_sheet.xml> <output.json> <image file name>
import { readFileSync, writeFileSync } from 'node:fs'

const [xmlPath, outputPath, image] = process.argv.slice(2)
const xml = readFileSync(xmlPath, 'utf8')

const frames = {}
for (const [, name, x, y, w, h] of xml.matchAll(/name="(.+?)\.png" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)) {
  frames[name] = { frame: { x: +x, y: +y, w: +w, h: +h } }
}

writeFileSync(outputPath, JSON.stringify({ frames, meta: { image, scale: '1' } }))
console.log(`${Object.keys(frames).length} frames written to ${outputPath}`)
