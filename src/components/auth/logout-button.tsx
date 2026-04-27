"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

type LogoutButtonProps = {
  className?: string;
  children?: ReactNode;
};

export function LogoutButton({
  className,
  children = "Log out",
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
    >
      {pending ? "Logging out…" : children}
    </button>
  );
}
