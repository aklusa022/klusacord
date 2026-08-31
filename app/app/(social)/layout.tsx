import { ReactNode } from "react";
import { FriendsSidebar } from "@/components/sidebar/friends-sidebar";

export default function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FriendsSidebar />
      <div className="flex min-w-0 flex-1">{children}</div>
    </>
  );
}
