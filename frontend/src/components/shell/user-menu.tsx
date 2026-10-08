'use client';

import { LogOut, User } from 'lucide-react';
import { useState } from 'react';

import { Link } from '@/components/navigation/link';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { shell } from '@/lib/messages/shell';

function initialsOf(fullName: string): string {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

export function UserMenu(): React.JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await apiClient.post<void>('/auth/logout', undefined, { skipUnauthorizedHandler: true });
    } catch {
    } finally {
      navigate('/login');
      navigate.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-auto items-center gap-2 px-2 py-1.5"
          aria-label={shell.userMenu.accountMenuAriaLabel(user.fullName)}
        >
          <Avatar size="sm">
            <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user.fullName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{user.fullName}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" insideDismissingOverlay className="flex items-center gap-2">
            <User aria-hidden="true" className="size-4" />
            {shell.userMenu.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          {signingOut ? shell.userMenu.signingOut : shell.userMenu.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
