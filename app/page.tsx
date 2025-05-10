import Link from "next/link";

const levels = ["N5", "N4", "N3", "N2", "N1"];

export default function DeckSelectPage() {
  return (
    <div className="flex flex-col items-center p-6 gap-4">
      <h1 className="text-2xl font-bold">학습할 JLPT 단계를 선택하세요</h1>
      <div className="grid grid-cols-3 gap-4">
        {levels.map(level => (
          <Link
            key={level}
            href={`/study/${level}`}
            className="bg-blue-500 text-white px-4 py-2 rounded-xl shadow"
          >
            {level}
          </Link>
        ))}
      </div>
    </div>
  );
}
