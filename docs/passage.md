# Source passage

> Imagine that the educational mission of the University of Chicago is a massive oblong table,
> positioned in our central Quad, around which each of our faculty and instructors takes a seat.
> On that table, scattered about, are objects that are powerful, flexible, and constantly changing.
> They are available, responsive, and easy to use. These objects represent AI, a technology that
> emerges from deep fields of knowledge in computer science, data science, and related disciplines.
> But the mandate of this pedagogical gathering extends to us all, regardless of our area of
> scholarly expertise: to consider these AI objects in relation to our learning goals. Some of us
> pick up these objects and mold them to our teaching agendas in original, remarkable ways; others
> select some of them and develop a precise methodology for their placement and use. Yet others of
> us handle and explore them, and then deliberately set them aside. Importantly, this process does
> not take place in silence, but in candid conversation. We ask questions of our neighbors and
> seatmates, and we share ideas, insights, and concerns. We discuss the ongoing transformations of
> these objects and their implications for our pedagogical aims. We reflect on how our teaching and
> mentoring prepares our students to learn, work, and live in a world where AI objects matter, and
> where they will likely matter in ways we do not yet anticipate. Over the course of our gathering,
> an uneven but dynamic table topography emerges, as we continually test, manipulate, and move
> these objects. Notably, that topography is not fixed, but it shifts: as the AI objects change, as
> our engagement with them changes, and as we learn more from each other, from teaching, and,
> importantly, from our students.

## Source

**Artificial Intelligence and Education at the University of Chicago**
Report by the Artificial Intelligence and Education Working Group (AIEWG)
University of Chicago, July 2025 — 16 pages

The passage is the fourth paragraph of the **Preamble**, spanning pages 1–2. It
is quoted here character-for-character; the text in `web/src/ui/passage.js`,
which is what the reader panel displays, is verified identical to the report.

Chaired by Emily Lynn Osborn. Members: John S. Anderson, Kemal Badur, Lynn
Barnett, Samantha Fenno, Victor O. Lima, Jason N. MacLean, Robin Paige, Andrei
Pop, Abigail Reardon, Torsten Reimer, Borja Sotomayor, David Uminsky.

### Citation

Chicago, note:

> Artificial Intelligence and Education Working Group, "Artificial
> Intelligence and Education at the University of Chicago" (University of
> Chicago, July 2025), 1–2.

Chicago, bibliography:

> Artificial Intelligence and Education Working Group. "Artificial
> Intelligence and Education at the University of Chicago." University of
> Chicago, July 2025.

APA:

> Artificial Intelligence and Education Working Group. (2025, July).
> *Artificial intelligence and education at the University of Chicago*.
> University of Chicago.

MLA:

> Artificial Intelligence and Education Working Group. "Artificial
> Intelligence and Education at the University of Chicago." University of
> Chicago, July 2025.

If the report is published at a stable public URL, add it to each of these —
Chicago and MLA both want it for an online document, and a reader has no other
way to reach the source.

---

# Design notes

The passage is already spatial, tactile and temporal — it describes a thing you could stand next
to. This project builds that thing.

## The three gestures are peers

The passage names three responses to an AI object, and pointedly refuses to rank them:

1. **Mold** it to your teaching agenda "in original, remarkable ways"
2. **Place** it by "a precise methodology for their placement and use"
3. Handle it, explore it, and **deliberately set it aside**

An interactive piece naturally rewards action, so the build has to work against its own grain
here. Each gesture gets equal visual weight and equal representation in the seeded data. An
object set aside is not deleted — it stays on the table, out at the rim, tipped and quiet, where
you can still see what somebody decided about. There is no score, no progress bar, and no
completion state.

## The topography is the objects, not the table

"Over the course of our gathering, an uneven but dynamic table topography
emerges, **as we continually test, manipulate, and move these objects.**"

The topography is what the objects make. A real table does not change shape,
and neither does this one — the table is a flat oak slab throughout. What rises
and falls is the arrangement standing on it. An earlier version of this project
had the table surface itself deforming into swells and terraces; that was a
misreading, and it has been removed.

So height is not a stored field. It is a consequence of what is standing where:

| Gesture | What happens to the object | What it does to the landscape |
|---|---|---|
| Mold | grown, reworked, tilted | piles onto whatever is already worked into that spot — a mound |
| Place | squared up, snapped to a grid | a flat plateau of order |
| Set aside | tipped, quietened, moved to the rim | a fringe around the edge, still on the table |

## Unevenness is the goal

"An uneven but dynamic table topography." Nothing should tidy the arrangement
toward uniformity. A table trending to evenness would be the piece arguing for
consensus, which the passage never does.

## No figures

Faculty and students are presences — a notebook at each place, warming when
someone speaks. Bodies would imply identity and land in the uncanny valley.

## The report returns to the image itself

The oblong table is not a one-off figure in the Preamble. The report comes back
to it in its closing recommendations (p. 14), proposing gatherings of faculty,
instructors and students "perhaps over lunch (and perhaps around an oblong
table on the Quad)". Building the table is therefore not an outside reading
imposed on the text — the report treats it as a place the conversation could
actually happen.

## The objects are uses, not products

The objects are shaped like things a teacher reaches for: a quiz, a grading
rubric, a tutoring dialogue, a summariser, a translator, a coding assistant, an
image generator, a literature search, a data analysis, a set of margin
comments.

They are deliberately not vendor logos. Third-party marks would carry trademark
problems, read as endorsement, and date the piece the moment the market moved.
The passage is also careful to keep the objects generic — "objects that
represent AI" — while being quite specific about pedagogy, so pedagogy is what
they are shaped like.
