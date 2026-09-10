/**
 * The passage, and the fragments of it that surface as you act.
 *
 * Ambient by design: a fragment appears when something happens that the passage
 * already describes, then fades. Nothing here blocks the scene, and the full
 * text stays one click away rather than being read at you.
 */
export const FULL_TEXT = `Imagine that the educational mission of the University of Chicago is a massive oblong table, positioned in our central Quad, around which each of our faculty and instructors takes a seat. On that table, scattered about, are objects that are powerful, flexible, and constantly changing. They are available, responsive, and easy to use. These objects represent AI, a technology that emerges from deep fields of knowledge in computer science, data science, and related disciplines. But the mandate of this pedagogical gathering extends to us all, regardless of our area of scholarly expertise: to consider these AI objects in relation to our learning goals. Some of us pick up these objects and mold them to our teaching agendas in original, remarkable ways; others select some of them and develop a precise methodology for their placement and use. Yet others of us handle and explore them, and then deliberately set them aside. Importantly, this process does not take place in silence, but in candid conversation. We ask questions of our neighbors and seatmates, and we share ideas, insights, and concerns. We discuss the ongoing transformations of these objects and their implications for our pedagogical aims. We reflect on how our teaching and mentoring prepares our students to learn, work, and live in a world where AI objects matter, and where they will likely matter in ways we do not yet anticipate. Over the course of our gathering, an uneven but dynamic table topography emerges, as we continually test, manipulate, and move these objects. Notably, that topography is not fixed, but it shifts: as the AI objects change, as our engagement with them changes, and as we learn more from each other, from teaching, and, importantly, from our students.`

export const CITATION = 'AI in Education report, University of Chicago'

/** Keyed to moments in the experience; <em> marks the clause being enacted. */
export const FRAGMENTS = {
  arrive: 'On that table, scattered about, are objects that are <em>powerful, flexible, and constantly changing</em>.',
  take: 'They are <em>available, responsive, and easy to use</em>.',
  consider: 'The mandate of this pedagogical gathering extends to us all: <em>to consider these AI objects in relation to our learning goals</em>.',
  mold: 'Some of us pick up these objects and <em>mold them to our teaching agendas in original, remarkable ways</em>.',
  method: 'Others select some of them and <em>develop a precise methodology for their placement and use</em>.',
  aside: 'Yet others of us handle and explore them, and then <em>deliberately set them aside</em>.',
  neighbour: 'We ask questions of our <em>neighbors and seatmates</em>, and we share ideas, insights, and concerns.',
  conversation: 'Importantly, this process does not take place in silence, but <em>in candid conversation</em>.',
  student: 'The topography shifts as we learn more from each other, from teaching, and, importantly, <em>from our students</em>.',
  drift: 'Notably, that topography is <em>not fixed, but it shifts</em>.',
  emerge: 'An <em>uneven but dynamic table topography</em> emerges, as we continually test, manipulate, and move these objects.',
  moved: 'We continually <em>test, manipulate, and move these objects</em>.',
  anticipate: 'They will likely matter <em>in ways we do not yet anticipate</em>.',
}

const HOLD_MS = 7200

export class PassageDisplay {
  constructor(el) {
    this.el = el
    this.timer = 0
    this.lastKey = null
  }

  show(key, { force = false } = {}) {
    const text = FRAGMENTS[key]
    if (!text) return
    if (!force && key === this.lastKey) return
    this.lastKey = key
    this.el.innerHTML = text
    this.el.classList.add('show')
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.el.classList.remove('show'), HOLD_MS)
  }

  clear() {
    clearTimeout(this.timer)
    this.el.classList.remove('show')
    this.lastKey = null
  }
}

export class HintDisplay {
  constructor(el) { this.el = el }
  set(text) {
    if (!text) { this.el.classList.remove('show'); return }
    this.el.textContent = text
    this.el.classList.add('show')
  }
}
