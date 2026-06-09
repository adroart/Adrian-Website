/**
 * Baked-in sample viewing — lets the viewer render with true content before the
 * admin creator + token API exist. Keywords are pulled from the mandalacodes
 * corpus for codes 1, 34, 45, 43, 14; the descriptions are plain art-voice
 * (no Gene Keys / Human Design vocabulary), and the curator reasons are sample
 * copy. Art first: the chart quietly chose these pieces; the buyer never has to
 * know that to enjoy them. The deeper reading lives behind "Go deeper".
 *
 * Replace this with a /api/viewings/:token fetch once the desk is built. The
 * shape is identical, so the viewer does not change.
 */
import type { ViewingData } from './viewingTypes';

const UL = '/creations/multidimensional-art/universal-language';

export const SAMPLE_VIEWING: ViewingData = {
  recipientName: 'Daniel',
  subtitle: 'A handful of pieces I chose with you in mind.',
  pieces: [
    {
      id: 'earths-breath',
      code: 1,
      name: "Earth's Breath",
      glance: 'A piece about pure beginning, the first move made for the joy of moving.',
      keywords: ['Origination', 'Renewal', 'First Movement'],
      description:
        'This piece holds the energy of a beginning, before anything has taken shape. It is the creative impulse in its purest form, made for the joy of making rather than to answer anyone. There is a quiet power in it, the kind that starts something new and trusts where it leads.',
      pieceUrl: UL,
      recommended: true,
    },
    {
      id: 'sublime-power',
      code: 34,
      name: 'Sublime Power',
      glance: 'Great strength, gathered and composed, waiting for the right moment rather than forcing it.',
      keywords: ['Strength', 'Composure', 'Aligned Force'],
      description:
        'A piece about power that has learned patience. The strength here is fully present, but it holds itself, moving with the grain of things instead of against them. It carries the feeling of a force that no longer needs to prove itself, which is its own kind of presence in a room.',
      pieceUrl: UL,
      recommended: true,
    },
    {
      id: 'tribal-tapestry',
      code: 45,
      name: 'Tribal Tapestry',
      glance: 'The energy of gathering, where people come together by affinity rather than by command.',
      keywords: ['Gathering', 'Belonging', 'Shared Ground'],
      description:
        'This piece is about what draws people together. It speaks to the natural pull of belonging, the way the right things gather around a center without being forced. It holds a warmth that makes a space feel shared rather than ruled.',
      pieceUrl: UL,
    },
    {
      id: 'cipher-of-knowledge',
      code: 43,
      name: 'Cipher of Knowledge',
      glance: 'The breakthrough, the flash of knowing that arrives once the pressure is finally released.',
      keywords: ['Breakthrough', 'Insight', 'The Flash of Knowing'],
      description:
        'A piece about the moment something finally breaks through. The insight here does not come from pushing harder, but from the quiet that opens once the strain lets go. It carries the charge of a sudden, clear knowing.',
      pieceUrl: UL,
    },
    {
      id: 'ancestors-bloom',
      code: 14,
      name: 'Ancestors Bloom',
      glance: 'A light with no ceiling, abundance held lightly and given freely.',
      keywords: ['Abundance', 'Radiance', 'The Uncompromised Life'],
      description:
        'This piece holds a sense of abundance that asks to be shared rather than kept. It is a light that opens upward in every direction, the feeling of a life that stops bargaining and simply gives. There is generosity in it, and an ease.',
      pieceUrl: UL,
    },
  ],
  recommendation: {
    intention: 'a home that feels both grounded and alive',
    picks: [
      {
        pieceId: 'earths-breath',
        reason:
          'The piece to anchor the room. It carries the energy of a fresh start, and it sets the tone for everything around it.',
      },
      {
        pieceId: 'sublime-power',
        reason:
          'A quiet, composed strength that holds a space without dominating it. It balances the openness of the first piece.',
      },
      {
        pieceId: 'tribal-tapestry',
        reason:
          'The warmth that makes a home feel shared. The natural third in the set, where people gather.',
      },
    ],
    closing: 'Pick these up together, or one at a time.',
    signature: 'Adrian',
  },
};
