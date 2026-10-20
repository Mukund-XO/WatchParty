import { MovieItem } from '../types';

/**
 * Sample library. These are the Blender Foundation's open movies, streamed from Google's public
 * sample bucket. They are licensed under Creative Commons Attribution, which requires the credit
 * lines below to stay visible wherever the films are shown.
 */
export const MOVIES_CATALOG: MovieItem[] = [
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    subtitle: 'Sci-fi short with live action and VFX',
    duration: '~12 min',
    year: 2012,
    genre: 'Sci-Fi',
    director: 'Ian Hubert',
    description:
      'A small group of soldiers and scientists makes a last stand against hostile robots in a ruined Amsterdam, in a short made to showcase open-source visual effects.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    credit: '© Blender Foundation | mango.blender.org · CC BY 3.0',
    creditUrl: 'https://mango.blender.org/',
    tags: ['Open movie', 'CC BY 3.0'],
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    subtitle: 'Animated comedy',
    duration: '~10 min',
    year: 2008,
    genre: 'Animation / Comedy',
    director: 'Sacha Goedegebure',
    description:
      'A big, gentle rabbit is pushed too far by three mischievous rodents and plans an elaborate revenge.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    credit: '© Blender Foundation | peach.blender.org · CC BY 3.0',
    creditUrl: 'https://peach.blender.org/',
    tags: ['Open movie', 'CC BY 3.0'],
  },
  {
    id: 'sintel',
    title: 'Sintel',
    subtitle: 'Fantasy animation',
    duration: '~15 min',
    year: 2010,
    genre: 'Animation / Fantasy',
    director: 'Colin Levy',
    description:
      'A young woman travels a harsh fantasy world in search of the baby dragon she once befriended.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    credit: '© Blender Foundation | durian.blender.org · CC BY 3.0',
    creditUrl: 'https://durian.blender.org/',
    tags: ['Open movie', 'CC BY 3.0'],
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream',
    subtitle: 'Surreal experimental short',
    duration: '~11 min',
    year: 2006,
    genre: 'Animation / Surreal',
    director: 'Bassam Kurdali',
    description:
      'Two odd companions explore a strange mechanical world in the first open movie made with Blender.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    credit: '© 2006 Blender Foundation / Netherlands Media Art Institute | orange.blender.org · CC BY 2.5',
    creditUrl: 'https://orange.blender.org/',
    tags: ['Open movie', 'CC BY 2.5'],
  },
];
