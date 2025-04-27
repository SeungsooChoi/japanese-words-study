// collect-jlpt-words.js
// -----------------------------------------------------------------------------
// JLPT Vocabulary API에서 단어를 수집하여 JSON 파일로 저장합니다.
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
  console.log(`${level} 레벨 단어 수집 시작...`);
  const all = [];
  const limit = 4000;
  let offset = 0;

  while (true) {
    console.log(`  ${level}: ${offset}~${offset + limit - 1} 요청 중...`);
    const res = await fetch(`${JLPT_API}?level=${level.slice(1)}&offset=${offset}&limit=${limit}`);

    if (!res.ok) {
      console.error(`  ${level}: API 오류 발생! (${res.status} ${res.statusText})`);
      throw new Error(`JLPT API error L${level}: ${res.status}`);
    }

    const { total, words } = await res.json();
    console.log(`  ${level}: ${words.length}개 단어 수신 (총 ${total}개 중 ${offset + words.length}개 완료)`);

    all.push(...words);
    offset += limit;

    if (offset >= total) {
      console.log(`${level} 레벨 단어 수집 완료! (총 ${all.length}개)`);
      break;
    }
  }
  return all;
}

async function fetchAll() {
  console.log("모든 JLPT 레벨(N1~N5)의 단어 수집을 시작합니다...");
  const result = {};

  // 병렬 처리보다 순차 처리로 변경 (API 부하 및 오류 방지)
  for (const level of levels) {
    result[level] = await fetchWordsByLevel(level);
  }

  // 전체 통계
  let totalCount = 0;
  for (const level of levels) {
    totalCount += result[level].length;
    console.log(`${level}: ${result[level].length}개 단어`);
  }
  console.log(`전체: ${totalCount}개 단어`);

  return result;
}

//--------------------------------------------------
// 2. 파일 저장 기능
//--------------------------------------------------
async function saveToFile(data, filename) {
  const outPath = path.join(process.cwd(), 'data', filename);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`데이터 저장 완료: ${outPath}`);
  return outPath;
}

//--------------------------------------------------
// 3. 메인 함수
//--------------------------------------------------
async function collectJlptWords() {
  console.time("수집 시간");

  try {
    // 모든 JLPT 레벨의 단어 수집
    const allWords = await fetchAll();

    // 결과를 파일로 저장
    await saveToFile(allWords, 'jlpt_words_by_level.json');

    // 플랫한 형태로도 저장 (단일 배열)
    const flatWords = Object.entries(allWords).flatMap(
      ([level, words]) => words.map(w => ({ ...w, level: level.slice(1) })) // N5 -> 5
    );
    await saveToFile(flatWords, 'jlpt_words_flat.json');

    console.log("작업이 성공적으로 완료되었습니다!");
  } catch (error) {
    console.error("오류 발생:", error);
    process.exit(1);
  }

  console.timeEnd("수집 시간");
}

//--------------------------------------------------
// 4. 실행
//--------------------------------------------------
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  collectJlptWords();
}