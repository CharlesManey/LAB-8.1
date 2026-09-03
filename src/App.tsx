import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppView, Card, Deck } from './types'
import { createId, loadActiveDeckId, loadDecks, saveActiveDeckId, saveDecks } from './storage'
import './App.css'

type DeckDraft = { name: string; description: string }
type CardDraft = { front: string; back: string }

const emptyDeckDraft: DeckDraft = { name: '', description: '' }
const emptyCardDraft: CardDraft = { front: '', back: '' }
const THEME_STORAGE_KEY = 'flashcards-theme'

const initialDecks = loadDecks()

function App() {
	const [decks, setDecks] = useState<Deck[]>(initialDecks)
	const [activeDeckId, setActiveDeckId] = useState(() => {
		const savedId = loadActiveDeckId()
		return initialDecks.some((deck) => deck.id === savedId) ? savedId : initialDecks[0]?.id ?? null
	})
	const [view, setView] = useState<AppView>('library')
	const [search, setSearch] = useState('')
	const [deckDraft, setDeckDraft] = useState<DeckDraft>(emptyDeckDraft)
	const [cardDraft, setCardDraft] = useState<CardDraft>(emptyCardDraft)
	const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
	const [editingCardId, setEditingCardId] = useState<string | null>(null)
	const [showDeckForm, setShowDeckForm] = useState(false)
	const [showCardForm, setShowCardForm] = useState(false)
	const [studyCardIds, setStudyCardIds] = useState<string[]>([])
	const [studyIndex, setStudyIndex] = useState(0)
	const [isRevealed, setIsRevealed] = useState(false)
	const [studyBoundaryMessage, setStudyBoundaryMessage] = useState('')
	const [isDarkTheme, setIsDarkTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) === 'dark')
	const modalRef = useRef<HTMLFormElement>(null)
	const previouslyFocusedElement = useRef<HTMLElement | null>(null)

	const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null
	const filteredCards = useMemo(() => {
		if (!activeDeck) return []
		const query = search.trim().toLowerCase()
		if (!query) return activeDeck.cards
		return activeDeck.cards.filter((card) => `${card.front} ${card.back}`.toLowerCase().includes(query))
	}, [activeDeck, search])
	const studyCard = activeDeck?.cards.find((card) => card.id === studyCardIds[studyIndex]) ?? null
	const studyState = useRef({ view, studyCard, studyCardCount: studyCardIds.length, studyIndex })

	useEffect(() => {
		studyState.current = { view, studyCard, studyCardCount: studyCardIds.length, studyIndex }
	}, [studyCard, studyCardIds.length, studyIndex, view])

	useEffect(() => {
		if (view !== 'study' || !studyCard) return
		const frameId = window.requestAnimationFrame(() => {
			document.querySelector<HTMLButtonElement>('.flashcard')?.focus()
		})
		return () => window.cancelAnimationFrame(frameId)
	}, [studyCard, view])

	useEffect(() => {
		saveDecks(decks)
	}, [decks])

	useEffect(() => {
		saveActiveDeckId(activeDeckId)
	}, [activeDeckId])

	useEffect(() => {
		localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light')
		document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light'
	}, [isDarkTheme])

	useEffect(() => {
		const onStudyKeyDown = (event: KeyboardEvent) => {
			const currentStudy = studyState.current
			if (currentStudy.view !== 'study' || !currentStudy.studyCard) return
			if (event.key === 'ArrowRight') {
				event.preventDefault()
				if (currentStudy.studyIndex === currentStudy.studyCardCount - 1) {
					setStudyBoundaryMessage('You are at the end of this deck.')
					return
				}
				setStudyIndex((index) => index + 1)
				setIsRevealed(false)
				setStudyBoundaryMessage('')
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault()
				if (currentStudy.studyIndex === 0) {
					setStudyBoundaryMessage('You are at the beginning of this deck.')
					return
				}
				setStudyIndex((index) => index - 1)
				setIsRevealed(false)
				setStudyBoundaryMessage('')
			}
		}
		window.addEventListener('keydown', onStudyKeyDown)
		return () => window.removeEventListener('keydown', onStudyKeyDown)
	}, [])

	const closeModal = () => {
		setShowDeckForm(false)
		setShowCardForm(false)
	}

	useEffect(() => {
		const modalIsOpen = showDeckForm || showCardForm
		if (!modalIsOpen) return

		previouslyFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
		const modal = modalRef.current
		if (!modal) return
		const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
		const getFocusableElements = () => Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
		const firstFocusableElement = getFocusableElements()[0]
		firstFocusableElement?.focus()

		const onModalKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				closeModal()
				return
			}
			if (event.key !== 'Tab') return
			const focusableElements = getFocusableElements()
			if (!focusableElements.length) return
			const firstElement = focusableElements[0]
			const lastElement = focusableElements[focusableElements.length - 1]
			if (event.shiftKey && document.activeElement === firstElement) {
				event.preventDefault()
				lastElement.focus()
			} else if (!event.shiftKey && document.activeElement === lastElement) {
				event.preventDefault()
				firstElement.focus()
			}
		}

		modal.addEventListener('keydown', onModalKeyDown)
		return () => {
			modal.removeEventListener('keydown', onModalKeyDown)
			previouslyFocusedElement.current?.focus()
			previouslyFocusedElement.current = null
		}
	}, [showCardForm, showDeckForm])

	const updateActiveDeck = (update: (deck: Deck) => Deck) => {
		setDecks((current) => current.map((deck) => (deck.id === activeDeckId ? update(deck) : deck)))
	}

	const selectDeck = (deckId: string) => {
		const selectedDeck = decks.find((deck) => deck.id === deckId)
		setActiveDeckId(deckId)
		setSearch('')
		setIsRevealed(false)
		if (view === 'study') {
			setStudyCardIds(selectedDeck?.cards.map((card) => card.id) ?? [])
			setStudyIndex(0)
		}
	}

	const openNewDeck = () => {
		setEditingDeckId(null)
		setDeckDraft(emptyDeckDraft)
		setShowDeckForm(true)
	}

	const openEditDeck = (deck: Deck) => {
		setEditingDeckId(deck.id)
		setDeckDraft({ name: deck.name, description: deck.description })
		setShowDeckForm(true)
	}

	const saveDeck = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const name = deckDraft.name.trim()
		if (!name) return
		if (editingDeckId) {
			setDecks((current) => current.map((deck) => deck.id === editingDeckId ? { ...deck, ...deckDraft, name } : deck))
		} else {
			const deck = { id: createId(), name, description: deckDraft.description.trim(), cards: [] }
			setDecks((current) => [...current, deck])
			setActiveDeckId(deck.id)
		}
		setShowDeckForm(false)
		setDeckDraft(emptyDeckDraft)
	}

	const deleteDeck = (deck: Deck) => {
		if (!window.confirm(`Delete “${deck.name}” and all of its cards?`)) return
		const remaining = decks.filter((item) => item.id !== deck.id)
		setDecks(remaining)
		if (activeDeckId === deck.id) setActiveDeckId(remaining[0]?.id ?? null)
	}

	const openNewCard = () => {
		setEditingCardId(null)
		setCardDraft(emptyCardDraft)
		setShowCardForm(true)
	}

	const openEditCard = (card: Card) => {
		setEditingCardId(card.id)
		setCardDraft({ front: card.front, back: card.back })
		setShowCardForm(true)
	}

	const saveCard = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!cardDraft.front.trim() || !cardDraft.back.trim()) return
		updateActiveDeck((deck) => ({
			...deck,
			cards: editingCardId
				? deck.cards.map((card) => card.id === editingCardId ? { ...card, front: cardDraft.front.trim(), back: cardDraft.back.trim() } : card)
				: [...deck.cards, { id: createId(), front: cardDraft.front.trim(), back: cardDraft.back.trim() }],
		}))
		setShowCardForm(false)
		setCardDraft(emptyCardDraft)
	}

	const deleteCard = (cardId: string) => {
		if (!window.confirm('Delete this card?')) return
		updateActiveDeck((deck) => ({ ...deck, cards: deck.cards.filter((card) => card.id !== cardId) }))
		setStudyCardIds((ids) => ids.filter((id) => id !== cardId))
	}

	const startStudy = (shuffle = false) => {
		if (!activeDeck?.cards.length) return
		const ids = activeDeck.cards.map((card) => card.id)
		if (shuffle) {
			for (let index = ids.length - 1; index > 0; index -= 1) {
				const randomIndex = Math.floor(Math.random() * (index + 1))
				;[ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]]
			}
		}
		setStudyCardIds(ids)
		setStudyIndex(0)
		setIsRevealed(false)
		setStudyBoundaryMessage('')
		setView('study')
	}

	function moveStudy(direction: number) {
		if (direction < 0 && studyIndex === 0) {
			setStudyBoundaryMessage('You are at the beginning of this deck.')
			return
		}
		if (direction > 0 && studyIndex === studyCardIds.length - 1) {
			setStudyBoundaryMessage('You are at the end of this deck.')
			return
		}
		setStudyIndex((index) => index + direction)
		setIsRevealed(false)
		setStudyBoundaryMessage('')
	}

	const progress = studyCardIds.length
		? `${studyIndex + 1} / ${studyCardIds.length}${studyBoundaryMessage ? ` · ${studyBoundaryMessage}` : ''}`
		: '0 / 0'

	return (
		<div className={`app-shell min-h-screen bg-[#f4f7f5] text-[#17232b] ${isDarkTheme ? 'dark-theme' : ''}`}>
			<header className="border-b border-[#dbe5df] bg-[#fbfdfb]">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
					<button className="flex items-center gap-3 text-left" onClick={() => setView('library')} aria-label="Go to library">
						<span className="grid h-10 w-10 place-items-center rounded-xl bg-[#153e42] text-lg font-bold text-[#f7c873]">R</span>
						<span><span className="block font-serif text-xl font-bold tracking-tight">Recall</span><span className="block text-xs uppercase tracking-[0.2em] text-[#6f7e7b]">Your mind, organised</span></span>
					</button>
					<nav aria-label="Primary navigation" className="view-nav flex items-center gap-2 rounded-full bg-[#edf3ef] p-1 text-sm font-semibold">
						<button className={`view-pill rounded-full px-4 py-2 ${view === 'library' ? 'view-pill-active bg-white text-[#153e42] shadow-sm' : 'text-[#71807c]'}`} onClick={() => setView('library')}>Library</button>
						<button className={`view-pill rounded-full px-4 py-2 ${view === 'study' ? 'view-pill-active bg-white text-[#153e42] shadow-sm' : 'text-[#71807c]'}`} onClick={() => startStudy()} disabled={!activeDeck?.cards.length}>Study</button>
						<button className="theme-toggle rounded-full px-3 py-2 text-base" type="button" aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={isDarkTheme} onKeyDown={(event) => { if (event.key === ' ') event.preventDefault() }} onClick={() => setIsDarkTheme((isDark) => !isDark)}>{isDarkTheme ? '☀' : '☾'}</button>
					</nav>
				</div>
			</header>

			<main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[255px_1fr] lg:px-10 lg:py-12">
				<aside className="lg:border-r lg:border-[#dbe5df] lg:pr-7">
					<div className="mb-5 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f7e7b]">Your decks</h2><button className="rounded-lg bg-[#e9a23b] px-3 py-2 text-sm font-bold text-[#17232b] shadow-sm transition hover:bg-[#f2b65a]" onClick={openNewDeck}>+ New deck</button></div>
					{decks.length === 0 ? <p className="rounded-xl border border-dashed border-[#c9d8d0] p-4 text-sm leading-6 text-[#71807c]">Your first deck is one click away.</p> : <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2">{decks.map((deck) => <button key={deck.id} onClick={() => selectDeck(deck.id)} className={`min-w-45 rounded-xl border p-4 text-left transition lg:w-full ${deck.id === activeDeckId ? 'border-[#153e42] bg-[#153e42] text-white shadow-md' : 'border-[#dbe5df] bg-white hover:border-[#99b4ac]'}`}><span className="block truncate font-bold">{deck.name}</span><span className={`mt-1 block text-xs ${deck.id === activeDeckId ? 'text-[#c5d9d0]' : 'text-[#71807c]'}`}>{deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}</span></button>)}</div>}
				</aside>

				<section aria-labelledby="page-title" className="min-w-0">
					{view === 'library' ? <>
						<div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#d2831d]">Library</p><h1 id="page-title" className="font-serif text-4xl font-bold tracking-tight text-[#153e42] sm:text-5xl">{activeDeck?.name ?? 'Make space for learning.'}</h1><p className="mt-3 max-w-xl text-[#71807c]">{activeDeck?.description || 'Create a deck, add a few cards, and build a practice habit that lasts.'}</p></div>{activeDeck && <div className="flex gap-2"><button className="rounded-lg border border-[#b9ccc3] bg-white px-3 py-2 text-sm font-bold hover:border-[#153e42]" onClick={() => openEditDeck(activeDeck)}>Edit deck</button><button className="rounded-lg border border-[#e4b7a9] bg-[#fff8f5] px-3 py-2 text-sm font-bold text-[#a74b35] hover:bg-[#fcede8]" onClick={() => deleteDeck(activeDeck)}>Delete</button></div>}</div>
						{!activeDeck ? <div className="rounded-2xl border border-dashed border-[#b9ccc3] bg-white px-6 py-16 text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#f7e6c5] text-2xl text-[#a96715]">+</div><h2 className="font-serif text-2xl font-bold text-[#153e42]">Start with a deck</h2><p className="mx-auto mt-2 max-w-sm text-[#71807c]">Keep related ideas together and make review feel lighter.</p><button className="mt-6 rounded-lg bg-[#153e42] px-5 py-3 font-bold text-white hover:bg-[#20575b]" onClick={openNewDeck}>Create your first deck</button></div> : <>
							<div className="mb-5 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Search cards</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search front or back of a card..." className="w-full rounded-lg border border-[#c9d8d0] bg-white px-4 py-3 text-sm placeholder:text-[#9aa9a4]" />{search && <button aria-label="Clear search" className="absolute right-3 top-2.5 px-2 py-1 text-lg text-[#71807c]" onClick={() => setSearch('')}>×</button>}</label><button className="rounded-lg bg-[#153e42] px-5 py-3 text-sm font-bold text-white hover:bg-[#20575b]" onClick={openNewCard}>+ Add card</button><button className="rounded-lg border border-[#b9ccc3] bg-white px-5 py-3 text-sm font-bold text-[#153e42] disabled:cursor-not-allowed disabled:opacity-40" disabled={!activeDeck.cards.length} onClick={() => startStudy(true)}>Shuffle study</button></div>
							<div className="mb-4 flex items-center justify-between text-sm text-[#71807c]"><span>{filteredCards.length} of {activeDeck.cards.length} cards</span>{search && <span>Matching “{search}”</span>}</div>
							{filteredCards.length ? <div className="grid gap-4 xl:grid-cols-2">{filteredCards.map((card, index) => <article key={card.id} className="group rounded-xl border border-[#dbe5df] bg-white p-5 shadow-[0_3px_12px_rgba(21,62,66,0.04)]"><div className="mb-5 flex items-start justify-between gap-4"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[#d2831d]">Card {index + 1}</span><div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button className="rounded px-2 py-1 text-xs font-bold text-[#52716d] hover:bg-[#edf3ef]" onClick={() => openEditCard(card)}>Edit</button><button className="rounded px-2 py-1 text-xs font-bold text-[#a74b35] hover:bg-[#fcede8]" onClick={() => deleteCard(card.id)}>Delete</button></div></div><p className="font-serif text-xl font-bold leading-snug text-[#153e42]">{card.front}</p><div className="my-4 border-t border-dashed border-[#dbe5df]" /><p className="text-sm leading-6 text-[#52716d]">{card.back}</p></article>)}</div> : <div className="rounded-xl border border-dashed border-[#b9ccc3] bg-white px-6 py-16 text-center"><h2 className="font-serif text-2xl font-bold text-[#153e42]">{search ? 'No cards found' : 'Your deck is ready'}</h2><p className="mt-2 text-[#71807c]">{search ? 'Try another keyword or clear your search.' : 'Add your first prompt and answer to begin.'}</p>{!search && <button className="mt-5 rounded-lg bg-[#153e42] px-5 py-3 font-bold text-white" onClick={openNewCard}>Add first card</button>}</div>}
						</>}
					</> : <>
						<div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-[#d2831d]">Study mode</p><h1 id="page-title" className="font-serif text-4xl font-bold tracking-tight text-[#153e42]">{activeDeck?.name}</h1></div><button className="rounded-lg border border-[#b9ccc3] bg-white px-4 py-2 text-sm font-bold text-[#153e42]" onClick={() => startStudy(true)}>Shuffle again</button></div>
						{!studyCard ? <div className="rounded-2xl border border-dashed border-[#b9ccc3] bg-white px-6 py-16 text-center"><h2 className="font-serif text-2xl font-bold text-[#153e42]">Nothing to study yet</h2><p className="mt-2 text-[#71807c]">Add at least one card to this deck, then come back here.</p><button className="mt-5 rounded-lg bg-[#153e42] px-5 py-3 font-bold text-white" onClick={() => setView('library')}>Back to library</button></div> : <div className="mx-auto max-w-3xl"><div className="mb-4 flex justify-between text-sm font-bold text-[#71807c]"><span>Card {progress}</span><span>{isRevealed ? 'Answer revealed' : 'Think first'}</span></div><div className="flashcard-scene"><button aria-label={isRevealed ? 'Hide answer' : 'Reveal answer'} className="flashcard min-h-90 w-full rounded-2xl text-left" onClick={() => setIsRevealed((revealed) => !revealed)}><span className={`flashcard-inner ${isRevealed ? 'is-flipped' : ''}`}><span className="flashcard-face flashcard-front rounded-2xl border border-[#b9ccc3] bg-white p-8 text-left shadow-[0_12px_30px_rgba(21,62,66,0.08)] sm:p-14"><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#d2831d]">Prompt</span><span className="mt-8 block font-serif text-3xl font-bold leading-tight text-[#153e42] sm:text-5xl">{studyCard.front}</span><span className="mt-12 block text-sm text-[#9aa9a4]">Click or press Space to reveal</span></span><span className="flashcard-face flashcard-back rounded-2xl border border-[#b9ccc3] bg-[#153e42] p-8 text-left shadow-[0_12px_30px_rgba(21,62,66,0.08)] sm:p-14"><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#f7c873]">Answer</span><span className="mt-8 block font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">{studyCard.back}</span><span className="mt-12 block text-sm text-[#c5d9d0]">Click or press Space to hide</span></span></span></button></div><div className="mt-6 flex items-center justify-between gap-3"><button className="rounded-lg border border-[#b9ccc3] bg-white px-4 py-3 text-sm font-bold text-[#153e42] disabled:opacity-40" disabled={studyIndex === 0} onClick={() => moveStudy(-1)}>← Previous</button><button className="rounded-lg bg-[#e9a23b] px-5 py-3 text-sm font-bold text-[#17232b] disabled:opacity-40" disabled={studyIndex === studyCardIds.length - 1} onClick={() => moveStudy(1)}>Next →</button></div></div>}
					</>}
				</section>
			</main>

			{showDeckForm && <div className="fixed inset-0 z-10 grid place-items-center bg-[#153e42]/40 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}><form ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="deck-modal-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onSubmit={saveDeck}><h2 id="deck-modal-title" className="font-serif text-2xl font-bold text-[#153e42]">{editingDeckId ? 'Edit deck' : 'New deck'}</h2><label className="mt-6 block text-sm font-bold">Name<input required maxLength={60} value={deckDraft.name} onChange={(event) => setDeckDraft({ ...deckDraft, name: event.target.value })} className="mt-2 w-full rounded-lg border border-[#c9d8d0] px-3 py-3" /></label><label className="mt-4 block text-sm font-bold">Description <span className="font-normal text-[#9aa9a4]">(optional)</span><textarea maxLength={160} value={deckDraft.description} onChange={(event) => setDeckDraft({ ...deckDraft, description: event.target.value })} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[#c9d8d0] px-3 py-3" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg px-4 py-2 text-sm font-bold text-[#71807c]" onClick={closeModal}>Cancel</button><button className="rounded-lg bg-[#153e42] px-5 py-2 text-sm font-bold text-white" type="submit">Save deck</button></div></form></div>}
			{showCardForm && <div className="fixed inset-0 z-10 grid place-items-center bg-[#153e42]/40 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}><form ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="card-modal-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onSubmit={saveCard}><h2 id="card-modal-title" className="font-serif text-2xl font-bold text-[#153e42]">{editingCardId ? 'Edit card' : 'New card'}</h2><label className="mt-6 block text-sm font-bold">Front<input required maxLength={300} value={cardDraft.front} onChange={(event) => setCardDraft({ ...cardDraft, front: event.target.value })} className="mt-2 w-full rounded-lg border border-[#c9d8d0] px-3 py-3" placeholder="What do you want to remember?" /></label><label className="mt-4 block text-sm font-bold">Back<textarea required maxLength={600} value={cardDraft.back} onChange={(event) => setCardDraft({ ...cardDraft, back: event.target.value })} className="mt-2 min-h-32 w-full resize-y rounded-lg border border-[#c9d8d0] px-3 py-3" placeholder="Write the answer..." /></label><div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg px-4 py-2 text-sm font-bold text-[#71807c]" onClick={closeModal}>Cancel</button><button className="rounded-lg bg-[#153e42] px-5 py-2 text-sm font-bold text-white" type="submit">Save card</button></div></form></div>}
		</div>
	)
}

export default App
