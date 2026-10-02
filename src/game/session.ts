import { Application, type Ticker } from 'pixi.js'
import { createStore, type Store } from '../storage'
import type { GameTextures } from './assets'
import { playSound, setLoopPlaying, type Sound } from './audio'
import type { GameConfig } from './config'
import { listenToKeyboard } from './input'
import { ArenaRenderer } from './renderer'
import './testApi'
import {
  STEP_SECONDS,
  createInputState,
  createMatch,
  stepMatch,
  type Action,
  type EndReason,
  type GameEvent,
  type Match,
} from './simulation'

export interface HudState {
  phase: 'running' | 'paused' | 'ended'
  score: number
  secondsLeft: number
  health: number
  maxHealth: number
}

export interface MatchSummary {
  score: number
  durationSeconds: number
  endReason: EndReason
}

export interface SessionCallbacks {
  /** Called the moment the match ends, so the result is recorded even if the page closes right after. */
  onEnd: (summary: MatchSummary) => void
  onLeave: () => void
}

const urlParams = new URLSearchParams(location.search)
const TEST_API_ENABLED = urlParams.has('e2e')
const MANUAL_CLOCK = urlParams.get('clock') === 'manual'
const FIXED_SEED = urlParams.get('seed')

/** A longer frame (a stalled tab, a breakpoint) is cut short instead of fast-forwarding the match. */
const MAX_FRAME_SECONDS = 0.25
/** Lets the final explosion play before the result screen replaces the arena. */
const LEAVE_DELAY_MS = 1200
const LOW_HEALTH_RATIO = 0.3
const TIME_WARNING_SECONDS = 10

export class GameSession {
  readonly hud: Store<HudState>
  private match: Match
  private input = createInputState()
  private renderer: ArenaRenderer
  private unspentSeconds = 0
  private stopKeyboard = () => {}
  private listeners = new AbortController()
  private leaveTimer?: number

  /** Resolves to nothing when cancelled while PixiJS was still initializing. */
  static async start(
    container: HTMLElement,
    textures: GameTextures,
    config: GameConfig,
    callbacks: SessionCallbacks,
    cancellation: AbortSignal,
  ): Promise<GameSession | undefined> {
    if (cancellation.aborted) return
    const app = new Application()
    await app.init({ resizeTo: container, resolution: window.devicePixelRatio, autoDensity: true })
    if (cancellation.aborted) {
      app.destroy()
      return
    }
    container.appendChild(app.canvas)
    return new GameSession(app, textures, config, callbacks)
  }

  private constructor(
    private app: Application,
    textures: GameTextures,
    config: GameConfig,
    private callbacks: SessionCallbacks,
  ) {
    this.match = createMatch(config, FIXED_SEED ? Number(FIXED_SEED) : Date.now())
    this.hud = createStore<HudState>({ phase: 'running', ...this.hudValues() })

    this.renderer = new ArenaRenderer(textures)
    this.renderer.resize(app.screen.width)
    app.renderer.on('resize', (width) => this.renderer.resize(width))
    app.stage.addChild(this.renderer.world)
    this.renderer.render(this.match, 0)

    app.ticker.add(this.onTick)
    this.stopKeyboard = listenToKeyboard(this.input, this.pause)
    window.addEventListener('blur', this.pause, { signal: this.listeners.signal })
    document.addEventListener('visibilitychange', this.pauseWhenHidden, { signal: this.listeners.signal })

    if (TEST_API_ENABLED) window.__pirateBattle = { match: this.match, advance: this.advanceManually }
    playSound('game_start')
  }

  pause = (): void => {
    if (this.hud.get().phase !== 'running') return
    this.releaseControls()
    this.setPhase('paused')
    playSound('game_pause')
  }

  resume(): void {
    if (this.hud.get().phase !== 'paused') return
    this.unspentSeconds = 0
    this.stopKeyboard = listenToKeyboard(this.input, this.pause)
    this.setPhase('running')
    playSound('game_resume')
  }

  setAction(action: Action, pressed: boolean): void {
    this.input[action] = pressed && this.hud.get().phase === 'running'
  }

  destroy(): void {
    this.releaseControls()
    this.listeners.abort()
    window.clearTimeout(this.leaveTimer)
    this.app.ticker.remove(this.onTick)
    this.renderer.destroy()
    this.app.destroy(true, { children: true })
    if (TEST_API_ENABLED) delete window.__pirateBattle
  }

  private onTick = (ticker: Ticker): void => {
    if (!MANUAL_CLOCK) this.frame(Math.min(ticker.deltaMS / 1000, MAX_FRAME_SECONDS))
  }

  private advanceManually = (milliseconds: number): void => {
    const frames = Math.round(milliseconds / 1000 / STEP_SECONDS)
    for (let i = 0; i < frames; i++) this.frame(STEP_SECONDS)
  }

  private pauseWhenHidden = (): void => {
    if (document.hidden) this.pause()
  }

  private frame(deltaSeconds: number): void {
    const { phase } = this.hud.get()
    if (phase === 'paused') return

    if (phase === 'running') {
      this.unspentSeconds += deltaSeconds
      while (this.unspentSeconds >= STEP_SECONDS) {
        stepMatch(this.match, this.input, STEP_SECONDS)
        this.unspentSeconds -= STEP_SECONDS
      }
      setLoopPlaying('ocean_ambience_loop', true)
      setLoopPlaying('ship_sailing_loop', this.input.forward)
    }

    this.renderer.render(this.match, deltaSeconds)
    this.presentEvents()
    this.syncHud()
    if (phase === 'running' && this.match.endReason) this.finish(this.match.endReason)
  }

  private presentEvents(): void {
    for (const event of this.match.events) {
      this.renderer.showEvent(event)
      playSound(eventSound(event))
    }
    this.match.events.length = 0
  }

  private syncHud(): void {
    const previous = this.hud.get()
    const next = { ...previous, ...this.hudValues() }
    if (next.score === previous.score && next.secondsLeft === previous.secondsLeft && next.health === previous.health) {
      return
    }
    this.hud.set(next)

    const lowHealth = next.maxHealth * LOW_HEALTH_RATIO
    if (next.score > previous.score) playSound('score_point')
    if (next.health <= lowHealth && previous.health > lowHealth) playSound('health_low')
    if (next.secondsLeft === TIME_WARNING_SECONDS && previous.secondsLeft > TIME_WARNING_SECONDS) {
      playSound('time_warning')
    }
  }

  private hudValues() {
    const { score, player, config, elapsedSeconds } = this.match
    return {
      score,
      secondsLeft: Math.ceil(config.sessionSeconds - elapsedSeconds),
      health: Math.max(0, player.health),
      maxHealth: player.maxHealth,
    }
  }

  private finish(endReason: EndReason): void {
    this.releaseControls()
    this.setPhase('ended')
    playSound(endReason === 'time_up' ? 'game_complete' : 'game_over')

    this.callbacks.onEnd({ score: this.match.score, durationSeconds: Math.round(this.match.elapsedSeconds), endReason })
    this.leaveTimer = window.setTimeout(this.callbacks.onLeave, LEAVE_DELAY_MS)
  }

  private setPhase(phase: HudState['phase']): void {
    this.hud.set({ ...this.hud.get(), phase })
  }

  private releaseControls(): void {
    this.stopKeyboard()
    Object.assign(this.input, createInputState())
    setLoopPlaying('ocean_ambience_loop', false)
    setLoopPlaying('ship_sailing_loop', false)
  }
}

function eventSound(event: GameEvent): Sound {
  switch (event.type) {
    case 'shot':
      return event.broadside ? 'cannon_broadside' : 'cannon_fire_1'
    case 'hit':
      return 'ship_wood_hit_1'
    case 'miss':
      return event.onLand ? 'ship_wood_hit_1' : 'cannonball_water_hit_1'
    case 'destroyed':
      return 'ship_explosion_1'
  }
}
