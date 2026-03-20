import type { ReactNode } from "react";

type PlayerStatusRowProps<TPlayerId extends string> = {
  playerIds: TPlayerId[];
  currentPlayerId?: TPlayerId | null;
  className?: string;
  renderPlayer: (id: TPlayerId, ctx: { isActive: boolean }) => ReactNode;
};

export function PlayerStatusRow<TPlayerId extends string>({
  playerIds,
  currentPlayerId,
  className,
  renderPlayer,
}: PlayerStatusRowProps<TPlayerId>) {
  return (
    <div className={className}>
      {playerIds.map((id) => renderPlayer(id, { isActive: id === currentPlayerId }))}
    </div>
  );
}

