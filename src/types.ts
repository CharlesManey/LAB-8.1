export type Card = {
  id: string
  front: string
  back: string
}

export type Deck = {
  id: string
  name: string
  description: string
  cards: Card[]
}

export type AppView = 'library' | 'study'
