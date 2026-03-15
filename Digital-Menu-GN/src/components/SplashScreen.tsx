import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import cafeLogo from "@/assets/logo.png";
import "./SplashScreen.css";

const SPLASH_VISITED_KEY = "cafeVisited";

export function getSplashVisited(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SPLASH_VISITED_KEY) === "true";
}

export function setSplashVisited(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPLASH_VISITED_KEY, "true");
}

const QUOTE = "Good food, good mood — savor the moment.";
const DEFAULT_BRANCH = "Gautam Nagar";

function normalizeBranchName(name: string | null | undefined): string {
  const n = name?.trim();
  if (!n || /^main(\s+branch)?$/i.test(n)) return DEFAULT_BRANCH;
  return n;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 22) return "Night craving";
  if (hour >= 17) return "Good evening";
  if (hour >= 12) return "Good afternoon";
  return "Good morning";
}

interface SplashScreenProps {
  onFinish: () => void;
  branchName?: string | null;
}

const SPLASH_DURATION_MS = 2800;

export default function SplashScreen({
  onFinish,
  branchName,
}: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);
  const greeting = getTimeBasedGreeting();
  const displayBranch = normalizeBranchName(branchName);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setSplashVisited();
        onFinish();
      }, 400);
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence mode="wait">
      {!exiting && (
        <motion.div
          key="splash"
          className="splash-container"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.4, ease: "easeInOut" },
          }}
        >
          <motion.div
            className="splash-logo-wrap"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <img
              src={cafeLogo}
              alt="Cafe Chapter 1"
              className="splash-logo-full"
            />
          </motion.div>
          <motion.div
            className="splash-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          >
            <p className="splash-greet">{greeting}</p>
            <p className="splash-branch">{displayBranch}</p>
            <p className="splash-quote">"{QUOTE}"</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
