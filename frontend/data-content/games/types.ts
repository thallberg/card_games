/**
 * Data för ett kortspel (t.ex. för framsida eller spelkort).
 */
export type GameCardData = {
  id: string;
  title: string;
  description: string;
  /** Sökväg till spelets sida, t.ex. /games/poker */
  path: string;
  /** Kort beskrivning för kortet (valfritt) */
  shortDescription?: string;
};
