import { createPersistentStore } from '../storage'
import { ASSETS_URL } from './assets'

export type Sound =
  | 'cannon_fire_1'
  | 'cannon_broadside'
  | 'ship_wood_hit_1'
  | 'cannonball_water_hit_1'
  | 'ship_explosion_1'
  | 'score_point'
  | 'health_low'
  | 'time_warning'
  | 'game_start'
  | 'game_complete'
  | 'game_over'
  | 'game_pause'
  | 'game_resume'
  | 'ui_click'

export type Loop = 'ocean_ambience_loop' | 'ship_sailing_loop'

export const mutedStore = createPersistentStore('muted', false)

const players = new Map<string, HTMLAudioElement>()

function player(name: Sound | Loop): HTMLAudioElement {
  let audio = players.get(name)
  if (!audio) {
    audio = new Audio(`${ASSETS_URL}sounds/${name}.wav`)
    players.set(name, audio)
  }
  return audio
}

/** Browsers reject playback before the first user gesture; sound is optional, so that is ignored. */
function play(audio: HTMLAudioElement): void {
  audio.play().catch(() => {})
}

export function playSound(name: Sound): void {
  if (mutedStore.get()) return
  const audio = player(name)
  audio.currentTime = 0
  play(audio)
}

export function setLoopPlaying(name: Loop, playing: boolean): void {
  const audio = player(name)
  audio.loop = true
  audio.volume = 0.4
  if (playing && !mutedStore.get()) {
    if (audio.paused) play(audio)
  } else {
    audio.pause()
  }
}

mutedStore.subscribe(() => {
  if (mutedStore.get()) players.forEach((audio) => audio.pause())
})
