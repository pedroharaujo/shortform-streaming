import { Series, CoinPack } from '../types';

export const INITIAL_COIN_PACKS: CoinPack[] = [
  {
    id: 'pack_starter',
    title: 'Starter Pack',
    coins: 100,
    bonusCoins: 20,
    priceFormatted: '$0.99',
    priceAmount: 0.99,
    tag: 'Quick Top-Up'
  },
  {
    id: 'pack_popular',
    title: 'Binge Pack',
    coins: 500,
    bonusCoins: 150,
    priceFormatted: '$4.99',
    priceAmount: 4.99,
    tag: 'Most Popular',
    isPopular: true
  },
  {
    id: 'pack_vip',
    title: 'Marathon VIP',
    coins: 1200,
    bonusCoins: 450,
    priceFormatted: '$9.99',
    priceAmount: 9.99,
    tag: 'Best Value'
  },
  {
    id: 'pack_ultimate',
    title: 'Ultimate Pass',
    coins: 2800,
    bonusCoins: 1200,
    priceFormatted: '$19.99',
    priceAmount: 19.99,
    tag: '40% Bonus'
  }
];

// Open sample video clips for seamless vertical playback
const SAMPLE_VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-the-phone-in-the-city-43183-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-neon-lights-42999-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-businessman-walking-down-the-street-using-his-cell-phone-43187-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-looking-at-the-sunset-over-the-city-43202-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-young-man-walking-and-thinking-outdoors-43207-large.mp4'
];

export const MOCK_SERIES: Series[] = [
  {
    id: 'series-alpha-heir',
    title: "The Billionaire's Secret Heir",
    slug: 'the-billionaires-secret-heir',
    synopsis: 'Disowned five years ago while pregnant, Elena worked three jobs in the slums. When ruthless CEO Damian Vance discovers their son is the rightful heir to a $40 billion empire, he will tear the city apart to claim them back.',
    verticalCoverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80',
    horizontalBannerUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1400&q=80',
    tags: ['Billionaire', 'Secret Baby', 'Revenge', 'Second Chance'],
    totalEpisodes: 10,
    freeEpisodesCount: 3,
    releaseYear: 2026,
    rating: 'TV-14',
    viewsCount: '4.8M',
    views24h: '940K',
    views24hNumeric: 940000,
    author: 'Stovio Originals',
    isPopular: true,
    isFeatured: true,
    episodes: Array.from({ length: 10 }, (_, i) => ({
      id: `ep-alpha-${i + 1}`,
      seriesId: 'series-alpha-heir',
      episodeNumber: i + 1,
      title: i === 0 ? 'The Encounter at the Gala' : i === 1 ? 'Five Years of Secrets' : i === 2 ? 'He Saw the Child' : i === 3 ? 'A Demand in the Rain' : `Episode ${i + 1}`,
      durationSeconds: 78 + (i * 7) % 30,
      videoUrl: SAMPLE_VIDEOS[i % SAMPLE_VIDEOS.length],
      thumbnailUrl: `https://images.unsplash.com/photo-${1534528741775 + i * 20}?auto=format&fit=crop&w=400&q=80`,
      coinCost: 40,
      isFree: i < 3
    }))
  },
  {
    id: 'series-revenge-bride',
    title: 'Revenge of the Abandoned Bride',
    slug: 'revenge-of-the-abandoned-bride',
    synopsis: 'Publicly humilated at the altar when her fiancé ran off with her stepsister, Chloe was supposed to be ruined. Instead, the reclusive underworld magnate stepped from the shadows with a ring and a promise: ruin them together.',
    verticalCoverUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80',
    horizontalBannerUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80',
    tags: ['Contract Marriage', 'Betrayal', 'Dark Romance', 'Suspense'],
    totalEpisodes: 8,
    freeEpisodesCount: 2,
    releaseYear: 2026,
    rating: 'TV-MA',
    viewsCount: '3.2M',
    views24h: '680K',
    views24hNumeric: 680000,
    author: 'Blackwood Studios',
    isPopular: true,
    episodes: Array.from({ length: 8 }, (_, i) => ({
      id: `ep-bride-${i + 1}`,
      seriesId: 'series-revenge-bride',
      episodeNumber: i + 1,
      title: i === 0 ? 'Left at the Altar' : i === 1 ? 'The Shadow Billionaire' : i === 2 ? 'The Contract Signed' : `Episode ${i + 1}`,
      durationSeconds: 85 + (i * 5) % 25,
      videoUrl: SAMPLE_VIDEOS[(i + 1) % SAMPLE_VIDEOS.length],
      thumbnailUrl: `https://images.unsplash.com/photo-${1517841905240 + i * 25}?auto=format&fit=crop&w=400&q=80`,
      coinCost: 50,
      isFree: i < 2
    }))
  },
  {
    id: 'series-hidden-wife',
    title: "Double Life of CEO Morgan",
    slug: 'double-life-of-ceo-morgan',
    synopsis: 'By day, he is the ruthless chair of Global Tech. By night, he hides his identity as a humble househusband married to a rising fashion director who thinks he is penniless. What happens when his real identity slips at the annual summit?',
    verticalCoverUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80',
    horizontalBannerUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
    tags: ['Hidden Identity', 'Romcom', 'Workplace', 'Urban'],
    totalEpisodes: 12,
    freeEpisodesCount: 4,
    releaseYear: 2026,
    rating: 'TV-PG',
    viewsCount: '2.9M',
    views24h: '430K',
    views24hNumeric: 430000,
    author: 'Skyline Pictures',
    episodes: Array.from({ length: 12 }, (_, i) => ({
      id: `ep-morgan-${i + 1}`,
      seriesId: 'series-hidden-wife',
      episodeNumber: i + 1,
      title: i === 0 ? 'The Pretend Husband' : i === 1 ? 'Black Card in the Coat' : i === 2 ? 'An Uninvited Guest' : i === 3 ? 'Close Call' : `Episode ${i + 1}`,
      durationSeconds: 90 + (i * 4) % 20,
      videoUrl: SAMPLE_VIDEOS[(i + 2) % SAMPLE_VIDEOS.length],
      thumbnailUrl: `https://images.unsplash.com/photo-${1506794778202 + i * 15}?auto=format&fit=crop&w=400&q=80`,
      coinCost: 35,
      isFree: i < 4
    }))
  },
  {
    id: 'series-tyrant-boss',
    title: 'Taming the Alpha Wolf King',
    slug: 'taming-the-alpha-wolf-king',
    synopsis: 'Banished from her pack for failing to shift, Selene moved to the mortal city and opened an apothecary. One bloody midnight, a wounded silver wolf collapses on her doorstep—the legendary Lycan king feared across the five continents.',
    verticalCoverUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=700&q=80',
    horizontalBannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1400&q=80',
    tags: ['Werewolf', 'Supernatural', 'Destined Mates', 'Fantasy'],
    totalEpisodes: 10,
    freeEpisodesCount: 3,
    releaseYear: 2026,
    rating: 'TV-14',
    viewsCount: '6.1M',
    views24h: '1.4M',
    views24hNumeric: 1400000,
    author: 'Mythic Forge',
    isPopular: true,
    episodes: Array.from({ length: 10 }, (_, i) => ({
      id: `ep-wolf-${i + 1}`,
      seriesId: 'series-tyrant-boss',
      episodeNumber: i + 1,
      title: i === 0 ? 'Midnight Blood' : i === 1 ? 'Eyes of Molten Gold' : i === 2 ? 'The Mark Appears' : `Episode ${i + 1}`,
      durationSeconds: 70 + (i * 6) % 30,
      videoUrl: SAMPLE_VIDEOS[(i + 3) % SAMPLE_VIDEOS.length],
      thumbnailUrl: `https://images.unsplash.com/photo-${1539571696357 + i * 30}?auto=format&fit=crop&w=400&q=80`,
      coinCost: 45,
      isFree: i < 3
    }))
  },
  {
    id: 'series-mafia-heir',
    title: "The Don's Runaway Surrogate",
    slug: 'the-dons-runaway-surrogate',
    synopsis: 'To pay for her brother surgery, Mia carried the child of Chicago most feared syndicate leader. When she discovered his lethal world, she fled into hiding. Four years later, a black convoy pulls up to her quiet flower shop.',
    verticalCoverUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80',
    horizontalBannerUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1400&q=80',
    tags: ['Mafia', 'Surrogate', 'Suspense', 'Second Chance'],
    totalEpisodes: 10,
    freeEpisodesCount: 2,
    releaseYear: 2026,
    rating: 'TV-MA',
    viewsCount: '3.8M',
    views24h: '810K',
    views24hNumeric: 810000,
    author: 'Crimson Edge',
    isPopular: true,
    episodes: Array.from({ length: 10 }, (_, i) => ({
      id: `ep-mafia-${i + 1}`,
      seriesId: 'series-mafia-heir',
      episodeNumber: i + 1,
      title: i === 0 ? 'The Vanishing Mother' : i === 1 ? 'Four Years in Shadow' : i === 2 ? 'The Convoy Arrives' : `Episode ${i + 1}`,
      durationSeconds: 75 + (i * 5) % 20,
      videoUrl: SAMPLE_VIDEOS[i % SAMPLE_VIDEOS.length],
      thumbnailUrl: `https://images.unsplash.com/photo-${1524504388940 + i * 15}?auto=format&fit=crop&w=400&q=80`,
      coinCost: 40,
      isFree: i < 2
    }))
  }
];
