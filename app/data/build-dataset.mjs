// build-dataset.js
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
import { fileURLToPath } from 'url';

//--------------------------------------------------
// 1. JLPT Vocabulary API 래퍼 (모든 페이지 수집)
//--------------------------------------------------
const JLPT_API = 'https://jlpt-vocab-api.vercel.app/api/words';
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];

async function fetchWordsByLevel(level) {
  const all = [];
  const limit = 2000;
  let offset = 0;

  while (true) {
    const res = await fetch(`${JLPT_API}?level=${level.slice(1)}&offset=${offset}&limit=${limit}`);
    if (!res.ok) throw new Error(`JLPT API error L${level}`);
    const { total, words } = await res.json();

    all.push(...words);
    offset += limit;
    if (offset >= total) break;
  }
  return all;
}

export async function fetchAll() {
  const allLists = await Promise.all(levels.map(fetchWordsByLevel));
  return allLists.flat();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

//--------------------------------------------------
// 2. 공통 유틸 – fetch with retry + 백오프
//--------------------------------------------------
async function fetchWithRetry(url, tries = 5) {
  let attempt = 0;
  let delay = 300;              // 처음 0.3s
  while (attempt < tries) {
    const res = await fetch(url, {
      // Cloudflare 우회용 UA (node-fetch 기본 UA는 종종 차단)
      headers: { "User-Agent": "Mozilla/5.0 (dataset builder)" },
    });
    if (res.ok) return res;     // 2xx면 그대로 리턴

    // 4xx(특히 429) / 5xx → 지수 백오프 후 재시도
    attempt++;
    if (attempt >= tries) throw new Error(`${res.status} ${res.statusText}`);
    await sleep(delay);
    delay *= 2;                 // 0.3 → 0.6 → 1.2 …
  }
  // 도달 못 함
  throw new Error("unreachable");
}

//--------------------------------------------------
// 2. Jisho API 래퍼
//--------------------------------------------------
async function jishoLookup(word) {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
  const res = await fetchWithRetry(url);
  const json = await res.json();
  // JLPT 태그 우선, 없으면 0번째
  const found = json.data?.find(d => d.jlpt?.length) ?? json.data?.[0];
  return found ?? null;
}

//--------------------------------------------------
// 3. DeepL 번역 함수 (영 → 한) - 주석 처리된 상태로 유지
//--------------------------------------------------
// async function translateKo(text) {
//   if (!text) return [];
//   const form = new URLSearchParams({
//     text,
//     source_lang: 'EN',
//     target_lang: 'KO',
//   });
//   const res = await fetch('https://api-free.deepl.com/v2/translate', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//       Authorization: `DeepL-Auth-Key ${process.env.DEEPL_KEY}`,
//     },
//     body: form.toString(),
//   });
//   if (!res.ok) throw new Error('DeepL API error');
//   const json = await res.json();
//   const translated = json.translations?.[0]?.text ?? '';
//   return translated.split(/[,;]/).map(s => s.trim()).filter(Boolean);
// }

//--------------------------------------------------
// 4. 메인 merge 로직
//--------------------------------------------------
// const MAX_EXAMPLES = 3; // 예문 최대 수

async function buildDataset() {
  console.time("build");
  const jlptWords = await fetchAll();

  // 환경 변수로 최대 단어 수 제한 가능
  const maxWords = process.env.MAX_WORDS ? parseInt(process.env.MAX_WORDS) : jlptWords.length;
  const max = Math.min(maxWords, jlptWords.length);

  const merged = [];

  for (const w of jlptWords.slice(0, max)) {
    const j = await jishoLookup(w.word);
    if (!j) continue; // not found

    // --- JLPT levels 병합 ---
    const levelSet = new Set();
    if (w.level) levelSet.add(`n${w.level}`);
    (j.jlpt ?? []).forEach(l => levelSet.add(l.toUpperCase().replace('JLPT-', '')));
    const jlptLevels = Array.from(levelSet).sort();

    // --- 뜻 처리 ---
    // const enDefs = j.senses[0].english_definitions;
    // const koDefs = await translateKo(enDefs.join(', '));

    // --- 예문 처리 (여러 개) ---
    // const links = j.senses[0].links?.slice(0, MAX_EXAMPLES) ?? [];
    const examples = [];
    // for (const l of links) {
    //   const ko = (await translateKo(l.text)).join(', ');
    //   examples.push({ ja: l.text, ko });
    // }

    merged.push({
      word: j.slug,
      reading: j.japanese?.[0]?.reading ?? w.reading,
      jlptLevels,
      isCommon: j.is_common,
      pos: j.senses[0].parts_of_speech,
      meaningsEn: [], //enDefs
      meaningsKo: [], //koDefs
      examples,
      audioUrl: w.audio ?? null,
    });

    // DeepL Free: 30 req/min ≒ 0.5 req/s → 600 ms 슬립
    await sleep(600);
  }

  // 5. 파일 저장
  const outPath = path.join(process.cwd(), 'public', 'jlpt_full.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(merged, null, 2), "utf8");
  console.timeEnd('build');
  console.log(`Saved ${merged.length} words → ${outPath}`);
}

//--------------------------------------------------
// 6. 실행
//--------------------------------------------------
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  buildDataset().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}