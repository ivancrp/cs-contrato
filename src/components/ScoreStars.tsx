interface ScoreStarsProps {
  score: number;
  max?: number;
}

export function ScoreStars({ score, max = 5 }: ScoreStarsProps) {
  const filled = Math.min(Math.max(Math.round(score), 0), max);
  return (
    <span className="score-stars" title={`Score IA: ${score}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < filled ? 'star filled' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
}
