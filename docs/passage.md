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

**Attribution:** _<!-- PLACEHOLDER — please replace with the verified citation. -->_
AI in Education report, University of Chicago.

> Note: this citation was not verifiable from public web sources at build time. One source
> attributes a 2025 UChicago AI in Education report to a committee chaired by Emily Lynn Osborn,
> but that this passage comes from that document was not confirmed. Replace the line above with
> the correct title, authorship, and date.

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
here. Each gesture gets equal visual weight and equal representation in the seeded data. Setting
an object aside leaves a *considered mark* — a dimple and a ring — not an absence. There is no
score, no progress bar, and no completion state.

## Unevenness is the goal

"An uneven but dynamic table topography." The drift pass that keeps the surface moving must
preserve variance rather than relaxing toward flat. A table trending to smooth would be the
piece arguing for consensus, which the passage never does.

## No figures

Faculty and students are presences — light, warmth, motion — never modeled people. Bodies would
imply identity and land in the uncanny valley.

## Terrain grammars

Each gesture stamps a visually distinct signature into the heightfield, so the table read from
above becomes a legible record of collective judgment:

| Gesture | Kernel | Reads as |
|---|---|---|
| Mold | wide smooth Gaussian swell, warm | a broad rise |
| Place | quantized plateau with a hard rim | a terrace |
| Set aside | shallow negative dimple + bright ring | a marked absence |
