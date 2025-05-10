export interface WordRecord {
  word: string;               // 일본어 단어 (예: ペン)
  reading: string;            // 히라가나 or 동일한 가타카나
  jlptLevels: string[];       // 예: ["N5", "N2"]
  isCommon: boolean;          // 일반적인 단어 여부
  pos: string[];              // 품사 (예: ["Noun"])
  meaningsEn: string[];       // 영어 뜻
  meaningsKo: string[];       // 한글 뜻
  meaningsJa: string[];       // (비어 있음)
  audioUrl: string | null;    // mp3 URL or null
}
