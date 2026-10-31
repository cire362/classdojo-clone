import type { Dispatch, SetStateAction } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { GroupDetails } from '../../../lib/api';

export interface GroupCtx {
  data: GroupDetails;
  setData: Dispatch<SetStateAction<GroupDetails | null>>;
  reload: () => Promise<void>;
}

export const useGroup = () => useOutletContext<GroupCtx>();
