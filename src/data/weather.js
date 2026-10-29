// Weather presets. Missions pick one by id. Every field either changes how the boat drives
// (wind, gusts, wave height) or how far you can see (visibility, cloud).
//   windKnots, gust (0..1 fraction the wind swings either side), fromDeg (direction it blows FROM), veerDeg
//   waveHs   significant wave height in metres (crest to trough of the bigger waves is about twice a typical wave)
//   visibility  metres at which distant things vanish into haze
//   cloud    0 clear .. 1 heavy overcast (dims the sun and greys the sky)
export const WEATHER = {
  calm: { id: 'calm', name: 'Calm', windKnots: 4, gust: 0.1, fromDeg: 300, veerDeg: 4, waveHs: 0.3, visibility: 6000, cloud: 0.1, tip: 'Easy conditions. A good day to learn.' },
  breezy: { id: 'breezy', name: 'Fresh breeze', windKnots: 12, gust: 0.25, fromDeg: 300, veerDeg: 8, waveHs: 0.8, visibility: 5000, cloud: 0.35, tip: 'Gusty wind pushes light boats around, especially when you are slow.' },
  choppy: { id: 'choppy', name: 'Moderate sea', windKnots: 18, gust: 0.3, fromDeg: 295, veerDeg: 10, waveHs: 1.4, visibility: 3500, cloud: 0.6, tip: 'Waves slow small boats and make steering sluggish. Bigger vessels cope better.' },
  rough: { id: 'rough', name: 'Rough sea', windKnots: 26, gust: 0.35, fromDeg: 290, veerDeg: 12, waveHs: 2.2, visibility: 1800, cloud: 0.85, tip: 'Heavy going. Expect to be much slower and to need more room.' },
  foggy: { id: 'foggy', name: 'Fog bank', windKnots: 5, gust: 0.1, fromDeg: 300, veerDeg: 4, waveHs: 0.4, visibility: 450, cloud: 0.5, tip: 'You cannot see far. Trust the compass arrow and the distance readout, and keep your speed down.' },
};

export const DEFAULT_WEATHER = 'calm';

export function getWeather(id) {
  return WEATHER[id] || WEATHER[DEFAULT_WEATHER];
}
