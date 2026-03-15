import { useState, useEffect } from "react";
import SplashScreen from "@/components/SplashScreen";
import Index from "@/pages/common/Index";
import { API_BASE_URL } from "@/constants";

/**
 * Customer landing: splash (logo full screen + greet, branch, quote) then menu. No welcome/visiting page.
 */
export default function LandingWithSplash() {
  const [showSplash, setShowSplash] = useState(true);
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config/branch-contact`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.name && setBranchName(data.name))
      .catch(() => {});
  }, []);

  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => setShowSplash(false)}
        branchName={branchName}
      />
    );
  }
  return <Index />;
}
