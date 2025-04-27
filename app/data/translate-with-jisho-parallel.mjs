// translate-with-jisho-parallel.js
// -----------------------------------------------------------------------------
// 병렬 처리를 통해 JLPT 단어를 Jisho API로 번역하는 스크립트
// -----------------------------------------------------------------------------
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

// 설정 값
const BATCH_SIZE = 10;  // 동시에 처리할 요청 수 (Jisho API 제한에 맞게 조정)
const DELAY_BETWEEN_BATCHES = 1000;  // 배치 사이 지연 시간 (ms)
const RETRY_DELAY = 300;  // 초기 재시도 지연 시간 (ms)
const MAX_RETRIES = 3;  // 최대 재시도 횟수

//--------------------------------------------------
// 1. 공통 유틸 – 병렬 처리 및 재시도 기능
//--------------------------------------------------
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, tries = MAX_RETRIES) {
  let attempt = 0;
  let delay = RETRY_DELAY;

  while (attempt < tries) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (dataset builder)" },
      });
      if (res.ok) return res;

      console.warn(`API 응답 오류: ${res.status}, 재시도 중...`);
    } catch (error) {
      console.warn(`네트워크 오류: ${error.message}, 재시도 중...`);
    }

    attempt++;
    if (attempt >= tries) throw new Error(`최대 재시도 횟수 초과`);

    await sleep(delay);
    delay *= 2;  // 지수 백오프
  }

  throw new Error("unreachable");
}

// 배치 단위로 병렬 처리 함수
async function processBatch(batch, processor) {
  return Promise.all(batch.map(processor));
}

//--------------------------------------------------
// 2. Jisho API 래퍼
//--------------------------------------------------
async function jishoLookup(word) {
  const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;

  try {
    const res = await fetchWithRetry(url);
    const json = await res.json();

    // 정확한 단어 매칭
    const exactMatches = json.data?.filter(d =>
      d.slug === word ||
      d.japanese?.some(j => j.word === word || j.reading === word)
    );

    const found =
      exactMatches?.find(d => d.jlpt?.length) ||
      exactMatches?.[0] ||
      json.data?.find(d => d.jlpt?.length) ||
      json.data?.[0];

    return found || null;
  } catch (error) {
    console.error(`"${word}" 검색 실패:`, error.message);
    return null;
  }
}

//--------------------------------------------------
// 3. 파일 입출력
//--------------------------------------------------
async function loadJsonFile(filename) {
  try {
    const filePath = path.join(process.cwd(), 'data', filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`파일 로드 오류:`, error.message);
    throw error;
  }
}

async function saveToFile(data, filename) {
  const outPath = path.join(process.cwd(), 'data', filename);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`데이터 저장 완료: ${outPath}`);
  return outPath;
}

//--------------------------------------------------
// 4. 단어 처리 함수
//--------------------------------------------------
async function processWord(word) {
  try {
    const jishoResult = await jishoLookup(word.word);

    if (!jishoResult) {
      return { success: false, word: word.word };
    }

    // 결과 객체 생성
    const enrichedWord = {
      word: word.word,
      reading: jishoResult.japanese?.[0]?.reading || word.reading,
      jlptLevels: [(word.level ? `N${word.level}` : '')].filter(Boolean),
      isCommon: jishoResult.is_common || false,
      pos: jishoResult.senses?.[0]?.parts_of_speech || [],
      meaningsEn: jishoResult.senses?.[0]?.english_definitions || [],
      meaningsJa: jishoResult.senses?.[0]?.japanese_definitions || [],
      audioUrl: word.audio || null
    };

    // Jisho에서 JLPT 레벨 정보 병합
    if (jishoResult.jlpt?.length) {
      const jishoLevels = jishoResult.jlpt.map(l =>
        l.toUpperCase().replace('JLPT-', '')
      );
      const allLevels = new Set([...enrichedWord.jlptLevels, ...jishoLevels]);
      enrichedWord.jlptLevels = Array.from(allLevels).sort();
    }

    return { success: true, data: enrichedWord };
  } catch (error) {
    console.error(`'${word.word}' 처리 오류:`, error.message);
    return { success: false, word: word.word };
  }
}

//--------------------------------------------------
// 5. 메인 로직
//--------------------------------------------------
async function translateWords() {
  console.time("번역 시간");

  try {
    // 1. 파일에서 JLPT 단어 로드
    const jlptWords = await loadJsonFile('jlpt_words_flat.json');
    console.log(`총 ${jlptWords.length}개 단어 로드됨`);

    // 2. 처리할 단어 수 설정
    const maxWords = process.env.MAX_WORDS ? parseInt(process.env.MAX_WORDS) : jlptWords.length;
    const limit = Math.min(maxWords, jlptWords.length);
    console.log(`처리할 단어 수: ${limit}개`);

    // 3. 결과 저장용 배열
    const enrichedWords = [];
    const notFound = [];

    // 4. 배치 단위로 처리
    for (let i = 0; i < limit; i += BATCH_SIZE) {
      const end = Math.min(i + BATCH_SIZE, limit);
      const currentBatch = jlptWords.slice(i, end);

      console.log(`\n배치 처리 중: ${i + 1}-${end}/${limit}`);

      // 배치 병렬 처리
      const results = await processBatch(currentBatch, processWord);

      // 결과 분류
      results.forEach(result => {
        if (result.success) {
          enrichedWords.push(result.data);
        } else {
          notFound.push(result.word);
        }
      });

      // 진행 상황 출력
      console.log(`진행 상황: ${enrichedWords.length} 성공, ${notFound.length} 실패`);

      // 중간 저장 (100개 단위)
      if (enrichedWords.length % 100 < BATCH_SIZE || end === limit) {
        await saveToFile(enrichedWords, 'jisho_enriched_words.json');
        await saveToFile(notFound, 'not_found_words.json');
        console.log(`중간 저장 완료: ${enrichedWords.length}개 단어`);
      }

      // 배치 사이 지연
      if (end < limit) {
        console.log(`다음 배치 전 ${DELAY_BETWEEN_BATCHES}ms 대기...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    // 5. 최종 저장
    await saveToFile(enrichedWords, 'jisho_enriched_words.json');
    await saveToFile(notFound, 'not_found_words.json');

    // 6. 요약 출력
    console.log("\n작업 결과 요약:");
    console.log(`- 처리된 단어: ${limit}개`);
    console.log(`- 성공적으로 번역된 단어: ${enrichedWords.length}개`);
    console.log(`- 검색 결과 없는 단어: ${notFound.length}개`);

  } catch (error) {
    console.error("작업 중 오류 발생:", error);
    process.exit(1);
  }

  console.timeEnd("번역 시간");
}

//--------------------------------------------------
// 6. 실행
//--------------------------------------------------
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  translateWords();
}