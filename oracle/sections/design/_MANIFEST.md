# DESIGN section — manifest (all 64, bridge rewrite)

Audit date: 2026-05-21

## Standard

Bridge-rewritten standard: the oracle is a bridge. A newcomer to Human Design
reads any card and gets the teaching whole without needing system knowledge.
HD jargon (gate/centre/channel) and chart shapes (diamond/triangle/etc.) do
not appear in the prose. The architecture stays as quiet metadata in the JSON
(gate_number, centre, channel_keywords) so the card UI can show it as small
caption-style labels for HD-students. The prose teaches through felt truth
and function only.

See `_BRIDGE_REWRITE_BRIEF.md` for the locked standard. Voice: intimate
teacher, no em dashes, no formulaic openings.

## Status
- **final** — UL 1, UL 2 (Adrian-locked bridge references)
- **scaffold** — Phase 1 bridge rewrites, awaiting Phase 2

## The 64

| UL | Gate | Keyword | Centre | Channel(s) | g / c / ch | Status |
|---:|---:|---|---|---|---|---|
|  1 | 1 | Self-Expression | Identity Center | Channel of Inspiration | 123/114/136 | final |
|  2 | 2 | Direction of the Self | Identity Center | Channel of The Beat | 143/101/146 | final |
|  3 | 3 | Ordering | Sacral Center | Channel of Mutation | 153/151/147 | scaffold |
|  4 | 4 | Formulization | Ajna Center | Channel of Logic | 153/137/159 | scaffold |
|  5 | 5 | Fixed Patterns | Sacral Center | Channel of Rhythm | 150/156/150 | scaffold |
|  6 | 6 | Friction | Solar Plexus | Channel of Mating | 153/177/163 | scaffold |
|  7 | 7 | The Role of the Self | Identity Center | Channel of the Alpha | 158/161/169 | scaffold |
|  8 | 8 | Contribution | Throat Center | Channel of Inspiration | 140/150/169 | scaffold |
|  9 | 9 | Focus | Sacral Center | Channel of Concentration | 158/148/157 | scaffold |
| 10 | 10 | The Behaviour of the Self | G Center | Channel of Awakening (10-20), Channel of Exploration (10-34), Channel of Perfected Form (10-57) | 152/143/161 | scaffold |
| 11 | 11 | Ideas | Ajna Center | Channel of Curiosity | 155/152/160 | scaffold |
| 12 | 12 | Caution | Throat Center | Channel of Openness | 152/154/166 | scaffold |
| 13 | 13 | The Listener | Identity Center | Channel of the Prodigal | 151/153/161 | scaffold |
| 14 | 14 | Power Skills | Sacral Center | Channel of the Beat | 175/159/161 | scaffold |
| 15 | 15 | Extremes | Identity Center | Channel of Rhythm | 152/158/161 | scaffold |
| 16 | 16 | Skills | Throat Center | Channel of Talent | 171/164/174 | scaffold |
| 17 | 17 | Opinions | Ajna Center | Channel of Acceptance | 148/149/166 | scaffold |
| 18 | 18 | Correction | Spleen Center | Channel of Judgment | 161/149/162 | scaffold |
| 19 | 19 | Wanting | Root Center | Channel of Synthesis | 167/159/150 | scaffold |
| 20 | 20 | The Now | Throat Center | Channel of Awakening (10-20), Channel of Charisma (20-34), Channel of the Brainwave (20-57) | 150/141/173 | scaffold |
| 21 | 21 | Hunter/Huntress | Heart Center | Channel of Money | 151/149/160 | scaffold |
| 22 | 22 | Openness | Solar Plexus Center | Channel of Openness | 149/148/142 | scaffold |
| 23 | 23 | Assimilation | Throat Center | Channel of Structuring | 140/141/151 | scaffold |
| 24 | 24 | Rationalization | Ajna Center | Channel of Awareness | 164/144/152 | scaffold |
| 25 | 25 | The Spirit of the Self | G Center | Channel of Initiation | 156/141/150 | scaffold |
| 26 | 26 | The Egoist | Ego Center | Channel of Surrender | 148/144/148 | scaffold |
| 27 | 27 | Caring | Sacral Center | Channel of Preservation | 150/147/156 | scaffold |
| 28 | 28 | The Game Player | Spleen Center | Channel of Struggle | 151/147/146 | scaffold |
| 29 | 29 | Perseverance | Sacral Center | Channel of Discovery | 149/146/138 | scaffold |
| 30 | 30 | Feelings | Solar Plexus | Channel of Recognition | 154/148/151 | scaffold |
| 31 | 31 | Leading | Throat Center | Channel of the Alpha | 157/154/151 | scaffold |
| 32 | 32 | Continuity | Spleen Center | Channel of Transformation | 158/144/153 | scaffold |
| 33 | 33 | Privacy | Throat Center | Channel of the Prodigal | 144/146/148 | scaffold |
| 34 | 34 | Power | Sacral Center | Channel of Exploration, Channel of Charisma, Channel of Power | 158/154/159 | scaffold |
| 35 | 35 | Change | Throat Center | Channel of Transitoriness | 153/142/155 | scaffold |
| 36 | 36 | Crisis | Solar Plexus | Channel of Transitoriness | 145/161/152 | scaffold |
| 37 | 37 | Friendship | Solar Plexus Center | Channel of Community | 155/156/147 | scaffold |
| 38 | 38 | The Fighter | Root Center | Channel of Struggle | 146/135/144 | scaffold |
| 39 | 39 | Provocation | Root Center | Channel of Emoting | 154/152/144 | scaffold |
| 40 | 40 | Aloneness | Heart Center | Channel of Community | 159/146/150 | scaffold |
| 41 | 41 | Contraction | Root Center | Channel of Recognition | 151/148/147 | scaffold |
| 42 | 42 | Growth | Sacral Center | Channel of Maturation | 153/146/142 | scaffold |
| 43 | 43 | Insight | Ajna Center | Channel of Structuring | 162/142/160 | scaffold |
| 44 | 44 | Alertness | Spleen Center | Channel of Surrender | 159/157/160 | scaffold |
| 45 | 45 | The Gatherer | Throat Center | Channel of Money | 161/150/141 | scaffold |
| 46 | 46 | Determination of the Self | Identity Center | Channel of Discovery | 155/159/165 | scaffold |
| 47 | 47 | Realization | Ajna Center | Channel of Abstraction | 153/152/155 | scaffold |
| 48 | 48 | Depth | Spleen Center | Channel of Talent | 160/154/130 | scaffold |
| 49 | 49 | Rejection | Solar Plexus | Channel of Synthesis | 149/150/151 | scaffold |
| 50 | 50 | Values | Spleen Center | Channel of Preservation | 157/143/154 | scaffold |
| 51 | 51 | Shock | Heart Center | Channel of Initiation | 152/147/152 | scaffold |
| 52 | 52 | Stillness | Root Center | Channel of Concentration | 149/144/143 | scaffold |
| 53 | 53 | Beginnings | Root Center | Channel of Maturation | 167/154/153 | scaffold |
| 54 | 54 | Ambition | Root Center | Channel of Transformation | 149/146/154 | scaffold |
| 55 | 55 | Spirit | Solar Plexus | Channel of Emoting | 152/143/145 | scaffold |
| 56 | 56 | Stimulation | Throat Center | Channel of Curiosity | 165/138/155 | scaffold |
| 57 | 57 | Intuitive Clarity | Spleen Center | Channel of Perfected Form, Channel of the Brainwave, Channel of Power | 145/151/163 | scaffold |
| 58 | 58 | Aliveness | Root Center | Channel of Judgment | 160/152/165 | scaffold |
| 59 | 59 | Sexuality | Sacral Center | Channel of Mating | 154/145/151 | scaffold |
| 60 | 60 | Acceptance | Root Center | Channel of Mutation | 170/154/155 | scaffold |
| 61 | 61 | Mystery | Head Center | Channel of Awareness | 153/158/162 | scaffold |
| 62 | 62 | Detail | Throat Center | Channel of Acceptance | 153/139/159 | scaffold |
| 63 | 63 | Doubt | Head Center | Channel of Logic | 149/149/155 | scaffold |
| 64 | 64 | Confusion | Head Center | Channel of Abstraction | 151/144/155 | scaffold |
