import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

//--------------------------------------------------
// 1. 공통 유틸 – 병렬 처리 및 재시도 기능
//--------------------------------------------------
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateKoBatch(texts) {
  if (texts.length === 0) return [];

  const form = new URLSearchParams();
  texts.forEach((text) => {
    form.append('text', text);
  });
  form.append('source_lang', 'EN');
  form.append('target_lang', 'KO');

  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${process.env.NEXT_PUBLIC_DEEPL_KEY}`,
    },
    body: form.toString(),
  });

  if (!res.ok) throw new Error('DeepL API error');
  const json = await res.json();
  return json.translations.map((t) => (t.text ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean));
}

async function addTranslations() {
  console.time('translate');

  const enrichedPath = path.join(process.cwd(), 'data', 'jisho_enriched_words.json');
  const enrichedData = JSON.parse(await fs.readFile(enrichedPath, 'utf8'));

  const maxWords = process.env.MAX_WORDS ? parseInt(process.env.MAX_WORDS) : enrichedData.length;
  const data = enrichedData.slice(0, maxWords);

  const MAX_EXAMPLES = 3;
  const translated = [];

  const batchTexts = [];
  const batchIndexes = [];

  data.forEach((word, idx) => {
    if (word.meaningsEn && word.meaningsEn.length) {
      batchTexts.push(word.meaningsEn.join(', '));
      batchIndexes.push(idx);
    }
  });

  console.log(`Batch translating ${batchTexts.length} words...`);

  const BATCH_SIZE = 30;

  for (let i = 0; i < batchTexts.length; i += BATCH_SIZE) {
    const batch = batchTexts.slice(i, i + BATCH_SIZE);
    const indexes = batchIndexes.slice(i, i + BATCH_SIZE);

    const translations = await translateKoBatch(batch);

    translations.forEach((koDefs, j) => {
      const idx = indexes[j];
      data[idx].meaningsKo = koDefs;
    });

    console.log(`Translated ${Math.min(i + BATCH_SIZE, batchTexts.length)}/${batchTexts.length} words...`);

    await sleep(600);
  }

  for (const word of data) {
    if (word.examples && word.examples.length) {
      for (let j = 0; j < Math.min(word.examples.length, MAX_EXAMPLES); j++) {
        const example = word.examples[j];
        if (example.ja && !example.ko) {
          const [ko] = await translateKoBatch([example.ja]);
          example.ko = ko.join(', ');
          await sleep(600);
        }
      }
    }
    translated.push(word);
  }

  const outPath = path.join(process.cwd(), 'data', 'jlpt_full.json');
  await fs.writeFile(outPath, JSON.stringify(translated, null, 2), 'utf8');

  const byLevel = {
    N5: [],
    N4: [],
    N3: [],
    N2: [],
    N1: [],
  };

  for (const word of translated) {
    for (const level of word.jlptLevels || []) {
      if (byLevel[level]) {
        byLevel[level].push(word);
      }
    }
  }

  const byLevelPath = path.join(process.cwd(), 'data', 'jlpt_words_by_level.json');
  await fs.writeFile(byLevelPath, JSON.stringify(byLevel, null, 2), 'utf8');

  console.timeEnd('translate');
  console.log(`Saved ${translated.length} translated words → jlpt_full.json`);
  console.log(`Saved words by level → jlpt_words_by_level.json`);
}

async function main() {
  try {
    await addTranslations();
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
