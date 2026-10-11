import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getProfile, PROFILES, type Profile } from "@/data/profiles";

export type Decision = "pass" | "like" | "super";
export type ShowMe = "everyone" | "women" | "men";

export type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
};

type EmberState = {
  name: string;
  interests: string[];
  distance: number;
  showMe: ShowMe;
  decisions: Record<string, Decision>;
  history: string[];
  matches: string[];
  threads: Record<string, ChatMessage[]>;
  replyAt: Record<string, number>;
  openMatchId: string | null;
  setName: (name: string) => void;
  toggleInterest: (interest: string) => void;
  setDistance: (km: number) => void;
  setShowMe: (show: ShowMe) => void;
  decide: (id: string, decision: Decision) => void;
  undo: () => void;
  dismissMatch: () => void;
  send: (id: string, text: string) => void;
  resetSwipes: () => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const useEmber = create<EmberState>()(
  persist(
    (set, get) => ({
      name: "",
      interests: [],
      distance: 40,
      showMe: "everyone",
      decisions: {},
      history: [],
      matches: [],
      threads: {},
      replyAt: {},
      openMatchId: null,
      setName: (name) => set({ name }),
      toggleInterest: (interest) =>
        set((state) => ({
          interests: state.interests.includes(interest)
            ? state.interests.filter((item) => item !== interest)
            : [...state.interests, interest],
        })),
      setDistance: (distance) => set({ distance }),
      setShowMe: (showMe) => set({ showMe }),
      decide: (id, decision) => {
        const profile = getProfile(id);
        if (!profile || get().decisions[id]) return;
        const matched = (decision === "like" || decision === "super") && profile.likesYou;
        set((state) => {
          const threads = { ...state.threads };
          if (matched && !threads[id]) {
            threads[id] = [{ id: uid(), from: "them", text: profile.opener }];
          }
          return {
            decisions: { ...state.decisions, [id]: decision },
            history: [...state.history, id],
            matches: matched ? [...state.matches, id] : state.matches,
            threads,
            openMatchId: matched ? id : null,
          };
        });
      },
      undo: () => {
        const state = get();
        const id = state.history[state.history.length - 1];
        if (!id) return;
        const decisions = { ...state.decisions };
        delete decisions[id];
        const threads = { ...state.threads };
        if (state.matches.includes(id)) delete threads[id];
        set({
          history: state.history.slice(0, -1),
          decisions,
          matches: state.matches.filter((match) => match !== id),
          threads,
          openMatchId: state.openMatchId === id ? null : state.openMatchId,
        });
      },
      dismissMatch: () => set({ openMatchId: null }),
      send: (id, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const profile = getProfile(id);
        if (!profile || !get().matches.includes(id)) return;
        const cursor = get().replyAt[id] ?? 0;
        const reply = profile.replies[cursor % profile.replies.length] ?? profile.opener;
        const mine: ChatMessage = { id: uid(), from: "me", text: trimmed };
        set((state) => ({
          threads: {
            ...state.threads,
            [id]: [...(state.threads[id] ?? []), mine],
          },
          replyAt: { ...state.replyAt, [id]: cursor + 1 },
        }));
        window.setTimeout(() => {
          set((state) => {
            if (!state.matches.includes(id)) return state;
            const theirs: ChatMessage = { id: uid(), from: "them", text: reply };
            return {
              threads: {
                ...state.threads,
                [id]: [...(state.threads[id] ?? []), theirs],
              },
            };
          });
        }, 700);
      },
      resetSwipes: () =>
        set({
          decisions: {},
          history: [],
          matches: [],
          threads: {},
          replyAt: {},
          openMatchId: null,
        }),
    }),
    {
      name: "ember-dating",
      skipHydration: true,
      partialize: (state) => ({
        name: state.name,
        interests: state.interests,
        distance: state.distance,
        showMe: state.showMe,
        decisions: state.decisions,
        history: state.history,
        matches: state.matches,
        threads: state.threads,
        replyAt: state.replyAt,
      }),
    },
  ),
);

export function passesFilters(
  profile: Profile,
  distance: number,
  showMe: ShowMe,
) {
  if (profile.km > distance) return false;
  if (showMe === "women" && profile.gender !== "woman") return false;
  if (showMe === "men" && profile.gender !== "man") return false;
  return true;
}

export function deckFor(state: Pick<EmberState, "decisions" | "distance" | "showMe">) {
  return PROFILES.filter(
    (profile) => !state.decisions[profile.id] && passesFilters(profile, state.distance, state.showMe),
  );
}

export function likesFor(state: Pick<EmberState, "decisions" | "distance" | "showMe">) {
  return PROFILES.filter(
    (profile) =>
      profile.likesYou &&
      !state.decisions[profile.id] &&
      passesFilters(profile, state.distance, state.showMe),
  );
}
