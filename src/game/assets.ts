import { Assets, Rectangle, Texture, type Spritesheet } from 'pixi.js'
import type { DecorationTexture, IslandTexture } from './arena'

export const ASSETS_URL = `${import.meta.env.BASE_URL}assets/`

const SHIPS_ATLAS = `${ASSETS_URL}ships.json`
const UI_ATLAS = `${ASSETS_URL}ui_sheet_retina.json`
const TILES_SHEET = `${ASSETS_URL}tiles@2x.png`
const WATER_TILE = `${ASSETS_URL}water@2x.png`

export function uiImage(name: string): string {
  return `${ASSETS_URL}ui/${name}.png`
}

/** Drawn by the HUD in the DOM; fetched with the textures so the HUD never appears half-painted. */
const HUD_IMAGES = [
  'health_frame',
  'health_fill_green',
  'health_fill_amber',
  'health_fill_red',
  'counter_panel',
  'icon_heart',
  'icon_score',
  'icon_time',
  'icon_pause',
  'icon_forward',
  'icon_turn_left',
  'icon_turn_right',
  'icon_fire_front',
  'icon_fire_left',
  'icon_fire_right',
  'button_round_normal',
]

function preloadImage(url: string): Promise<void> {
  const image = new Image()
  image.src = url
  return image.decode()
}

type TileName = IslandTexture | DecorationTexture

/** Regions of the tile sheet, in logical pixels. */
const TILE_FRAMES: Record<TileName, Rectangle> = {
  sandIsland: new Rectangle(0, 0, 192, 192),
  grassIsland: new Rectangle(320, 0, 256, 256),
  rock: new Rectangle(64, 192, 64, 64),
  mossyRock: new Rectangle(64, 256, 64, 64),
  palm: new Rectangle(320, 256, 64, 64),
  bush: new Rectangle(448, 256, 64, 64),
}

/** Fill area inside the health bar sprites, from the atlas `fill_rect` metadata. */
export const HEALTH_FILL_RECT = new Rectangle(24, 12, 112, 15)

export interface GameTextures {
  ships: Record<string, Texture>
  water: Texture
  tiles: Record<TileName, Texture>
  healthFrame: Texture
  healthFill: { player: Texture; enemy: Texture }
}

let textures: GameTextures | undefined

export async function loadGameTextures(onProgress: (progress: number) => void): Promise<GameTextures> {
  if (textures) return textures

  const [loaded] = await Promise.all([
    Assets.load([SHIPS_ATLAS, UI_ATLAS, TILES_SHEET, WATER_TILE], onProgress),
    ...HUD_IMAGES.map((name) => preloadImage(uiImage(name))),
  ])
  textures ??= buildTextures(loaded[SHIPS_ATLAS], loaded[UI_ATLAS], loaded[TILES_SHEET], loaded[WATER_TILE])
  return textures
}

function buildTextures(ships: Spritesheet, ui: Spritesheet, tileSheet: Texture, water: Texture): GameTextures {
  const tiles = Object.fromEntries(
    Object.entries(TILE_FRAMES).map(([name, frame]) => [name, new Texture({ source: tileSheet.source, frame })]),
  ) as Record<TileName, Texture>

  return {
    ships: ships.textures,
    water,
    tiles,
    healthFrame: ui.textures.enemy_health_frame,
    healthFill: {
      player: subTexture(ui.textures.enemy_health_fill_green, HEALTH_FILL_RECT),
      enemy: subTexture(ui.textures.enemy_health_fill_red, HEALTH_FILL_RECT),
    },
  }
}

function subTexture(texture: Texture, region: Rectangle): Texture {
  const frame = new Rectangle(texture.frame.x + region.x, texture.frame.y + region.y, region.width, region.height)
  return new Texture({ source: texture.source, frame })
}
