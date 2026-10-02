import { Container, Graphics, GraphicsContext, Sprite, TilingSprite, type Texture } from 'pixi.js'
import { ARENA, DECORATIONS, ISLANDS } from './arena'
import { HEALTH_FILL_RECT, type GameTextures } from './assets'
import type { GameEvent, Match, Projectile, Ship, ShipKind } from './simulation'

/** ship_N is intact; N + 6, N + 12 and N + 18 are the same ship progressively damaged, the last one a wreck. */
const SHIP_SPRITE_NUMBER: Record<ShipKind, number> = { player: 5, shooter: 2, chaser: 3 }
const SPRITES_PER_DAMAGE_STAGE = 6
const BURNING_STAGE = 2
const WRECK_STAGE = 3
/** Hulls are drawn longer than their collision circle, so they read as ships rather than discs. */
const HULL_LENGTH_IN_RADII = 2.5

const HIT_FLASH_SECONDS = 0.12
const HIT_FLASH_TINT = 0xff7070
const WATER_DRIFT_SPEED = 6

interface Effect {
  view: Container
  ageSeconds: number
  durationSeconds: number
  startScale: number
  endScale: number
}

class ShipView extends Container {
  flashSeconds = 0
  private hull = new Sprite({ anchor: 0.5 })
  private fire = new Sprite({ anchor: { x: 0.5, y: 0.8 } })
  private healthFill: Sprite

  constructor(ship: Ship, private textures: GameTextures) {
    super()
    this.hull.scale.set(hullScale(ship, textures))
    const healthBar = new Container({ y: -ship.radius - 34, scale: 0.5 })
    const frame = new Sprite({ texture: textures.healthFrame, x: -textures.healthFrame.width / 2 })
    this.healthFill = new Sprite({
      texture: ship.kind === 'player' ? textures.healthFill.player : textures.healthFill.enemy,
      x: frame.x + HEALTH_FILL_RECT.x,
      y: HEALTH_FILL_RECT.y,
    })
    healthBar.addChild(frame, this.healthFill)
    this.addChild(this.hull, this.fire, healthBar)
  }

  update(ship: Ship, clockSeconds: number, deltaSeconds: number): void {
    const healthRatio = Math.max(0, ship.health / ship.maxHealth)
    const stage = Math.min(BURNING_STAGE, Math.floor((1 - healthRatio) * 3))

    this.visible = ship.health > 0
    this.position.set(ship.x, ship.y)
    this.hull.texture = shipTexture(this.textures, ship.kind, stage)
    this.hull.rotation = hullRotation(ship.heading)
    this.healthFill.width = HEALTH_FILL_RECT.width * healthRatio

    this.fire.visible = stage === BURNING_STAGE
    this.fire.texture = this.textures.ships[Math.floor(clockSeconds * 8) % 2 ? 'fire_1' : 'fire_2']

    this.flashSeconds = Math.max(0, this.flashSeconds - deltaSeconds)
    this.hull.tint = this.flashSeconds > 0 ? HIT_FLASH_TINT : 0xffffff
  }
}

export class ArenaRenderer {
  readonly world = new Container()
  private water: TilingSprite
  private shipLayer = new Container()
  private projectileLayer = new Container()
  private effectLayer = new Container()
  private shipViews = new Map<number, ShipView>()
  private projectileViews = new Map<number, Sprite>()
  private effects: Effect[] = []
  private splashShape = new GraphicsContext().circle(0, 0, 10).stroke({ color: 0xffffff, width: 3 })
  private clockSeconds = 0

  constructor(private textures: GameTextures) {
    this.water = new TilingSprite({ texture: textures.water, width: ARENA.width, height: ARENA.height })
    this.world.addChild(this.water, this.createScenery(), this.shipLayer, this.projectileLayer, this.effectLayer)
  }

  resize(screenWidth: number): void {
    this.world.scale.set(screenWidth / ARENA.width)
  }

  render(match: Match, deltaSeconds: number): void {
    this.clockSeconds += deltaSeconds
    this.water.tilePosition.x = this.clockSeconds * WATER_DRIFT_SPEED

    const ships = [match.player, ...match.enemies]
    syncViews(ships, this.shipViews, this.shipLayer, (ship) => new ShipView(ship, this.textures))
    for (const ship of ships) {
      this.shipViews.get(ship.id)?.update(ship, this.clockSeconds, deltaSeconds)
    }

    syncViews(match.projectiles, this.projectileViews, this.projectileLayer, () => this.createProjectileView())
    for (const projectile of match.projectiles) {
      this.projectileViews.get(projectile.id)?.position.set(projectile.x, projectile.y)
    }

    this.updateEffects(deltaSeconds)
  }

  showEvent(event: GameEvent): void {
    const { ships } = this.textures
    switch (event.type) {
      case 'shot':
        this.addEffect(this.effectSprite(ships.explosion_3, event), 0.15, 0.3, event.broadside ? 1.1 : 0.7)
        break
      case 'hit': {
        this.addEffect(this.effectSprite(ships.explosion_2, event), 0.25, 0.3, 0.7)
        const view = this.shipViews.get(event.shipId)
        if (view) view.flashSeconds = HIT_FLASH_SECONDS
        break
      }
      case 'miss':
        if (event.onLand) this.addEffect(this.effectSprite(ships.explosion_3, event), 0.2, 0.3, 0.6)
        else this.addEffect(new Graphics({ context: this.splashShape, x: event.x, y: event.y }), 0.4, 0.4, 1.8)
        break
      case 'destroyed': {
        const wreck = this.effectSprite(shipTexture(this.textures, event.ship.kind, WRECK_STAGE), event.ship)
        wreck.rotation = hullRotation(event.ship.heading)
        const scale = hullScale(event.ship, this.textures)
        this.addEffect(wreck, 1.5, scale, scale * 0.85)
        this.addEffect(this.effectSprite(ships.explosion_1, event.ship), 0.6, 0.6, 1.8)
        break
      }
    }
  }

  destroy(): void {
    this.world.destroy({ children: true })
    this.splashShape.destroy()
  }

  private createScenery(): Container {
    const scenery = new Container()
    for (const island of ISLANDS) {
      const sprite = new Sprite({ texture: this.textures.tiles[island.texture], anchor: 0.5, x: island.x, y: island.y })
      sprite.setSize(island.size)
      scenery.addChild(sprite)
    }
    for (const decoration of DECORATIONS) {
      const texture = this.textures.tiles[decoration.texture]
      scenery.addChild(new Sprite({ texture, anchor: 0.5, x: decoration.x, y: decoration.y }))
    }
    return scenery
  }

  private createProjectileView(): Sprite {
    return new Sprite({ texture: this.textures.ships.cannon_ball, anchor: 0.5, scale: 1.4 })
  }

  private effectSprite(texture: Texture, position: { x: number; y: number }): Sprite {
    return new Sprite({ texture, anchor: 0.5, x: position.x, y: position.y })
  }

  private addEffect(view: Container, durationSeconds: number, startScale: number, endScale: number): void {
    view.scale.set(startScale)
    this.effectLayer.addChild(view)
    this.effects.push({ view, ageSeconds: 0, durationSeconds, startScale, endScale })
  }

  private updateEffects(deltaSeconds: number): void {
    this.effects = this.effects.filter((effect) => {
      effect.ageSeconds += deltaSeconds
      const progress = effect.ageSeconds / effect.durationSeconds
      if (progress >= 1) {
        effect.view.destroy()
        return false
      }
      effect.view.alpha = 1 - progress
      effect.view.scale.set(effect.startScale + (effect.endScale - effect.startScale) * progress)
      return true
    })
  }
}

function shipTexture(textures: GameTextures, kind: ShipKind, damageStage: number): Texture {
  return textures.ships[`ship_${SHIP_SPRITE_NUMBER[kind] + damageStage * SPRITES_PER_DAMAGE_STAGE}`]
}

function hullScale(ship: Ship, textures: GameTextures): number {
  return (ship.radius * HULL_LENGTH_IN_RADII) / shipTexture(textures, ship.kind, 0).height
}

/** Ship sprites are drawn with the bow pointing down. */
function hullRotation(heading: number): number {
  return heading - Math.PI / 2
}

function syncViews<Item extends Ship | Projectile, View extends Container>(
  items: Item[],
  views: Map<number, View>,
  layer: Container,
  createView: (item: Item) => View,
): void {
  const liveIds = new Set(items.map((item) => item.id))
  for (const [id, view] of views) {
    if (liveIds.has(id)) continue
    view.destroy({ children: true })
    views.delete(id)
  }
  for (const item of items) {
    if (views.has(item.id)) continue
    const view = createView(item)
    views.set(item.id, view)
    layer.addChild(view)
  }
}
