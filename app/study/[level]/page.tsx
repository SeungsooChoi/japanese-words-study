import { WordStudy } from "@/app/components/WordStudy";
import { use } from "react";

export default function WordCardPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = use(params);
  return <WordStudy level={level.toUpperCase()} />;
}
