export interface EngineResult {
  rawScore: number;
  summary: string;
}

export interface EngineProps {
  seed: string;
  persistenceKey: string;
  onComplete: (result: EngineResult) => void;
}
