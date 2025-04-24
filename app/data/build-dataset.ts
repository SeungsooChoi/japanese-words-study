// build-dataset.ts
// -----------------------------------------------------------------------------
// JLPT Vocabulary API + Jisho API + DeepL 번역을 결합하여
//              정적 JSON 데이터셋(jlpt_full.json)을 생성합니다.
// -----------------------------------------------------------------------------
// 환경 변수:
//   DEEPL_KEY      DeepL Free/Pro API Key
//   MAX_WORDS?     (선택) 처리할 최대 단어 수 (테스트용)
// -----------------------------------------------------------------------------
import fs from 'fs/promises';
import path from 'path';
import process from 'process';

//--------------------------------------------------
// 0. 공통 타입 정의
//--------------------------------------------------
interface JLPTWord {
  word: string;         // 食べる
  reading: string;      // たべる (일부 API는 없음)
  level: string;        // N5~N1 (단일)
  audio?: string;       // mp3 url (있을 수도 없음)
}

interface JLPTApiResponse {
  data?: JLPTWord[];
}

interface DeepLApiResponse {
  translations?: Array<{
    text: string;
  }>;
}

interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  links: { text: string }[];   // Jisho는 예문 대신 reference links 제공
}

interface JishoResult {
  slug: string;                // 食べる
  is_common: boolean;
  japanese: { reading: string }[];
  senses: JishoSense[];
  jlpt?: string[];             // ["jlpt-n5", "jlpt-n4"] 형태
}

interface WordRecord {
  word: string;
  reading: string;
  jlptLevels: string[];
  isCommon: boolean;
  pos: string[];
  meaningsEn: string[];
  meaningsKo: string[];
  examples: { ja: string; ko: string }[];
  audioUrl: string | null;
}

//--------------------------------------------------
// 1. JLPT Vocabulary API 래퍼 (모든 페이지 수집)
//--------------------------------------------------
const JLPT_API = 'https://jlpt-vocab-api.vercel.app/api/words';
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

async function fetchWordsByLevel(level: string): Promise<JLPTWord[]> {
  const res = await fetch(`${JLPT_API}?level=${level.substring(1)}`); // N5 -> 5
  if (!res.ok) throw new Error(`JLPT API error L${level}`);
  return (await res.json()) as JLPTWord[];
}

export async function fetchAll(): Promise<JLPTWord[]> {
  const allLists = await Promise.all(levels.map(fetchWordsByLevel));
  return allLists.flat();
}

//--------------------------------------------------
// 2. Jisho API 래퍼
//--------------------------------------------------
async function jishoLookup(word: string): Promise<JishoResult | null> {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jisho API error ${word}`);
  const json = await res.json();
  return json.data?.[0] ?? null;
}

//--------------------------------------------------
// 3. DeepL 번역 함수 (영 → 한)
//--------------------------------------------------
async function translateKo(text: string): Promise<string[]> {
  if (!text) return [];
  const form = new URLSearchParams({
    text,
    source_lang: 'EN',
    target_lang: 'KO',
  });
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}`,
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error('DeepL API error');
  const json: DeepLApiResponse = await res.json();
  const translated = json.translations?.[0]?.text ?? '';
  return translated.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
}

//--------------------------------------------------
// 4. 메인 merge 로직
//--------------------------------------------------
// const MAX_EXAMPLES = 3; // 예문 최대 수

async function buildDataset() {
  console.time('build');
  const jlptWords = await fetchAll();
  console.log(jlptWords)
  // const max = Number(process.env.MAX_WORDS) || jlptWords.length;
  // const merged: WordRecord[] = [];

  // for (const w of jlptWords.slice(0, max)) {
  //   const j = await jishoLookup(w.word);
  //   if (!j) continue; // not found

  //   // --- JLPT levels 병합 ---
  //   const levelSet = new Set<string>();
  //   if (w.level) levelSet.add(w.level.toUpperCase());
  //   (j.jlpt ?? []).forEach((l) => levelSet.add(l.toUpperCase().replace('JLPT-', '')));
  //   const jlptLevels = Array.from(levelSet).sort();

  //   // --- 뜻 처리 ---
  //   const enDefs = j.senses[0].english_definitions;
  //   const koDefs = await translateKo(enDefs.join(', '));

  //   // --- 예문 처리 (여러 개) ---
  //   const links = j.senses[0].links?.slice(0, MAX_EXAMPLES) ?? [];
  //   const examples: { ja: string; ko: string }[] = [];
  //   for (const l of links) {
  //     const ko = (await translateKo(l.text)).join(', ');
  //     examples.push({ ja: l.text, ko });
  //   }

  //   merged.push({
  //     word: j.slug,
  //     reading: j.japanese?.[0]?.reading ?? w.reading,
  //     jlptLevels,
  //     isCommon: j.is_common,
  //     pos: j.senses[0].parts_of_speech,
  //     meaningsEn: enDefs,
  //     meaningsKo: koDefs,
  //     examples,
  //     audioUrl: w.audio ?? null,
  //   });

  //   // DeepL 프리 요금제: 30 req/sec 제한 → 120 ms 슬립
  //   await new Promise((r) => setTimeout(r, 120));
  // }

  // // 5. 파일 저장
  // const outPath = path.join(process.cwd(), 'public', 'jlpt_full.json');
  // await fs.mkdir(path.dirname(outPath), { recursive: true });
  // await fs.writeFile(outPath, JSON.stringify(merged, null, 2));
  // console.timeEnd('build');
  // console.log(`Saved ${merged.length} words → ${outPath}`);
}

//--------------------------------------------------
// 6. 실행
//--------------------------------------------------
if (require.main === module) {
  buildDataset().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
