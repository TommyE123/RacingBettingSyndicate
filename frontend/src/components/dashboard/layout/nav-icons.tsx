import type { Icon } from '@phosphor-icons/react/dist/lib/types';
import { BookOpenIcon } from '@phosphor-icons/react/dist/ssr/BookOpen';
import { ChartBarIcon } from '@phosphor-icons/react/dist/ssr/ChartBar';
import { ClipboardTextIcon } from '@phosphor-icons/react/dist/ssr/ClipboardText';
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins';
import { FlagCheckeredIcon } from '@phosphor-icons/react/dist/ssr/FlagCheckered';
import { HouseIcon } from '@phosphor-icons/react/dist/ssr/House';
import { ImageIcon } from '@phosphor-icons/react/dist/ssr/Image';
import { ListChecksIcon } from '@phosphor-icons/react/dist/ssr/ListChecks';
import { PlusCircleIcon } from '@phosphor-icons/react/dist/ssr/PlusCircle';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';
import { UserIcon } from '@phosphor-icons/react/dist/ssr/User';
import { UsersIcon } from '@phosphor-icons/react/dist/ssr/Users';

export const navIcons = {
  'book-open': BookOpenIcon,
  'chart-bar': ChartBarIcon,
  clipboard: ClipboardTextIcon,
  coins: CoinsIcon,
  flag: FlagCheckeredIcon,
  house: HouseIcon,
  image: ImageIcon,
  'list-checks': ListChecksIcon,
  'plus-circle': PlusCircleIcon,
  trophy: TrophyIcon,
  user: UserIcon,
  users: UsersIcon,
} as Record<string, Icon>;
