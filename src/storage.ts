import type { Card, Deck } from './types'

export const DECKS_STORAGE_KEY = 'flashcards-decks'
export const ACTIVE_DECK_STORAGE_KEY = 'flashcards-active-deck'

export const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const isCard = (value: unknown): value is Card => {
  if (!value || typeof value !== 'object') return false
  const card = value as Record<string, unknown>
  return typeof card.id === 'string' && typeof card.front === 'string' && typeof card.back === 'string'
}

const isDeck = (value: unknown): value is Deck => {
  if (!value || typeof value !== 'object') return false
  const deck = value as Record<string, unknown>
  return (
    typeof deck.id === 'string' &&
    typeof deck.name === 'string' &&
    typeof deck.description === 'string' &&
    Array.isArray(deck.cards) &&
    deck.cards.every(isCard)
  )
}

export const loadDecks = (): Deck[] => {
  try {
    const stored = localStorage.getItem(DECKS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.every(isDeck) ? parsed : []
  } catch {
    return []
  }
}

export const saveDecks = (decks: Deck[]) => {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks))
  } catch (error) {
    void error
  }
}

export const loadActiveDeckId = () => {
  try {
    return localStorage.getItem(ACTIVE_DECK_STORAGE_KEY)
  } catch {
    return null
  }
}

export const saveActiveDeckId = (deckId: string | null) => {
  try {
    if (deckId) localStorage.setItem(ACTIVE_DECK_STORAGE_KEY, deckId)
    else localStorage.removeItem(ACTIVE_DECK_STORAGE_KEY)
  } catch (error) {
    void error
  }
}
