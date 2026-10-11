import { createFileRoute } from "@tanstack/react-router";
import { EmberApp } from "@/components/ember-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EmberApp />;
}
