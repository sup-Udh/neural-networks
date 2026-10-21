"use client";

import { useEffect, useState } from "react";

export default function CurrentYear() {
  const [year, setYear] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setYear(String(new Date().getFullYear())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{year}</>;
}
