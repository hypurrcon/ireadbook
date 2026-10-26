import type { FC } from 'react';
import type { Quality, RoomCustomization } from '../db/types';
import type { AmbienceRecipe } from '../audio/sound';
import type { BookcaseLook } from '../three/Bookcase';
import type { RoomId, RoomTokens } from './tokens';

export interface SceneProps { night: boolean; quality: Quality; width: number; caseH: number; rows: number; custom: RoomCustomization }

export interface RoomDef {
  id: RoomId;
  tokens: RoomTokens;
  ambience: (night: boolean) => AmbienceRecipe;
  Scene: FC<SceneProps>;
  look: (c: RoomCustomization) => BookcaseLook;
  defaults: Partial<RoomCustomization> & { night: boolean; shelfRows: number };
  colors: string[]; // shelf colour choices
  camera?: { fov?: number; yBias?: number; zoom?: number };
  exposure?: number;
  faceOut?: boolean;
  preview: [string, string, string]; // swatches for the picker
}
