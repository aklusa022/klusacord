"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/user-avatar";
import { AccountSettingsDialog } from "@/components/account-settings-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings } from "lucide-react";

export function UserAccountPanel() {
  const user = useQuery(api.users.getCurrentUser);
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div
        className="h-12 w-12 animate-pulse rounded-2xl bg-secondary"
        aria-hidden
      />
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={() => setOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-all hover:rounded-xl hover:bg-primary hover:text-primary-foreground"
            />
          }
          aria-label="Account settings"
        >
          <UserAvatar name={user.displayName} imageUrl={user.imageUrl} className="h-8 w-8" />
        </TooltipTrigger>
        <TooltipContent side="right">
          <span className="flex items-center gap-1">
            <Settings className="h-3 w-3" /> {user.displayName}
          </span>
        </TooltipContent>
      </Tooltip>
      <AccountSettingsDialog user={user} open={open} onOpenChange={setOpen} />
    </>
  );
}
