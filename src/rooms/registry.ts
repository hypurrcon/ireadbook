import type { RoomCustomization } from '../db/types';
import type { RoomDef } from './types';
import { attic } from './attic';
import { cyberpunk } from './cyberpunk';
import { library } from './library';
import { japanese } from './japanese';
import { treehouse } from './treehouse';
import { space } from './space';
import { wizard } from './wizard';
import { train } from './train';
import { underwater } from './underwater';
import { cafe } from './cafe';
import { minimal } from './minimal';

export const ROOMS: RoomDef[] = [attic, cyberpunk, library, japanese, treehouse, space, wizard, train, underwater, cafe, minimal];

export function getRoom(id: string): RoomDef {
  return ROOMS.find((r) => r.id === id) ?? attic;
}

export function defaultCustomization(room: RoomDef): RoomCustomization {
  return { shelfMaterial: 'wood', decor: [], ...room.defaults } as RoomCustomization;
}
