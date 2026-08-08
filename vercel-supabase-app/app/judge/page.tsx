"use client";

// The judge-audit workbench lives INSIDE the main review tool (a work-type tab
// on review.realloop.in, like Vibe score / Issue logging) · this path only
// survives as a bounce for old links.
import { useEffect } from "react";
export default function JudgeRedirect() {
  useEffect(() => { window.location.replace("/?work=judge"); }, []);
  return null;
}
