"use client";

import { useState } from "react";
import wordList from "@/data/jlpt_full.json";

export function WordStudy({ level }: { level: string }) {
  const [index, setIndex] = useState(0);
  const words = wordList.filter(word => word.jlptLevels.includes(level));

  const word = words[index];

  if (!word) return <p className="p-6 text-center">학습할 단어가 없습니다.</p>;

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % words.length);
  };

  const handlePlayAudio = () => {
    if (word.audioUrl) {
      new Audio(word.audioUrl).play();
    } else {
      const utterance = new SpeechSynthesisUtterance(word.word);
      utterance.lang = "ja-JP";
      speechSynthesis.cancel(); // 기존 재생 제거
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center">
      <div className="mb-4 text-gray-600 text-sm">
        [{word.jlptLevels.join(", ")}] {index + 1} / {words.length} 단어
      </div>

      <div className="w-full max-w-md border rounded-xl p-6 shadow-md text-center">
        <h2 className="text-3xl font-bold">{word.word}</h2>
        <p className="text-lg text-gray-500">{word.reading}</p>
        <p className="mt-4">{word.meaningsKo.join(", ")}</p>

        <div className="mt-6 w-full flex justify-between">
          <button
            onClick={handlePlayAudio}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            🔊 듣기
          </button>

          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            다음 단어 →
          </button>
        </div>
      </div>
    </div>
  );
}
