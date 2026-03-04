import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { useElementSize } from 'usehooks-ts';
import { Id } from '../../convex/_generated/dataModel';
import { GameId } from '../../convex/aiTown/ids.ts';
import { ServerGame } from '../hooks/serverGame.ts';
import PixiGame from './PixiGame.tsx';

export default function GameCanvas({
  worldId,
  engineId,
  game,
  historicalTime,
  setSelectedElement,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  setSelectedElement: React.Dispatch<
    React.SetStateAction<
      | {
          kind: 'player';
          id: GameId<'players'>;
        }
      | undefined
    >
  >;
}) {
  const convex = useConvex();
  const [gameWrapperRef, { width, height }] = useElementSize();
  const [isReady, setIsReady] = useState(false);

  // Delay mounting Pixi until the canvas container has a stable size.
  const canRenderStage = width > 0 && height > 0;

  useEffect(() => {
    if (canRenderStage) {
      setIsReady(true);
    }
  }, [canRenderStage]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-brown-900" ref={gameWrapperRef}>
      <div className="absolute inset-0">
        <div className="h-full w-full">
          {isReady && canRenderStage ? (
            <Stage width={width} height={height} options={{ backgroundColor: 0x7ab5ff }}>
              <ConvexProvider client={convex}>
                <PixiGame
                  game={game}
                  worldId={worldId}
                  engineId={engineId}
                  width={width}
                  height={height}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                />
              </ConvexProvider>
            </Stage>
          ) : (
            <div className="flex h-full items-center justify-center text-brown-100 text-xl">
              Preparing scene...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
