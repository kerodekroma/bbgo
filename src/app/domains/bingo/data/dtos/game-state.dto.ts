export interface GameStateDto {
  calledNumbers: number[];
  gameMode: string;
  patternSettings?: {
    enabled: string[];
  };
}
