"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  HashIcon,
  ChatCircleIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersIcon,
  MicrophoneIcon,
} from "@phosphor-icons/react";

const FEATURES = [
  {
    icon: MicrophoneIcon,
    title: "Voice channels that just work",
    description:
      "Drop into a voice channel with one click and start talking — crisp, low-latency audio with everyone in the room.",
  },
  {
    icon: UsersIcon,
    title: "Servers, categories & channels",
    description:
      "Spin up a server in seconds, organize it with categories, and mix voice and text channels however you like.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Custom roles & permissions",
    description:
      "Create roles with fine-grained permissions — manage channels, manage messages, kick, ban, and more — with a proper role hierarchy.",
  },
  {
    icon: ChatCircleIcon,
    title: "Friends & direct messages",
    description:
      "Add friends by username and jump straight into a 1:1 conversation, realtime, no refresh required.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AuthLoading>
      <Authenticated>
        <RedirectToApp />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </main>
  );
}

function LandingPage() {
  return (
    <>
      <NavBar />
      <Hero />
      <Features />
      <BottomCta />
      <Footer />
    </>
  );
}

function NavBar() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2 font-extrabold tracking-tight">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HashIcon className="h-5 w-5" />
        </div>
        Outpost
      </div>
      <div className="flex items-center gap-2">
        <SignInButton mode="modal">
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button>Create an account</Button>
        </SignUpButton>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
      >
        <div className="h-[420px] w-[720px] rounded-full bg-primary/25" />
      </div>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 pb-24 pt-16 text-center">
        <span className="rounded-full border border-border bg-card px-4 py-1 text-xs font-medium text-muted-foreground">
          Voice chat for your community
        </span>
        <h1 className="text-5xl font-black tracking-tight text-balance sm:text-6xl">
          Hop in, talk,
          <br />
          <span className="text-primary">no friction.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground text-balance">
          Outpost is a fast voice chat platform for your community — jump
          into a voice channel with one click, plus servers, roles &amp;
          permissions, text channels, friends, and DMs, all realtime.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <SignUpButton mode="modal">
            <Button size="lg" className="text-base">
              Create an account
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button size="lg" variant="secondary" className="text-base">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <feature.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomCta() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card px-8 py-12 text-center">
        <SparkleIcon className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-bold tracking-tight">
          Your community is waiting.
        </h2>
        <p className="max-w-md text-muted-foreground">
          Create your first server and invite your friends in under a minute.
        </p>
        <SignUpButton mode="modal">
          <Button size="lg" className="text-base">
            Get started — it&apos;s free
          </Button>
        </SignUpButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Outpost</span>
        <Link href="/app" className="hover:text-foreground">
          Go to app
        </Link>
      </div>
    </footer>
  );
}

function RedirectToApp() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Taking you to the app…</p>
    </div>
  );
}
